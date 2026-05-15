"""
API URLs - Industry Standard Structure
Policy Management & Family Members
"""
from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import PolicyViewSet, FamilyMemberViewSet
from .views_upload import (
    upload_policy_document, 
    get_policy_document,
    download_policy_document,
    upload_document_for_member,
    get_documents_for_member,
    get_parent_documents_for_minor
)
from .views_claim import (
    create_claim,
    admin_review_claim,
    download_claim_document,
    reupload_claim_documents,
    review_claim_document,
    update_claim,
    reapply_claim,
    approve_claim,
    reject_claim,
    reopen_claim,
)
from .views_ml_extraction import ClaimExtractionAPIView, ClaimDocumentExtractionAPIView

from .views_admin import get_claims_for_review, create_test_data, admin_overview, admin_recent, validate_claim_fields

app_name = 'api'

# REST API Router
router = SimpleRouter()
router.register(r'policies', PolicyViewSet, basename='policy')
router.register(r'family-members', FamilyMemberViewSet, basename='family-member')

urlpatterns = [
    # File upload/download endpoints - SECURE: Only backend can access Supabase Storage
    path('upload-policy-document/', upload_policy_document, name='upload-policy-document'),
    path('get-policy-document/<int:policy_id>/', get_policy_document, name='get-policy-document'),
    path('download-policy-document/<int:policy_id>/', download_policy_document, name='download-policy-document'),
    
    # Document management for family members (with minor business rules)
    path('upload-document/', upload_document_for_member, name='upload-document-for-member'),
    path('documents/<int:policy_id>/', get_documents_for_member, name='get-documents-for-member'),
    path('documents/<int:policy_id>/<int:family_member_id>/', get_documents_for_member, name='get-documents-for-member-specific'),
    path('documents/parent/<int:policy_id>/<int:family_member_id>/', get_parent_documents_for_minor, name='get-parent-documents-for-minor'),
    
    # Claims endpoints
    path('claims/', create_claim, name='create-claim'),
    path('claims/<str:claim_id>/', update_claim, name='update-claim'),
    path('claims/<str:claim_id>/reapply/', reapply_claim, name='reapply-claim'),
    path('claims/<str:claim_id>/reupload/', reupload_claim_documents, name='reupload-claim-documents'),
    path('admin/claims/', get_claims_for_review, name='get-claims-for-review'),
    path('admin/claims/create-test-data/', create_test_data, name='create-test-data'),
    path('admin/claims/<str:claim_id>/approve/', approve_claim, name='approve-claim'),
    path('admin/claims/<str:claim_id>/reject/', reject_claim, name='reject-claim'),
    path('admin/claims/<str:claim_id>/reopen/', reopen_claim, name='reopen-claim'),
    path('admin/claims/<str:claim_id>/review/', admin_review_claim, name='admin-review-claim'),
    path('admin/claims/<str:claim_id>/documents/<str:document_id>/download/', download_claim_document, name='download-claim-document'),
    path('admin/claims/<str:claim_id>/documents/<str:document_id>/review/', review_claim_document, name='review-claim-document'),
    
    # ML Extraction endpoint
    path('admin/claims/<str:claim_id>/extract/', ClaimExtractionAPIView.as_view(), name='claim-ml-extraction'),
    path('admin/claims/<str:claim_id>/documents/<str:document_id>/extract/', ClaimDocumentExtractionAPIView.as_view(), name='claim-document-ml-extraction'),
    path('admin/claims/<str:claim_id>/validate/', validate_claim_fields, name='validate-claim-fields'),
    path('admin/overview/', admin_overview, name='admin-overview'),
    path('admin/recent/', admin_recent, name='admin-recent'),
    
    # REST API endpoints
    path('', include(router.urls)),
]

"""
Available endpoints:

POLICIES:
GET    /api/policies/                    - List all policies (admin) or user's policy (user)
POST   /api/policies/                    - Create new policy
GET    /api/policies/{id}/               - Get policy details
PUT    /api/policies/{id}/               - Update policy
PATCH  /api/policies/{id}/               - Partial update policy
DELETE /api/policies/{id}/               - Delete policy
GET    /api/policies/my_policy/          - Get current user's policy
POST   /api/policies/{id}/update_status/ - Admin: Approve/reject policy
GET    /api/policies/pending/            - Admin: Get all pending policies
GET    /api/policies/all_families/       - Admin: See all users with their policies

FAMILY MEMBERS:
GET    /api/family-members/              - List family members
POST   /api/family-members/              - Add family member
GET    /api/family-members/{id}/         - Get member details
PUT    /api/family-members/{id}/         - Update member
PATCH  /api/family-members/{id}/         - Partial update member
DELETE /api/family-members/{id}/         - Remove member
"""
