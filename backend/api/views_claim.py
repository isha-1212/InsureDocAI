

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from .models_claim import Claim, ClaimEvent
from .models_document import ClaimDocument, ClaimExtractedField
from .models import Policy
from auth_service.custom_permissions import IsSupabaseAuthenticated
from .supabase_client import upload_to_bucket, create_signed_url, get_public_url, download_file_authenticated
import uuid as _uuid
import json
import uuid
from datetime import datetime
import logging
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed

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


def _get_latest_document_upload_map(claim_id: str) -> dict:
    latest_uploads = {}
    for doc in ClaimDocument.objects.filter(claim_id=claim_id).only('document_type', 'uploaded_at'):
        if not doc.uploaded_at:
            continue
        current = latest_uploads.get(doc.document_type)
        if current is None or doc.uploaded_at > current:
            latest_uploads[doc.document_type] = doc.uploaded_at
    return latest_uploads


def _approved_claims_total_for_policy(policy_id: int) -> Decimal:
    aggregate = Claim.objects.filter(policy_id=policy_id, status='approved').aggregate(total=Sum('total_amount'))
    return Decimal(aggregate.get('total') or 0)


def _sync_policy_used_coverage(policy: Policy) -> Policy:
    approved_total = max(_approved_claims_total_for_policy(policy.id), Decimal('0'))
    if Decimal(policy.used_coverage_amount or 0) != approved_total:
        policy.used_coverage_amount = approved_total
        policy.save(update_fields=['used_coverage_amount'])
    else:
        policy.used_coverage_amount = approved_total
    return policy


def _recompute_claim_status(claim_id: str) -> str:
    # Manual decision workflow: document review must never auto-finalize the claim.
    # Final status changes are allowed only through explicit approve/reject endpoints.
    status_value = 'pending'
    with transaction.atomic():
        claim = Claim.objects.select_for_update().filter(claim_id=claim_id).first()
        if not claim:
            return status_value

        status_value = claim.status

        policy = Policy.objects.select_for_update().filter(id=claim.policy_id).first()
        if policy:
            _sync_policy_used_coverage(policy)

    return status_value


def _get_request_user(request):
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

    return user


def _get_admin_user(request):
    user = _get_request_user(request)
    if not user or user.role != 'admin':
        return None
    return user


def _infer_document_status(review_status: str | None, exists: bool = True) -> str:
    if not exists:
        return 'missing'
    if review_status == 'approved':
        return 'verified'
    return 'issue'


def _get_expected_document_types(claim) -> list[str]:
    required = ['hospital_bill', 'aadhaar']
    try:
        if getattr(claim, 'member', None) and getattr(claim.member, 'is_minor', False):
            required.extend(['birth_certificate', 'pan'])
    except Exception:
        pass
    return required


def _serialize_timeline(claim_id) -> list[dict]:
    claim = Claim.objects.filter(claim_id=claim_id).only('status', 'updated_at', 'created_at', 'rejection_reason').first()
    meaningful_event_types = {'submitted', 'rejected', 'reapplied', 'reopened', 'approved'}
    serialized = []
    previous_signature = None
    for event in ClaimEvent.objects.filter(claim_id=claim_id).order_by('created_at', 'id'):
        if event.event_type not in meaningful_event_types:
            continue
        metadata = event.metadata or {}
        signature = (
            event.event_type,
            event.event_label,
            metadata.get('reason'),
        )
        payload = {
            'eventType': event.event_type,
            'label': event.event_label,
            'timestamp': event.created_at.isoformat() if event.created_at else None,
            'metadata': metadata,
        }
        if signature == previous_signature and serialized:
            serialized[-1] = payload
            continue
        serialized.append(payload)
        previous_signature = signature
    if not claim:
        return serialized

    current_event_map = {
        'approved': 'Current: Approved',
        'rejected': 'Current: Rejected',
        'reapplied': 'Current: Pending Review',
        'pending': 'Current: Pending Review',
    }
    current_event_type = str(claim.status or 'pending').lower()
    current_payload = {
        'eventType': current_event_type,
        'label': current_event_map.get(current_event_type, 'Current'),
        'timestamp': (claim.updated_at or claim.created_at).isoformat() if (claim.updated_at or claim.created_at) else None,
        'metadata': {'current': True},
    }
    if current_event_type == 'rejected':
        current_payload['metadata']['reason'] = getattr(claim, 'rejection_reason', None)

    if serialized and serialized[-1]['label'] == current_payload['label']:
        serialized[-1] = current_payload
    elif serialized and serialized[-1]['eventType'] == current_event_type and current_event_type in {'approved', 'rejected'}:
        serialized[-1] = current_payload
    else:
        serialized.append(current_payload)
    return serialized


