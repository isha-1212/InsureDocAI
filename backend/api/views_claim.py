

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.utils import timezone
from .models_claim import Claim
from .models_document import ClaimDocument
from auth_service.custom_permissions import IsSupabaseAuthenticated
from .supabase_client import upload_to_bucket, create_signed_url, get_public_url, download_file_authenticated
import uuid as _uuid
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

_DOC_FIELD_WHITELIST = {
    'aadhaar': {'name', 'aadhaar_number'},
    'pan': {'name', 'pan_number'},
}


def _filter_cached_fields_for_doc_type(document_type: str, fields: list) -> list:
    allowed = _DOC_FIELD_WHITELIST.get(str(document_type).lower())
    if not allowed:
        return fields
    return [f for f in fields if f.get('field_name') in allowed or f.get('field_name') == 'extraction_error']


def _recompute_claim_status(claim_id: str) -> str:
    docs = ClaimDocument.objects.filter(claim_id=claim_id)
    if not docs.exists():
        status_value = 'pending'
    else:
        statuses = list(docs.values_list('review_status', flat=True))
        if any(s == 'rejected' for s in statuses):
            status_value = 'rejected'
        elif all(s == 'approved' for s in statuses):
            status_value = 'approved'
        else:
            status_value = 'pending'
    Claim.objects.filter(claim_id=claim_id).update(status=status_value, updated_at=timezone.now())
    return status_value


