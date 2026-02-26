from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError
from api.supabase_client import upload_to_policies_bucket, upload_to_bucket, create_signed_url, get_public_url
from api.models import Policy, FamilyMember
from api.models_document import PolicyDocument
from api.serializers import DocumentUploadSerializer, PolicyDocumentSerializer
from users.models import User
import uuid
from datetime import datetime


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_policy_document(request):
    # Debug authentication
    if not hasattr(request, 'is_authenticated') or not request.is_authenticated:
        return Response(
            {'error': 'Authentication required', 'debug': 'No valid JWT token'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Debug file upload
    if 'file' not in request.FILES:
        return Response(
            {'error': 'No file provided', 'debug': f'Available files: {list(request.FILES.keys())}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    file = request.FILES['file']
    
    allowed_types = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if file.content_type not in allowed_types:
        return Response(
            {'error': 'Invalid file type. Only PDF, JPG, and PNG are allowed.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if file.size > 5 * 1024 * 1024:
        return Response(
            {'error': 'File too large. Maximum size is 5MB.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    policy_number = request.data.get('policy_number')
    start_date = request.data.get('start_date')
    end_date = request.data.get('end_date')
    
    # Debug required fields
    if not all([policy_number, start_date, end_date]):
        missing_fields = []
        if not policy_number: missing_fields.append('policy_number')
        if not start_date: missing_fields.append('start_date') 
        if not end_date: missing_fields.append('end_date')
        return Response(
            {
                'error': 'Missing required fields',
                'debug': f'Missing: {missing_fields}',
                'received_data': {k: v for k, v in request.data.items() if k != 'file'}
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        supabase_user_id = request.user_id
        email = getattr(request, 'email', None)

        user = None
        if supabase_user_id:
            try:
                user = User.objects.get(supabase_user_id=supabase_user_id)
            except User.DoesNotExist:
                user = None

        if user is None and email:
            try:
                user = User.objects.get(email=email)
                if supabase_user_id and not user.supabase_user_id:
                    user.supabase_user_id = supabase_user_id
                    user.save(update_fields=['supabase_user_id'])
            except User.DoesNotExist:
                if supabase_user_id:
                    user = User.objects.create(
                        supabase_user_id=supabase_user_id,
                        email=email,
                    )

        if user is None:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if hasattr(user, 'policy'):
            return Response(
                {'error': 'You already have a policy registered'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if policy number already exists
        existing_policy = Policy.objects.filter(policy_number=policy_number).first()
        if existing_policy:
            return Response(
                {
                    'error': 'Policy number already exists',
                    'detail': f'A policy with number {policy_number} already exists in the system.',
                    'suggestion': 'Please check your policy number and try again with a different number.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create policy record first
        policy = Policy.objects.create(
            user=user,
            policy_number=policy_number,
            start_date=start_date,
            end_date=end_date,
            policy_document_url='',  # Will be empty, we store metadata instead
            status='pending'
        )
        
        # Generate file path: user_<user_id>/policies/<policy_id>/<uuid>.<ext>
        # Use user.user_id (the database primary key) for the path
        file_ext = file.name.split('.')[-1]
        random_uuid = uuid.uuid4().hex
        file_path = f"user_{user.user_id}/policies/{policy.id}/{random_uuid}.{file_ext}"
        
        # Upload to Supabase Storage via REST using service_role key
        file_bytes = file.read()

        upload_response = upload_to_policies_bucket(
            file_path=file_path,
            file_bytes=file_bytes,
            content_type=file.content_type,
        )

        # Check for upload errors
        if not upload_response.ok:
            # Rollback policy creation
            policy.delete()
            try:
                detail = upload_response.json()
            except Exception:
                detail = upload_response.text
            return Response(
                {
                    'error': 'Storage upload failed',
                    'detail': detail,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        # Store file metadata in database
        policy_doc = PolicyDocument.objects.create(
            user=user,
            policy=policy,
            family_member=None,  # Policy document has no family member
            document_type='POLICY',  # This is a policy document
            belongs_to_relation='self',  # Policy belongs to the account holder
            bucket_name='policies',
            file_path=file_path,
            file_size=file.size,
            content_type=file.content_type
        )
        
        return Response({
            'success': True,
            'message': 'Policy and document uploaded successfully',
            'policy_id': policy.id,
            'policy_number': policy.policy_number,
            'status': policy.status
        }, status=status.HTTP_201_CREATED)
        
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except IntegrityError as e:
        # Handle database integrity errors (like duplicate policy numbers)
        error_message = str(e)
        if 'duplicate key' in error_message.lower() and 'policy_number' in error_message:
            return Response(
                {
                    'error': 'Policy number already exists',
                    'detail': 'This policy number is already registered in the system.',
                    'suggestion': 'Please check your policy number and try again with a different number.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        else:
            return Response(
                {
                    'error': 'Database constraint violation',
                    'detail': 'The submitted data conflicts with existing records.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        # Rollback policy if it was created
        if 'policy' in locals():
            policy.delete()
        
        return Response(
            {'error': str(e), 'message': 'Failed to upload file'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_policy_document(request, policy_id):
    """
    Get signed URL for policy document
    SECURE: Verifies user owns the policy before generating URL
    
    Returns a time-limited signed URL (5 minutes)
    """
    # Check authentication
    if not hasattr(request, 'is_authenticated') or not request.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    try:
        supabase_user_id = request.user_id
        email = getattr(request, 'email', None)

        user = None
        if supabase_user_id:
            try:
                user = User.objects.get(supabase_user_id=supabase_user_id)
            except User.DoesNotExist:
                user = None

        if user is None and email:
            try:
                user = User.objects.get(email=email)
                if supabase_user_id and not user.supabase_user_id:
                    user.supabase_user_id = supabase_user_id
                    user.save(update_fields=['supabase_user_id'])
            except User.DoesNotExist:
                if supabase_user_id:
                    user = User.objects.create(
                        supabase_user_id=supabase_user_id,
                        email=email,
                    )

        if user is None:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get policy - admins can view any policy, users only their own
        try:
            if hasattr(user, 'role') and user.role == 'admin':
                # Admin can access any policy
                policy = Policy.objects.get(id=policy_id)
            else:
                # Regular user can only access their own policy
                policy = Policy.objects.get(id=policy_id, user=user)
        except Policy.DoesNotExist:
            return Response(
                {'error': 'Policy not found or you do not have access'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get document metadata - specifically the POLICY document type
        try:
            policy_doc = PolicyDocument.objects.get(
                policy=policy,
                document_type='POLICY'
            )
        except PolicyDocument.DoesNotExist:
            return Response(
                {'error': 'No document found for this policy'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        file_name = policy_doc.file_path.split('/')[-1]
        download_url = f"http://localhost:8000/api/download-policy-document/{policy.id}/"
        
        return Response({
            'success': True,
            'signed_url': download_url,  # Frontend expects this field
            'expires_in': 0,  # No expiration for our backend-proxied URLs
            'file_name': file_name,
            'content_type': policy_doc.content_type or 'application/octet-stream'
        }, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Policy.DoesNotExist:
        return Response(
            {'error': 'Policy not found or you do not have access'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e), 'message': 'Failed to get document'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def download_policy_document(request, policy_id):
    """
    Download policy document file with authentication
    
    This endpoint serves the actual file bytes for private bucket documents.
    Uses service_role authentication to retrieve files from Supabase Storage.
    """
    # Check authentication
    if not hasattr(request, 'is_authenticated') or not request.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    try:
        supabase_user_id = request.user_id
        email = getattr(request, 'email', None)

        user = None
        if supabase_user_id:
            try:
                user = User.objects.get(supabase_user_id=supabase_user_id)
            except User.DoesNotExist:
                user = None

        if user is None and email:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                pass

        if user is None:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get policy - admins can view any policy, users only their own
        try:
            if hasattr(user, 'role') and user.role == 'admin':
                policy = Policy.objects.get(id=policy_id)
            else:
                policy = Policy.objects.get(id=policy_id, user=user)
        except Policy.DoesNotExist:
            return Response(
                {'error': 'Policy not found or you do not have access'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get document metadata
        try:
            policy_doc = PolicyDocument.objects.get(
                policy=policy,
                document_type='POLICY'
            )
        except PolicyDocument.DoesNotExist:
            return Response(
                {'error': 'No document found for this policy'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Use the stored file path directly from database
        file_name = policy_doc.file_path.split('/')[-1]
        
        # Download file with authentication
        from api.supabase_client import download_file_authenticated
        from django.http import HttpResponse
        
        file_response = download_file_authenticated(
            bucket=policy_doc.bucket_name,
            file_path=policy_doc.file_path  # Use the exact path stored in the database
        )
        
        if file_response.ok:
            # Return the file as HTTP response
            response = HttpResponse(
                file_response.content,
                content_type=policy_doc.content_type or file_response.headers.get('Content-Type', 'application/octet-stream')
            )
            response['Content-Disposition'] = f'inline; filename="{file_name}"'
            response['Cache-Control'] = 'private, max-age=3600'
            return response
        else:
            return Response(
                {'error': 'File not found in storage'},
                status=status.HTTP_404_NOT_FOUND
            )
            
    except Exception as e:
        return Response(
            {'error': str(e), 'message': 'Failed to download document'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_document_for_member(request):
    """
    Upload document for a family member with business rule validation
    
    Business Rules:
    - If family member is minor: PAN/Aadhaar must belong to parent (father/mother)
    - If family member is adult: All documents must belong to self
    - Documents routed to correct bucket based on document_type
    
    Required fields:
    - file: Document file (PDF/JPG/PNG, max 5MB)
    - policy_id: Policy ID
    - document_type: PAN, AADHAAR, HOSPITAL_BILL, PHARMACY_BILL, POLICY
    - belongs_to_relation: self, father, mother
    - family_member_id: (optional) Family member ID
    """
    # Check authentication
    if not hasattr(request, 'is_authenticated') or not request.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Resolve user from Supabase JWT
    supabase_user_id = request.user_id
    email = getattr(request, 'email', None)

    user = None
    if supabase_user_id:
        try:
            user = User.objects.get(supabase_user_id=supabase_user_id)
        except User.DoesNotExist:
            user = None

    if user is None and email:
        try:
            user = User.objects.get(email=email)
            if supabase_user_id and not user.supabase_user_id:
                user.supabase_user_id = supabase_user_id
                user.save(update_fields=['supabase_user_id'])
        except User.DoesNotExist:
            if supabase_user_id:
                user = User.objects.create(
                    supabase_user_id=supabase_user_id,
                    email=email,
                )

    if user is None:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Validate with serializer
    serializer = DocumentUploadSerializer(data=request.data, context={'user': user})
    if not serializer.is_valid():
        return Response(
            {'error': 'Validation failed', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    validated_data = serializer.validated_data
    policy = validated_data['policy']
    family_member = validated_data.get('family_member')
    document_type = validated_data['document_type']
    belongs_to_relation = validated_data['belongs_to_relation']
    file = validated_data['file']
    
    # Determine bucket based on document type
    bucket_mapping = {
        'PAN': 'pan',
        'AADHAAR': 'aadhaar',
        'HOSPITAL_BILL': 'hospital_bills',
        'PHARMACY_BILL': 'pharmacy_bills',
        'POLICY': 'policies',
    }
    bucket_name = bucket_mapping.get(document_type, 'policies')
    
    # Generate file path: user_<user_id>/<document_type>/<policy_id>/<family_member_id>/<uuid>.<ext>
    file_ext = file.name.split('.')[-1] if '.' in file.name else 'jpg'
    random_uuid = uuid.uuid4().hex
    
    if family_member:
        file_path = f"user_{user.user_id}/{document_type}/{policy.id}/{family_member.id}/{random_uuid}.{file_ext}"
    else:
        file_path = f"user_{user.user_id}/{document_type}/{policy.id}/self/{random_uuid}.{file_ext}"
    
    try:
        # Upload to Supabase Storage
        file_bytes = file.read()
        
        upload_response = upload_to_bucket(
            bucket_name=bucket_name,
            file_path=file_path,
            file_bytes=file_bytes,
            content_type=file.content_type,
        )
        
        # Check for upload errors
        if not upload_response.ok:
            try:
                detail = upload_response.json()
            except Exception:
                detail = upload_response.text
            return Response(
                {
                    'error': 'Storage upload failed',
                    'detail': detail,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        # Store metadata in database
        policy_doc = PolicyDocument.objects.create(
            user=user,
            policy=policy,
            family_member=family_member,
            document_type=document_type,
            belongs_to_relation=belongs_to_relation,
            bucket_name=bucket_name,
            file_path=file_path,
            file_size=file.size,
            content_type=file.content_type
        )
        
        return Response({
            'success': True,
            'message': 'Document uploaded successfully',
            'document_id': policy_doc.id,
            'document_type': document_type,
            'belongs_to_relation': belongs_to_relation,
            'family_member': family_member.name if family_member else 'Policy Holder',
            'bucket': bucket_name,
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response(
            {'error': str(e), 'message': 'Failed to upload document'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_documents_for_member(request, policy_id, family_member_id=None):
    """
    Get documents for a family member with signed URLs
    
    Business Logic:
    - If member is minor: Fetch parent PAN/Aadhaar using belongs_to_relation
    - If member is adult: Fetch self documents
    - Always verify policy ownership before returning data
    - Generate signed URLs (5 minutes) using service_role
    
    Query params:
    - document_type: (optional) Filter by specific document type
    """
    # Check authentication
    if not hasattr(request, 'is_authenticated') or not request.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Resolve user
    supabase_user_id = request.user_id
    email = getattr(request, 'email', None)

    user = None
    if supabase_user_id:
        try:
            user = User.objects.get(supabase_user_id=supabase_user_id)
        except User.DoesNotExist:
            user = None

    if user is None and email:
        try:
            user = User.objects.get(email=email)
            if supabase_user_id and not user.supabase_user_id:
                user.supabase_user_id = supabase_user_id
                user.save(update_fields=['supabase_user_id'])
        except User.DoesNotExist:
            if supabase_user_id:
                user = User.objects.create(
                    supabase_user_id=supabase_user_id,
                    email=email,
                )

    if user is None:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    try:
        # Verify policy ownership
        policy = Policy.objects.get(id=policy_id, user=user)
        
        # Get documents based on family member
        if family_member_id:
            try:
                family_member = FamilyMember.objects.get(id=family_member_id, policy=policy)
            except FamilyMember.DoesNotExist:
                return Response(
                    {'error': 'Family member not found in this policy'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Query documents
            documents = PolicyDocument.objects.filter(
                policy=policy,
                family_member=family_member
            )
        else:
            # Get documents for policy holder (no family member)
            documents = PolicyDocument.objects.filter(
                policy=policy,
                family_member__isnull=True
            )
        
        # Filter by document type if specified
        document_type = request.query_params.get('document_type')
        if document_type:
            documents = documents.filter(document_type=document_type.upper())
        
        # Generate signed URLs for each document
        documents_with_urls = []
        for doc in documents:
            try:
                signed_url_response = create_signed_url(
                    bucket=doc.bucket_name,
                    file_path=doc.file_path,
                    expires_in=300,
                )
                signed_url = signed_url_response.get('signedURL') or signed_url_response.get('signed_url')
                
                doc_data = PolicyDocumentSerializer(doc).data
                doc_data['signed_url'] = signed_url
                doc_data['expires_in'] = 300
                documents_with_urls.append(doc_data)
            except Exception as e:
                # Log error but continue with other documents
                print(f"Error generating signed URL for document {doc.id}: {str(e)}")
                continue
        
        return Response({
            'success': True,
            'policy_id': policy.id,
            'family_member_id': family_member_id,
            'documents': documents_with_urls,
            'count': len(documents_with_urls)
        }, status=status.HTTP_200_OK)
        
    except Policy.DoesNotExist:
        return Response(
            {'error': 'Policy not found or you do not have access'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e), 'message': 'Failed to fetch documents'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_parent_documents_for_minor(request, policy_id, family_member_id):
    """
    Get parent documents (PAN/Aadhaar) for a minor family member
    
    This endpoint specifically handles fetching parent identity documents
    when processing claims for minor family members.
    
    Returns documents marked as belonging to 'father' or 'mother' for the policy.
    """
    # Check authentication
    if not hasattr(request, 'is_authenticated') or not request.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Resolve user
    supabase_user_id = request.user_id
    email = getattr(request, 'email', None)

    user = None
    if supabase_user_id:
        try:
            user = User.objects.get(supabase_user_id=supabase_user_id)
        except User.DoesNotExist:
            user = None

    if user is None and email:
        try:
            user = User.objects.get(email=email)
            if supabase_user_id and not user.supabase_user_id:
                user.supabase_user_id = supabase_user_id
                user.save(update_fields=['supabase_user_id'])
        except User.DoesNotExist:
            if supabase_user_id:
                user = User.objects.create(
                    supabase_user_id=supabase_user_id,
                    email=email,
                )

    if user is None:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    try:
        # Verify policy ownership
        policy = Policy.objects.get(id=policy_id, user=user)
        
        # Verify family member exists and is a minor
        try:
            family_member = FamilyMember.objects.get(id=family_member_id, policy=policy)
        except FamilyMember.DoesNotExist:
            return Response(
                {'error': 'Family member not found in this policy'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if not family_member.is_minor:
            return Response(
                {'error': 'This endpoint is only for minor family members'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Fetch parent documents (PAN/Aadhaar belonging to father or mother)
        parent_documents = PolicyDocument.objects.filter(
            policy=policy,
            family_member=family_member,
            document_type__in=['PAN', 'AADHAAR'],
            belongs_to_relation__in=['father', 'mother']
        )
        
        if not parent_documents.exists():
            return Response(
                {
                    'success': True,
                    'message': 'No parent documents found for this minor member',
                    'documents': []
                },
                status=status.HTTP_200_OK
            )
        
        # Generate signed URLs
        documents_with_urls = []
        for doc in parent_documents:
            try:
                signed_url_response = create_signed_url(
                    bucket=doc.bucket_name,
                    file_path=doc.file_path,
                    expires_in=300,
                )
                signed_url = signed_url_response.get('signedURL') or signed_url_response.get('signed_url')
                
                doc_data = PolicyDocumentSerializer(doc).data
                doc_data['signed_url'] = signed_url
                doc_data['expires_in'] = 300
                documents_with_urls.append(doc_data)
            except Exception as e:
                print(f"Error generating signed URL for document {doc.id}: {str(e)}")
                continue
        
        return Response({
            'success': True,
            'policy_id': policy.id,
            'family_member_id': family_member_id,
            'family_member_name': family_member.name,
            'is_minor': family_member.is_minor,
            'documents': documents_with_urls,
            'count': len(documents_with_urls)
        }, status=status.HTTP_200_OK)
        
    except Policy.DoesNotExist:
        return Response(
            {'error': 'Policy not found or you do not have access'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e), 'message': 'Failed to fetch parent documents'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