def _build_claim_snapshot(claim) -> dict:
    documents = []
    for doc in ClaimDocument.objects.filter(claim_id=claim.claim_id).order_by('document_type'):
        documents.append({
            'document_type': doc.document_type,
            'file_path': doc.file_path,
            'review_status': doc.review_status,
            'document_status': _infer_document_status(doc.review_status, True),
        })
    return {
        'member_id': claim.member_id,
        'member_name': claim.member.name if getattr(claim, 'member', None) else 'Policy holder',
        'total_amount': str(claim.total_amount) if claim.total_amount is not None else '',
        'documents': documents,
    }


def _compute_change_summary(previous_snapshot: dict | None, current_snapshot: dict) -> list[dict]:
    if not previous_snapshot:
        return []

    changes = []
    if str(previous_snapshot.get('total_amount', '')) != str(current_snapshot.get('total_amount', '')):
        changes.append({
            'field': 'total_amount',
            'label': 'Amount changed',
            'before': previous_snapshot.get('total_amount'),
            'after': current_snapshot.get('total_amount'),
        })

    if str(previous_snapshot.get('member_id', '')) != str(current_snapshot.get('member_id', '')):
        changes.append({
            'field': 'member',
            'label': 'Member changed',
            'before': previous_snapshot.get('member_name'),
            'after': current_snapshot.get('member_name'),
        })

    prev_docs = {doc['document_type']: doc for doc in previous_snapshot.get('documents', [])}
    curr_docs = {doc['document_type']: doc for doc in current_snapshot.get('documents', [])}

    for document_type, current_doc in curr_docs.items():
        previous_doc = prev_docs.get(document_type)
        if not previous_doc:
            changes.append({
                'field': f'document:{document_type}',
                'label': f'{document_type} added',
                'before': None,
                'after': 'uploaded',
            })
            continue
        if previous_doc.get('file_path') != current_doc.get('file_path'):
            changes.append({
                'field': f'document:{document_type}',
                'label': f'{document_type} replaced',
                'before': previous_doc.get('file_path'),
                'after': current_doc.get('file_path'),
            })

    for document_type in prev_docs.keys() - curr_docs.keys():
        changes.append({
            'field': f'document:{document_type}',
            'label': f'{document_type} removed',
            'before': 'uploaded',
            'after': None,
        })

    return changes


def _serialize_policy_coverage(policy) -> dict:
    total_coverage = Decimal(policy.total_coverage_amount or 0)
    used_coverage = Decimal(policy.used_coverage_amount or 0)
    remaining_coverage = max(total_coverage - used_coverage, Decimal('0'))
    return {
        'total_coverage_amount': float(total_coverage),
        'used_coverage_amount': float(used_coverage),
        'remaining_coverage_amount': float(remaining_coverage),
    }


def _log_claim_event(claim, event_type: str, label: str, metadata: dict | None = None):
    ClaimEvent.objects.create(
        claim_id=claim.claim_id,
        event_type=event_type,
        event_label=label,
        metadata=metadata or {},
    )