@api_view(['GET', 'POST'])
@permission_classes([IsSupabaseAuthenticated])
@transaction.atomic
def create_claim(request):
    """
    Create a new insurance claim with uploaded documents (POST)
    or list authenticated user's claims (GET).
    """
    try:
        # Get authenticated user from request
        supabase_user_id = getattr(request, 'user_id', None)
        email = getattr(request, 'email', None)
        
        # Find the user
        user = None
        if supabase_user_id:
            try:
                from users.models import User
                user = User.objects.get(supabase_user_id=supabase_user_id)
            except User.DoesNotExist:
                pass
                
        if not user and email:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                pass
                
        if not user:
            return Response({
                'detail': 'User not authenticated or not found'
            }, status=status.HTTP_401_UNAUTHORIZED)

        if request.method == 'GET':
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        c.claim_id,
                        c.status,
                        c.created_at,
                        COALESCE(
                            c.total_amount,
                            amt.total_amount_extracted
                        ) AS total_amount,
                        c.member_id,
                        COALESCE(
                            fm.name,
                            name_from_extract.member_name_extracted,
                            'Policy holder'
                        ) AS member_name,
                        COUNT(cd.document_id) AS document_count,
                        COALESCE(
                            json_agg(
                                json_build_object(
                                    'document_id', cd.document_id::text,
                                    'document_type', cd.document_type,
                                    'review_status', cd.review_status,
                                    'review_remarks', cd.review_remarks
                                )
                                ORDER BY cd.uploaded_at ASC
                            ) FILTER (WHERE cd.document_id IS NOT NULL),
                            '[]'::json
                        ) AS documents_json
                    FROM claims c
                    LEFT JOIN family_members fm ON fm.id = c.member_id
                    LEFT JOIN claim_documents cd ON cd.claim_id = c.claim_id
                    LEFT JOIN LATERAL (
                        SELECT
                            NULLIF(REGEXP_REPLACE(e.field_value, '[^0-9.]', '', 'g'), '')::numeric AS total_amount_extracted
                        FROM claim_extracted_fields e
                        WHERE e.claim_id = c.claim_id
                          AND e.field_name = 'total_amount'
                        ORDER BY e.created_at DESC
                        LIMIT 1
                    ) amt ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT NULLIF(TRIM(e.field_value), '') AS member_name_extracted
                        FROM claim_extracted_fields e
                        WHERE e.claim_id = c.claim_id
                          AND e.field_name IN ('patient_name', 'name')
                        ORDER BY e.created_at DESC
                        LIMIT 1
                    ) name_from_extract ON TRUE
                    WHERE c.user_id = %s::uuid
                    GROUP BY c.claim_id, c.status, c.created_at, c.total_amount, c.member_id, fm.name, amt.total_amount_extracted, name_from_extract.member_name_extracted
                    ORDER BY c.created_at DESC
                    """,
                    [str(user.supabase_user_id)],
                )
                rows = cursor.fetchall()

            claims = []
            for row in rows:
                claim_id, claim_status, created_at, total_amount, member_id, member_name, document_count, documents_json = row
                if isinstance(documents_json, str):
                    try:
                        documents_json = json.loads(documents_json)
                    except Exception:
                        documents_json = []

                documents = []
                for doc in (documents_json or []):
                    doc_id = doc.get("document_id")
                    doc_type = doc.get("document_type")
                    documents.append({
                        'documentId': str(doc_id) if doc_id is not None else None,
                        'documentType': doc_type,
                        'status': doc.get("review_status") or 'pending',
                        'remarks': doc.get("review_remarks"),
                        # Keep list endpoint fast: fetch actual bytes only when user clicks View.
                        'viewUrl': f"/api/admin/claims/{claim_id}/documents/{doc_id}/download/" if doc_id else None,
                        'reuploadUrl': '/portal/claims/new',
                    })

                claims.append({
                    'id': str(claim_id),
                    'status': claim_status,
                    'submittedDate': created_at.isoformat() if created_at else None,
                    'totalAmount': float(total_amount) if total_amount is not None else 0.0,
                    'member': {
                        'id': int(member_id) if member_id else None,
                        'name': member_name,
                    },
                    'documentCount': int(document_count or 0),
                    'documents': documents,
                })

            return Response(claims, status=status.HTTP_200_OK)

        policy_id = request.data.get('policy_id')
        member_id = request.data.get('member_id')
        total_amount = request.data.get('total_amount')

        # Validate required fields
        if not policy_id:
            return Response({
                'detail': 'policy_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        if not member_id:
            return Response({
                'detail': 'member_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        if total_amount in (None, ''):
            return Response({
                'detail': 'total_amount is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not request.FILES:
            return Response({
                'detail': 'At least one document is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify policy exists and belongs to user
        try:
            from .models import Policy
            policy = Policy.objects.get(id=policy_id, user=user)
        except Policy.DoesNotExist:
            return Response({
                'detail': 'Policy not found or does not belong to user'
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            from .models import FamilyMember
            member = FamilyMember.objects.get(id=member_id, policy=policy)
        except FamilyMember.DoesNotExist:
            return Response({
                'detail': 'Family member not found for this policy'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Always create a new claim request. Frontend should prevent accidental double-clicks.
        from django.db import connection

        # Create the claim record using raw SQL to avoid Django ORM type issues
        claim_id = None
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO claims (claim_id, user_id, policy_id, member_id, total_amount, status, created_at, updated_at)
                VALUES (gen_random_uuid(), %s::uuid, %s, %s, %s, 'pending', NOW(), NOW())
                RETURNING claim_id
            """, [str(user.supabase_user_id), policy.id, member.id, total_amount])
            
            result = cursor.fetchone()
            claim_id = result[0] if result else None
        
        if not claim_id:
            return Response({
                'detail': 'Failed to create claim record'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Get the created claim object for further use
        claim = Claim.objects.get(claim_id=claim_id)
        
        logger.info(f"Created claim {claim.claim_id} for user {user.user_id}")
        
        uploaded_files = []
        document_buckets = {
            'hospital_bill': 'hospital_bills',
            'pharmacy_bill': 'pharmacy_bills',
            'aadhaar': 'aadhaar',
            'pan': 'pan',
            'birth_certificate': 'Birth_certificates'
        }
        
        for field_name, bucket_name in document_buckets.items():
            if field_name in request.FILES:
                file_obj = request.FILES[field_name]
                
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                unique_id = str(uuid.uuid4())[:8]
                file_extension = file_obj.name.split('.')[-1] if '.' in file_obj.name else 'pdf'
                file_path = f"{user.user_id}/{field_name}_{timestamp}_{unique_id}.{file_extension}"
                
                file_bytes = file_obj.read()
                content_type = file_obj.content_type or 'application/octet-stream'
                
                try:
                    resp = upload_to_bucket(bucket_name, file_path, file_bytes, content_type)
                    
                    if resp.status_code in [200, 201]:
                        file_url = f"{bucket_name}/{file_path}"
                        
                        # Save document to ClaimDocument table with only available fields
                        document = ClaimDocument.objects.create(
                            claim_id=claim.claim_id,
                            document_type=field_name,
                            file_url=file_url,
                            file_path=file_path
                        )
                        
                        logger.info(f"Saved document {document.document_id} for claim {claim.claim_id}")
                        
                        uploaded_files.append({
                            'document_id': str(document.document_id),
                            'type': field_name,
                            'filename': file_obj.name,
                            'url': file_url,
                            'size': file_obj.size,
                            'bucket': bucket_name
                        })
                    else:
                        raise RuntimeError(f'Failed to upload {field_name}: {resp.text}')
                        
                except Exception as upload_error:
                    raise RuntimeError(f'Error uploading {field_name}: {str(upload_error)}')

        if not uploaded_files:
            transaction.set_rollback(True)
            return Response({
                'detail': 'No valid claim documents were provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'message': 'Claim created successfully',
            'claim_id': str(claim.claim_id),
            'policy_id': str(policy.id),
            'policy_number': policy.policy_number,
            'member_id': member.id,
            'member_name': member.name,
            'total_amount': float(claim.total_amount) if claim.total_amount is not None else None,
            'user_name': user.name or user.full_name or user.email,
            'user_email': user.email,
            'status': claim.status,
            'uploaded_files': uploaded_files,
            'document_count': len(uploaded_files)
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        transaction.set_rollback(True)
        return Response({
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsSupabaseAuthenticated])
@transaction.atomic
def reupload_claim_documents(request, claim_id):
    """
    Re-upload/replace one or more documents for an existing claim.
    """
    try:
        supabase_user_id = getattr(request, 'user_id', None)
        email = getattr(request, 'email', None)

        user = None
        if supabase_user_id:
            try:
                from users.models import User
                user = User.objects.get(supabase_user_id=supabase_user_id)
            except User.DoesNotExist:
                pass
        if not user and email:
            try:
                from users.models import User
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                pass
        if not user:
            return Response({'detail': 'User not authenticated or not found'}, status=status.HTTP_401_UNAUTHORIZED)

        claim_uuid = _uuid.UUID(str(claim_id))
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT claim_id
                FROM claims
                WHERE claim_id = %s::uuid
                  AND user_id = %s::uuid
                LIMIT 1
                """,
                [str(claim_uuid), str(user.supabase_user_id)],
            )
            row = cursor.fetchone()
        if not row:
            return Response({'detail': 'Claim not found for this user'}, status=status.HTTP_404_NOT_FOUND)

        if not request.FILES:
            return Response({'detail': 'At least one document is required for reupload'}, status=status.HTTP_400_BAD_REQUEST)

        document_buckets = {
            'hospital_bill': 'hospital_bills',
            'pharmacy_bill': 'pharmacy_bills',
            'aadhaar': 'aadhaar',
            'pan': 'pan',
            'birth_certificate': 'Birth_certificates'
        }

        updated_docs = []
        for field_name, bucket_name in document_buckets.items():
            if field_name not in request.FILES:
                continue

            file_obj = request.FILES[field_name]
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_id = str(uuid.uuid4())[:8]
            file_extension = file_obj.name.split('.')[-1] if '.' in file_obj.name else 'pdf'
            file_path = f"{user.user_id}/{field_name}_{timestamp}_{unique_id}.{file_extension}"
            file_bytes = file_obj.read()
            content_type = file_obj.content_type or 'application/octet-stream'

            resp = upload_to_bucket(bucket_name, file_path, file_bytes, content_type)
            if resp.status_code not in [200, 201]:
                raise RuntimeError(f'Failed to upload {field_name}: {resp.text}')

            file_url = f"{bucket_name}/{file_path}"
            doc, _created = ClaimDocument.objects.update_or_create(
                claim_id=claim_uuid,
                document_type=field_name,
                defaults={
                    'file_url': file_url,
                    'file_path': file_path,
                    'review_status': 'pending',
                    'review_remarks': None,
                    'reviewed_at': None,
                    'reviewed_by': None,
                }
            )

            updated_docs.append({
                'document_id': str(doc.document_id),
                'document_type': field_name,
                'filename': file_obj.name,
                'bucket': bucket_name,
            })

        if not updated_docs:
            return Response({'detail': 'No valid reupload documents found'}, status=status.HTTP_400_BAD_REQUEST)

        current_claim_status = _recompute_claim_status(str(claim_uuid))

        return Response({
            'message': 'Documents reuploaded successfully',
            'claim_id': str(claim_uuid),
            'updated_documents': updated_docs,
            'status': current_claim_status,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        transaction.set_rollback(True)
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsSupabaseAuthenticated])
def review_claim_document(request, claim_id, document_id):
    """
    Admin review action for a single document with remarks.
    body: { "status": "approved|rejected|pending", "remarks": "..." }
    """
    try:
        review_status = str(request.data.get('status', '')).lower()
        remarks = request.data.get('remarks')
        if review_status not in {'approved', 'rejected', 'pending'}:
            return Response({'detail': 'status must be approved, rejected, or pending'}, status=status.HTTP_400_BAD_REQUEST)

        from users.models import User
        admin_email = getattr(request, 'email', None)
        admin_user = User.objects.filter(email=admin_email).first() if admin_email else None
        if not admin_user or admin_user.role != 'admin':
            return Response({'detail': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

        doc = ClaimDocument.objects.filter(document_id=document_id, claim_id=claim_id).first()
        if not doc:
            return Response({'detail': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)

        doc.review_status = review_status
        doc.review_remarks = remarks
        doc.reviewed_at = timezone.now()
        doc.reviewed_by = admin_user.email
        doc.save(update_fields=['review_status', 'review_remarks', 'reviewed_at', 'reviewed_by'])

        claim_status = _recompute_claim_status(str(claim_id))

        return Response({
            'claim_id': str(claim_id),
            'document_id': str(document_id),
            'review_status': doc.review_status,
            'review_remarks': doc.review_remarks,
            'claim_status': claim_status,
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ClaimViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing insurance claims
    TODO: Implement queryset, serializer_class, and business logic
    """
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return []
    
    def list(self, request):
        return Response({'message': 'TODO: Implement claim list'})
    
    def retrieve(self, request, pk=None):
        return Response({'message': f'TODO: Implement claim detail for ID {pk}'})
    
    def create(self, request):
        return Response({'message': 'TODO: Implement claim creation'})
    
    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None):
        return Response({'message': f'TODO: Implement status update for claim {pk}'})
    
    @action(detail=False, methods=['get'])
    def my_claims(self, request):
        return Response({'message': 'TODO: Implement my_claims endpoint'})
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        return Response({'message': 'TODO: Implement pending claims endpoint'})


@api_view(['GET'])
@permission_classes([])  # Temporarily remove authentication for testing
def admin_review_claim(request, claim_id):
    """
    Admin endpoint to review a claim and fetch all documents
    """
    try:
        # Get the claim using raw SQL to avoid type mismatch issues
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    c.claim_id,
                    c.user_id,
                    c.policy_id,
                    c.status,
                    c.created_at,
                    c.total_amount,
                    u.name,
                    u.full_name,
                    u.email,
                    p.policy_number
                FROM claims c
                INNER JOIN users u ON c.user_id = u.supabase_user_id
                INNER JOIN policies p ON c.policy_id = p.id
                WHERE c.claim_id = %s
            """, [claim_id])
            
            claim_row = cursor.fetchone()
        
        if not claim_row:
            return Response({
                'detail': f'Claim with ID {claim_id} not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        claim_id, user_uuid, policy_id, claim_status, created_at, total_amount, name, full_name, email, policy_number = claim_row
        
        # Get all documents for this claim
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT document_id, document_type, file_url, file_path, uploaded_at, review_status, review_remarks, reviewed_at, reviewed_by
                FROM claim_documents 
                WHERE claim_id = %s
            """, [claim_id])
            doc_rows = cursor.fetchall()
        
        if not doc_rows:
            return Response({
                'detail': 'No documents found for this claim'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Prepare document data
        document_data = []
        
        for doc_row in doc_rows:
            doc_id, doc_type, file_url, file_path, uploaded_at, review_status, review_remarks, reviewed_at, reviewed_by = doc_row
            
            try:
                # Get bucket name for document type
                bucket_name = _get_bucket_name_for_document_type(doc_type)
                # Use backend proxy download URL to avoid slow per-document signed URL generation
                signed_url = f"/api/admin/claims/{claim_id}/documents/{doc_id}/download/"

                original_filename = None
                if file_path:
                    try:
                        original_filename = file_path.split('/')[-1]
                    except Exception:
                        original_filename = None
                
                document_info = {
                    'document_id': str(doc_id),
                    'document_type': doc_type,
                    'signed_url': signed_url,
                    'file_url': file_url,
                    'file_path': file_path,
                    'uploaded_at': uploaded_at.isoformat() if uploaded_at else None,
                    'upload_date': uploaded_at.isoformat() if uploaded_at else None,
                    'original_filename': original_filename,
                    'bucket_name': bucket_name
                    ,
                    'review_status': review_status or 'pending',
                    'review_remarks': review_remarks,
                    'reviewed_at': reviewed_at.isoformat() if reviewed_at else None,
                    'reviewed_by': reviewed_by,
                }
                
                document_data.append(document_info)
                
            except Exception as e:
                logger.error(f"Error processing document {doc_id}: {str(e)}")
                continue
        
        # Get user display name
        user_name = name or full_name or email or "Unknown User"
        
        # Get ML extraction data (cached only, do not block review response)
        ml_extraction_data = {}
        try:
            from .models_document import ClaimExtractedField
            cached_fields = ClaimExtractedField.objects.filter(claim_id=claim_id)
            if cached_fields.exists():
                grouped_data = {}
                for field in cached_fields:
                    doc_type = field.document_type
                    if doc_type not in grouped_data:
                        grouped_data[doc_type] = []
                    grouped_data[doc_type].append({
                        'field_name': field.field_name,
                        'value': field.field_value,
                        'confidence': float(field.confidence_score) if field.confidence_score else 0.0
                    })
                for doc_type in list(grouped_data.keys()):
                    grouped_data[doc_type] = _filter_cached_fields_for_doc_type(doc_type, grouped_data[doc_type])
                ml_extraction_data = {
                    'extraction_status': 'cached',
                    'documents': grouped_data
                }
            else:
                ml_extraction_data = {
                    'extraction_status': 'pending',
                    'documents': {}
                }
        except Exception as e:
            logger.error(f"Error fetching cached ML extraction: {str(e)}")
            ml_extraction_data = {
                'extraction_status': 'error',
                'error': 'Failed to load cached extraction',
                'details': str(e)
            }
        
        # Return basic claim and document data with ML extraction
        return Response({
            'claim_id': str(claim_id),
            'claim_status': claim_status,
            'total_amount': str(total_amount) if total_amount is not None else '0',
            'created_at': created_at.isoformat() if created_at else None,
            'user_name': user_name,
            'user_email': email,
            'policy_id': str(policy_id),
            'policy_number': policy_number,
            'documents': document_data,
            'document_count': len(document_data),
            'ml_extraction': ml_extraction_data
        }, status=status.HTTP_200_OK)
            
    except Exception as e:
        logger.error(f"Error in admin_review_claim: {str(e)}", exc_info=True)
        return Response({
            'detail': 'An error occurred while reviewing the claim',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsSupabaseAuthenticated])
def download_claim_document(request, claim_id, document_id):
    """
    Download claim document via backend proxy to avoid slow signed URL generation.
    """
    try:
        try:
            document_uuid = _uuid.UUID(str(document_id))
        except Exception:
            return Response({'error': 'Invalid document ID'}, status=status.HTTP_404_NOT_FOUND)

        document = ClaimDocument.objects.get(document_id=document_uuid, claim_id=claim_id)

        # file_url format: "bucket_name/path"
        parts = (document.file_url or "").split('/', 1)
        if len(parts) != 2:
            return Response({'error': 'Invalid file_url format'}, status=status.HTTP_400_BAD_REQUEST)

        bucket_name = parts[0]
        file_path = parts[1]

        file_response = download_file_authenticated(bucket=bucket_name, file_path=file_path)
        if not file_response.ok:
            return Response({'error': 'File not found in storage'}, status=status.HTTP_404_NOT_FOUND)

        file_name = document.file_path.split('/')[-1] if document.file_path else 'document'
        response = HttpResponse(
            file_response.content,
            content_type=file_response.headers.get('Content-Type', 'application/octet-stream')
        )
        response['Content-Disposition'] = f'inline; filename="{file_name}"'
        response['Cache-Control'] = 'private, max-age=3600'
        return response
    except ClaimDocument.DoesNotExist:
        return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e), 'message': 'Failed to download document'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _get_document_signed_url(file_url: str, document_type: str) -> str:
    """
    Get signed URL for document from appropriate Supabase bucket
    """
    try:
        # Parse file_url format: "bucket_name/user_id/document_type/policy_id/member_id/filename"
        parts = file_url.split('/', 1)
        if len(parts) != 2:
            raise ValueError(f"Invalid file_url format: {file_url}")
        
        bucket_name = parts[0]
        file_path = parts[1]
        
        logger.info(f"Creating signed URL for bucket: {bucket_name}, path: {file_path}")
        
        # Create signed URL that expires in 2 hours
        signed_url_data = create_signed_url(bucket_name, file_path, expires_in=7200)
        
        # Extract the signed URL from response
        signed_url = signed_url_data.get('signedURL') or signed_url_data.get('signed_url')
        
        if not signed_url:
            raise ValueError(f"Failed to create signed URL for {file_url}")
        
        return signed_url
        
    except Exception as e:
        logger.error(f"Error creating signed URL for {file_url}: {str(e)}")
        # Fallback to public URL if available
        try:
            parts = file_url.split('/', 1)
            if len(parts) == 2:
                return get_public_url(parts[0], parts[1])
        except:
            pass
        raise


def _get_bucket_name_for_document_type(document_type: str) -> str:
    """
    Get the appropriate bucket name for each document type
    """
    bucket_mapping = {
        'PAN': 'pan',
        'AADHAAR': 'aadhaar', 
        'HOSPITAL_BILL': 'hospital_bills',
        'PHARMACY_BILL': 'pharmacy_bills',
        'POLICY': 'policies',
        'pan': 'pan',
        'aadhaar': 'aadhaar',
        'hospital_bill': 'hospital_bills',
        'pharmacy_bill': 'pharmacy_bills',
        'birth_certificate': 'Birth_certificates'
    }
    return bucket_mapping.get(document_type, 'policies')


def _get_sample_ml_data():
    """
    Return sample ML extraction data for demonstration
    Shows structure that KYC pipeline and hospital/pharmacy extractors would return
    """
    return {
        'hospital_bill': [
            {'field_name': 'patient_name', 'value': 'Real User from Database', 'confidence': 0.97},
            {'field_name': 'hospital_name', 'value': 'Apollo Hospital', 'confidence': 0.95},
            {'field_name': 'treatment_date', 'value': '2024-01-10', 'confidence': 0.98},
            {'field_name': 'total_amount', 'value': '₹18,500', 'confidence': 0.96},
            {'field_name': 'doctor_name', 'value': 'Dr. Sharma', 'confidence': 0.94},
            {'field_name': 'diagnosis', 'value': 'Fever, Cough', 'confidence': 0.93}
        ],
        'pharmacy_bills': [
            {'field_name': 'patient_name', 'value': 'Real User from Database', 'confidence': 0.96},
            {'field_name': 'pharmacy_name', 'value': 'MedPlus', 'confidence': 0.94},
            {'field_name': 'prescription_date', 'value': '2024-01-12', 'confidence': 0.97},
            {'field_name': 'total_amount', 'value': '₹6,500', 'confidence': 0.98},
            {'field_name': 'medicines', 'value': 'Paracetamol, Cough Syrup', 'confidence': 0.92}
        ],
        'aadhaar': [
            {'field_name': 'name', 'value': 'Real User from Database', 'confidence': 0.99},
            {'field_name': 'aadhaar_number', 'value': 'XXXX-XXXX-8742', 'confidence': 0.98},
            {'field_name': 'date_of_birth', 'value': '15/08/1985', 'confidence': 0.97},
            {'field_name': 'address', 'value': '123 MG Road, Bangalore', 'confidence': 0.95},
            {'field_name': 'gender', 'value': 'Male', 'confidence': 0.99}
        ],
        'pan': [
            {'field_name': 'name', 'value': 'Real User from Database', 'confidence': 0.98},
            {'field_name': 'pan_number', 'value': 'ABCPK1234M', 'confidence': 0.97},
            {'field_name': 'fathers_name', 'value': 'Suresh Kumar', 'confidence': 0.96},
            {'field_name': 'date_of_birth', 'value': '15/08/1985', 'confidence': 0.95}
        ]
    }