@api_view(['GET', 'POST'])
@permission_classes([IsSupabaseAuthenticated])
@transaction.atomic
def create_claim(request):
    """
    Create a new insurance claim with uploaded documents (POST)
    or list authenticated user's claims (GET).
    """
    try:
        user = _get_request_user(request)
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
                        c.updated_at,
                        c.rejection_reason,
                        c.is_reapplied,
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
                    GROUP BY c.claim_id, c.status, c.created_at, c.updated_at, c.rejection_reason, c.is_reapplied, c.total_amount, c.member_id, fm.name, amt.total_amount_extracted, name_from_extract.member_name_extracted
                    ORDER BY c.created_at DESC
                    """,
                    [str(user.supabase_user_id)],
                )
                rows = cursor.fetchall()

            claims = []
            for row in rows:
                (
                    claim_id,
                    claim_status,
                    created_at,
                    updated_at,
                    rejection_reason,
                    is_reapplied,
                    total_amount,
                    member_id,
                    member_name,
                    document_count,
                    documents_json,
                ) = row
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
                        'documentStatus': _infer_document_status(doc.get("review_status"), True),
                        'remarks': doc.get("review_remarks"),
                        # Keep list endpoint fast: fetch actual bytes only when user clicks View.
                        'viewUrl': f"/api/admin/claims/{claim_id}/documents/{doc_id}/download/" if doc_id else None,
                        'reuploadUrl': '/portal/claims/new',
                    })

                timeline = _serialize_timeline(claim_id)
                reapplied_event = next((event for event in reversed(timeline) if event['eventType'] == 'reapplied'), None)

                claims.append({
                    'id': str(claim_id),
                    'status': claim_status,
                    'submittedDate': created_at.isoformat() if created_at else None,
                    'updatedAt': updated_at.isoformat() if updated_at else None,
                    'totalAmount': float(total_amount) if total_amount is not None else 0.0,
                    'rejectionReason': rejection_reason,
                    'isReapplied': bool(is_reapplied or claim_status == 'reapplied'),
                    'member': {
                        'id': int(member_id) if member_id else None,
                        'name': member_name,
                    },
                    'documentCount': int(document_count or 0),
                    'documents': documents,
                    'timeline': timeline,
                    'changeSummary': (reapplied_event or {}).get('metadata', {}).get('changesSummary', []),
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

        # Disallow claim creation until policy is approved by admin
        if policy.status != 'approved':
            return Response({
                'detail': 'Policy must be approved by admin before creating claims'
            }, status=status.HTTP_400_BAD_REQUEST)

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
                INSERT INTO claims (
                    claim_id,
                    user_id,
                    policy_id,
                    member_id,
                    total_amount,
                    status,
                    is_reopened,
                    is_reapplied,
                    created_at,
                    updated_at
                )
                VALUES (gen_random_uuid(), %s::uuid, %s, %s, %s, 'pending', FALSE, FALSE, NOW(), NOW())
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

        upload_tasks = []
        for index, (field_name, bucket_name) in enumerate(document_buckets.items()):
            if field_name not in request.FILES:
                continue
            file_obj = request.FILES[field_name]
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_id = str(uuid.uuid4())[:8]
            file_extension = file_obj.name.split('.')[-1] if '.' in file_obj.name else 'pdf'
            file_path = f"{user.user_id}/{field_name}_{timestamp}_{unique_id}.{file_extension}"
            upload_tasks.append({
                'index': index,
                'field_name': field_name,
                'bucket_name': bucket_name,
                'filename': file_obj.name,
                'size': file_obj.size,
                'file_path': file_path,
                'file_bytes': file_obj.read(),
                'content_type': file_obj.content_type or 'application/octet-stream',
            })

        if not upload_tasks:
            transaction.set_rollback(True)
            return Response({
                'detail': 'No valid claim documents were provided'
            }, status=status.HTTP_400_BAD_REQUEST)

        def _upload_single_document(task):
            response = upload_to_bucket(
                task['bucket_name'],
                task['file_path'],
                task['file_bytes'],
                task['content_type'],
            )
            if response.status_code not in [200, 201]:
                raise RuntimeError(f"Failed to upload {task['field_name']}: {response.text}")
            return {
                **task,
                'file_url': f"{task['bucket_name']}/{task['file_path']}",
            }

        upload_results = []
        max_workers = min(4, len(upload_tasks))
        try:
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_map = {
                    executor.submit(_upload_single_document, task): task
                    for task in upload_tasks
                }
                for future in as_completed(future_map):
                    upload_results.append(future.result())
        except Exception as upload_error:
            raise RuntimeError(f'Error uploading claim documents: {str(upload_error)}')

        upload_results.sort(key=lambda item: item['index'])

        for uploaded in upload_results:
            document = ClaimDocument.objects.create(
                claim_id=claim.claim_id,
                document_type=uploaded['field_name'],
                file_url=uploaded['file_url'],
                file_path=uploaded['file_path'],
            )

            logger.info(f"Saved document {document.document_id} for claim {claim.claim_id}")

            uploaded_files.append({
                'document_id': str(document.document_id),
                'type': uploaded['field_name'],
                'filename': uploaded['filename'],
                'url': uploaded['file_url'],
                'size': uploaded['size'],
                'bucket': uploaded['bucket_name'],
            })

        if not uploaded_files:
            transaction.set_rollback(True)
            return Response({
                'detail': 'No valid claim documents were provided'
            }, status=status.HTTP_400_BAD_REQUEST)

        snapshot = _build_claim_snapshot(claim)
        _log_claim_event(claim, 'submitted', 'Claim submitted', {'snapshot': snapshot})
        _log_claim_event(claim, 'pending', 'Claim pending review', {'snapshot': snapshot})
        
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
        user = _get_request_user(request)
        if not user:
            return Response({'detail': 'User not authenticated or not found'}, status=status.HTTP_401_UNAUTHORIZED)

        claim_uuid = _uuid.UUID(str(claim_id))
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT claim_id, status
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
        current_claim_status = row[1]

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
                    'uploaded_at': timezone.now(),
                    'review_status': 'pending',
                    'review_remarks': None,
                    'reviewed_at': None,
                    'reviewed_by': None,
                }
            )

            # Reupload replaces the source document, so previous extraction output
            # for this claim + document type is no longer valid.
            ClaimExtractedField.objects.filter(
                claim_id=claim_uuid,
                document_type=field_name,
            ).delete()

            updated_docs.append({
                'document_id': str(doc.document_id),
                'document_type': field_name,
                'filename': file_obj.name,
                'bucket': bucket_name,
            })

        if not updated_docs:
            return Response({'detail': 'No valid reupload documents found'}, status=status.HTTP_400_BAD_REQUEST)

        if current_claim_status == 'rejected':
            Claim.objects.filter(claim_id=claim_uuid).update(updated_at=timezone.now())
        else:
            current_claim_status = _recompute_claim_status(str(claim_uuid))

        claim = Claim.objects.filter(claim_id=claim_uuid).first()
        if claim:
            _log_claim_event(
                claim,
                'edited',
                'Claim documents edited',
                {
                    'changesSummary': [
                        {
                            'field': f"document:{doc['document_type']}",
                            'label': f"{doc['document_type']} replaced",
                            'after': doc['filename'],
                        }
                        for doc in updated_docs
                    ],
                    'snapshot': _build_claim_snapshot(claim),
                }
            )

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
        requested_status = str(request.data.get('status', '')).lower()
        review_status = requested_status
        review_status = {
            'verified': 'approved',
            'issue': 'rejected',
            'missing': 'pending',
        }.get(review_status, review_status)
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
        claim = Claim.objects.filter(claim_id=claim_id).first()
        if not claim:
            return Response({'detail': 'Claim not found'}, status=status.HTTP_404_NOT_FOUND)
        if claim.status not in {'pending', 'reapplied'}:
            return Response({'detail': 'Finalized claims must be reopened before editing'}, status=status.HTTP_400_BAD_REQUEST)

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
            'document_status': 'missing' if requested_status == 'missing' else _infer_document_status(doc.review_status, True),
            'review_remarks': doc.review_remarks,
            'claim_status': claim_status,
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT'])
@permission_classes([IsSupabaseAuthenticated])
@transaction.atomic
def update_claim(request, claim_id):
    try:
        user = _get_request_user(request)
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
        claim = Claim.objects.filter(claim_id=claim_uuid).first()
        if not claim:
            return Response({'detail': 'Claim not found'}, status=status.HTTP_404_NOT_FOUND)
        before_snapshot = _build_claim_snapshot(claim)

        member_id = request.data.get('member_id')
        total_amount = request.data.get('total_amount')

        if member_id in (None, '') and total_amount in (None, ''):
            return Response({'detail': 'Nothing to update'}, status=status.HTTP_400_BAD_REQUEST)

        if member_id not in (None, ''):
            from .models import FamilyMember
            member = FamilyMember.objects.filter(id=member_id, policy=claim.policy).first()
            if not member:
                return Response({'detail': 'Family member not found for this policy'}, status=status.HTTP_404_NOT_FOUND)
            claim.member = member

        if total_amount not in (None, ''):
            try:
                claim.total_amount = total_amount
            except Exception:
                return Response({'detail': 'Invalid total_amount'}, status=status.HTTP_400_BAD_REQUEST)

        claim.updated_at = timezone.now()
        claim.save(update_fields=['member', 'total_amount', 'updated_at'])
        after_snapshot = _build_claim_snapshot(claim)
        changes_summary = _compute_change_summary(before_snapshot, after_snapshot)
        if changes_summary:
            _log_claim_event(
                claim,
                'edited',
                'Claim edited',
                {
                    'changesSummary': changes_summary,
                    'snapshot': after_snapshot,
                }
            )

        return Response({
            'claim_id': str(claim.claim_id),
            'status': claim.status,
            'total_amount': float(claim.total_amount) if claim.total_amount is not None else None,
            'member_id': claim.member_id,
            'member_name': claim.member.name if claim.member else 'Policy holder',
            'updated_at': claim.updated_at.isoformat() if claim.updated_at else None,
        }, status=status.HTTP_200_OK)
    except Exception as e:
        transaction.set_rollback(True)
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsSupabaseAuthenticated])
@transaction.atomic
def reapply_claim(request, claim_id):
    try:
        user = _get_request_user(request)
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
        claim = Claim.objects.filter(claim_id=claim_uuid).first()
        if not claim:
            return Response({'detail': 'Claim not found'}, status=status.HTTP_404_NOT_FOUND)
        if claim.status == 'reapplied':
            return Response({
                'claim_id': str(claim.claim_id),
                'status': claim.status,
                'is_reapplied': bool(claim.is_reapplied),
                'rejection_reason': claim.rejection_reason,
                'updated_at': claim.updated_at.isoformat() if claim.updated_at else None,
                'message': 'Claim already reapplied',
            }, status=status.HTTP_200_OK)
        if claim.status != 'rejected':
            return Response({'detail': 'Only rejected claims can be reapplied'}, status=status.HTTP_400_BAD_REQUEST)

        latest_rejected_event = ClaimEvent.objects.filter(
            claim_id=claim.claim_id,
            event_type='rejected'
        ).order_by('-created_at', '-id').first()
        current_snapshot = _build_claim_snapshot(claim)
        previous_snapshot = (latest_rejected_event.metadata or {}).get('snapshot') if latest_rejected_event else None
        changes_summary = _compute_change_summary(previous_snapshot, current_snapshot)

        claim.status = 'reapplied'
        claim.is_reapplied = True
        claim.updated_at = timezone.now()
        claim.save(update_fields=['status', 'is_reapplied', 'updated_at'])

        ClaimDocument.objects.filter(claim=claim).update(
            review_status='pending',
            review_remarks=None,
            reviewed_at=None,
            reviewed_by=None,
        )

        _log_claim_event(
            claim,
            'reapplied',
            'Claim reapplied',
            {
                'previousRejectionReason': claim.rejection_reason,
                'changesSummary': changes_summary,
                'snapshot': current_snapshot,
            }
        )
        _log_claim_event(
            claim,
            'pending',
            'Claim pending review',
            {
                'reapplied': True,
                'snapshot': current_snapshot,
            }
        )

        return Response({
            'claim_id': str(claim.claim_id),
            'status': claim.status,
            'is_reapplied': claim.is_reapplied,
            'rejection_reason': claim.rejection_reason,
            'changesSummary': changes_summary,
            'updated_at': claim.updated_at.isoformat() if claim.updated_at else None,
        }, status=status.HTTP_200_OK)
    except Exception as e:
        transaction.set_rollback(True)
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsSupabaseAuthenticated])
@transaction.atomic
def approve_claim(request, claim_id):
    try:
        admin_user = _get_admin_user(request)
        if not admin_user:
            return Response({'detail': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

        claim = Claim.objects.select_for_update().select_related('policy').filter(claim_id=claim_id).first()
        if not claim:
            return Response({'detail': 'Claim not found'}, status=status.HTTP_404_NOT_FOUND)

        policy = Policy.objects.select_for_update().filter(id=claim.policy_id).first()
        if not policy:
            return Response({'detail': 'Policy not found'}, status=status.HTTP_404_NOT_FOUND)

        if claim.status == 'approved':
            policy = _sync_policy_used_coverage(policy)
            claim_amount = Decimal(claim.total_amount or 0)
            return Response({
                'claim_id': str(claim.claim_id),
                'status': claim.status,
                'updated_at': claim.updated_at.isoformat() if claim.updated_at else None,
                'message': 'Claim already approved',
                'coverage_summary': {
                    **_serialize_policy_coverage(policy),
                    'requested_claim_amount': float(claim_amount),
                    'exceeds_remaining_coverage': False,
                },
            }, status=status.HTTP_200_OK)
        if claim.status not in {'pending', 'reapplied'}:
            return Response({'detail': 'Finalized claims must be reopened before approval'}, status=status.HTTP_400_BAD_REQUEST)

        claim_amount = Decimal(claim.total_amount or 0)
        policy = _sync_policy_used_coverage(policy)
        coverage_summary = _serialize_policy_coverage(policy)
        remaining_coverage = Decimal(str(coverage_summary['remaining_coverage_amount']))
        if claim_amount > remaining_coverage:
            return Response({
                'detail': 'Claim exceeds remaining coverage',
                'coverage_summary': {
                    **coverage_summary,
                    'requested_claim_amount': float(claim_amount),
                    'exceeds_remaining_coverage': True,
                },
            }, status=status.HTTP_400_BAD_REQUEST)

        claim.status = 'approved'
        claim.rejection_reason = None
        claim.updated_at = timezone.now()
        claim.save(update_fields=['status', 'rejection_reason', 'updated_at'])

        policy = _sync_policy_used_coverage(policy)

        ClaimDocument.objects.filter(claim_id=claim.claim_id).update(
            review_status='approved',
            review_remarks=None,
            reviewed_at=timezone.now(),
            reviewed_by=admin_user.email,
        )

        _log_claim_event(
            claim,
            'approved',
            'Claim approved',
            {'snapshot': _build_claim_snapshot(claim)}
        )

        return Response({
            'claim_id': str(claim.claim_id),
            'status': claim.status,
            'updated_at': claim.updated_at.isoformat() if claim.updated_at else None,
            'coverage_summary': {
                **_serialize_policy_coverage(policy),
                'requested_claim_amount': float(claim_amount),
                'exceeds_remaining_coverage': False,
            },
        }, status=status.HTTP_200_OK)
    except Exception as e:
        transaction.set_rollback(True)
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsSupabaseAuthenticated])
@transaction.atomic
def reject_claim(request, claim_id):
    try:
        admin_user = _get_admin_user(request)
        if not admin_user:
            return Response({'detail': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

        rejection_reason = str(request.data.get('reason') or request.data.get('rejection_reason') or '').strip()
        if not rejection_reason:
            return Response({'detail': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        claim = Claim.objects.filter(claim_id=claim_id).first()
        if not claim:
            return Response({'detail': 'Claim not found'}, status=status.HTTP_404_NOT_FOUND)
        if claim.status not in {'pending', 'reapplied'}:
            return Response({'detail': 'Finalized claims must be reopened before rejection'}, status=status.HTTP_400_BAD_REQUEST)

        claim.status = 'rejected'
        claim.rejection_reason = rejection_reason
        claim.updated_at = timezone.now()
        claim.save(update_fields=['status', 'rejection_reason', 'updated_at'])

        ClaimDocument.objects.filter(claim_id=claim.claim_id).update(
            review_status='rejected',
            review_remarks=rejection_reason,
            reviewed_at=timezone.now(),
            reviewed_by=admin_user.email,
        )

        _log_claim_event(
            claim,
            'rejected',
            'Claim rejected',
            {
                'reason': rejection_reason,
                'snapshot': _build_claim_snapshot(claim),
            }
        )

        return Response({
            'claim_id': str(claim.claim_id),
            'status': claim.status,
            'rejection_reason': claim.rejection_reason,
            'updated_at': claim.updated_at.isoformat() if claim.updated_at else None,
        }, status=status.HTTP_200_OK)
    except Exception as e:
        transaction.set_rollback(True)
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsSupabaseAuthenticated])
@transaction.atomic
def reopen_claim(request, claim_id):
    try:
        admin_user = _get_admin_user(request)
        if not admin_user:
            return Response({'detail': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

        reopen_reason = str(request.data.get('reason') or request.data.get('reopen_reason') or '').strip()
        if not reopen_reason:
            return Response({'detail': 'Reason for reopening is required'}, status=status.HTTP_400_BAD_REQUEST)

        claim = Claim.objects.select_for_update().select_related('policy').filter(claim_id=claim_id).first()
        if not claim:
            return Response({'detail': 'Claim not found'}, status=status.HTTP_404_NOT_FOUND)

        if claim.status not in {'approved', 'rejected'}:
            return Response({'detail': 'Only approved or rejected claims can be reopened'}, status=status.HTTP_400_BAD_REQUEST)

        policy = Policy.objects.select_for_update().filter(id=claim.policy_id).first()
        if not policy:
            return Response({'detail': 'Policy not found'}, status=status.HTTP_404_NOT_FOUND)

        claim_amount = Decimal(claim.total_amount or 0)
        previous_status = claim.status

        claim.status = 'pending'
        claim.is_reopened = True
        claim.reopen_reason = reopen_reason
        claim.reopened_at = timezone.now()
        claim.updated_at = claim.reopened_at
        claim.save(update_fields=['status', 'is_reopened', 'reopen_reason', 'reopened_at', 'updated_at'])

        policy = _sync_policy_used_coverage(policy)

        _log_claim_event(
            claim,
            'reopened',
            'Claim reopened for correction',
            {
                'reason': reopen_reason,
                'previousStatus': previous_status,
                'snapshot': _build_claim_snapshot(claim),
            }
        )

        return Response({
            'claim_id': str(claim.claim_id),
            'status': claim.status,
            'is_reopened': claim.is_reopened,
            'reopen_reason': claim.reopen_reason,
            'reopened_at': claim.reopened_at.isoformat() if claim.reopened_at else None,
            'updated_at': claim.updated_at.isoformat() if claim.updated_at else None,
            'coverage_summary': {
                **_serialize_policy_coverage(policy),
                'requested_claim_amount': float(claim_amount),
                'exceeds_remaining_coverage': False,
            },
        }, status=status.HTTP_200_OK)
    except Exception as e:
        transaction.set_rollback(True)
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
@permission_classes([IsSupabaseAuthenticated])
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
                    c.rejection_reason,
                    c.is_reopened,
                    c.reopen_reason,
                    c.reopened_at,
                    c.is_reapplied,
                    c.updated_at,
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

        claim_id, user_uuid, policy_id, claim_status, rejection_reason, is_reopened, reopen_reason, reopened_at, is_reapplied, updated_at, created_at, total_amount, name, full_name, email, policy_number = claim_row
        claim_obj = Claim.objects.filter(claim_id=claim_id).select_related('member').first()
        policy_obj = Policy.objects.filter(id=policy_id).first()
        
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
                    'document_status': _infer_document_status(review_status or 'pending', True),
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
        expected_document_types = _get_expected_document_types(claim_obj) if claim_obj else []
        existing_document_types = {doc['document_type'] for doc in document_data}
        for missing_document_type in expected_document_types:
            if missing_document_type in existing_document_types:
                continue
            document_data.append({
                'document_id': f'missing:{missing_document_type}',
                'document_type': missing_document_type,
                'signed_url': None,
                'file_url': None,
                'file_path': None,
                'uploaded_at': None,
                'upload_date': None,
                'original_filename': None,
                'bucket_name': _get_bucket_name_for_document_type(missing_document_type),
                'review_status': 'pending',
                'document_status': 'missing',
                'review_remarks': 'Document not uploaded',
                'reviewed_at': None,
                'reviewed_by': None,
                'is_missing': True,
            })
        
        # Get ML extraction data (cached only, do not block review response)
        ml_extraction_data = {}
        try:
            latest_uploads = _get_latest_document_upload_map(claim_id)
            cached_fields = ClaimExtractedField.objects.filter(claim_id=claim_id)
            if cached_fields.exists():
                grouped_data = {}
                for field in cached_fields:
                    doc_type = field.document_type
                    latest_upload = latest_uploads.get(doc_type)
                    if latest_upload and field.created_at and field.created_at < latest_upload:
                        continue
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

        timeline = _serialize_timeline(claim_id)
        reapplied_event = next((event for event in reversed(timeline) if event['eventType'] == 'reapplied'), None)

        smart_assist = []
        for doc in document_data:
            if doc.get('document_status') == 'missing':
                smart_assist.append({
                    'type': 'missing_document',
                    'label': f"Missing {doc['document_type']}",
                })

        extraction_documents = ml_extraction_data.get('documents', {}) if isinstance(ml_extraction_data, dict) else {}
        for document_type, fields in extraction_documents.items():
            for field in fields:
                confidence = float(field.get('confidence') or 0)
                if confidence < 0.8:
                    smart_assist.append({
                        'type': 'low_confidence',
                        'label': f"Low confidence in {field.get('field_name')} from {document_type}",
                        'confidence': confidence,
                    })
                if field.get('field_name') == 'total_amount' and total_amount is not None:
                    extracted_amount = str(field.get('value') or '')
                    normalized_extracted = ''.join(ch for ch in extracted_amount if ch.isdigit() or ch == '.')
                    normalized_claim = str(total_amount)
                    if normalized_extracted and normalized_claim and normalized_extracted != normalized_claim:
                        smart_assist.append({
                            'type': 'amount_mismatch',
                            'label': f"Claim amount {normalized_claim} differs from extracted amount {normalized_extracted}",
                        })
                        break

        # Return basic claim and document data with ML extraction
        return Response({
            'claim_id': str(claim_id),
            'claim_status': claim_status,
            'rejection_reason': rejection_reason,
            'is_reopened': bool(is_reopened),
            'reopen_reason': reopen_reason,
            'reopened_at': reopened_at.isoformat() if reopened_at else None,
            'is_reapplied': bool(is_reapplied or claim_status == 'reapplied'),
            'updated_at': updated_at.isoformat() if updated_at else None,
            'total_amount': str(total_amount) if total_amount is not None else '0',
            'created_at': created_at.isoformat() if created_at else None,
            'user_name': user_name,
            'user_email': email,
            'policy_id': str(policy_id),
            'policy_number': policy_number,
            'coverage_summary': {
                **(_serialize_policy_coverage(policy_obj) if policy_obj else {'total_coverage_amount': 0.0, 'used_coverage_amount': 0.0, 'remaining_coverage_amount': 0.0}),
                'requested_claim_amount': float(total_amount) if total_amount is not None else 0.0,
                'exceeds_remaining_coverage': bool(
                    policy_obj and total_amount is not None and Decimal(total_amount) > max(Decimal(policy_obj.total_coverage_amount or 0) - Decimal(policy_obj.used_coverage_amount or 0), Decimal('0'))
                ),
            },
            'documents': document_data,
            'document_count': len(document_data),
            'ml_extraction': ml_extraction_data,
            'timeline': timeline,
            'changes_summary': (reapplied_event or {}).get('metadata', {}).get('changesSummary', []),
            'smart_assist': smart_assist,
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
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
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
        except Exception as fallback_error:
            logger.warning(f"Fallback URL generation failed: {str(fallback_error)}")
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


