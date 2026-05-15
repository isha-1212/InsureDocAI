import uuid
from datetime import date, timedelta

from django.test import TestCase
from rest_framework.test import APIRequestFactory

from api.models import FamilyMember, Policy, PolicyEvent
from api.views import FamilyMemberViewSet, PolicyViewSet
from users.models import User


class PolicyWorkflowTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = User.objects.create(
            email="admin@example.com",
            role="admin",
            supabase_user_id=uuid.uuid4(),
        )
        self.user = User.objects.create(
            email="user@example.com",
            role="user",
            supabase_user_id=uuid.uuid4(),
        )
        self.policy = Policy.objects.create(
            user=self.user,
            policy_number="INS-2026-FAM-123456",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            policy_document_url="https://example.com/policy.pdf",
            status="approved",
            total_coverage_amount=500000,
        )

    def _attach_auth(self, request, user):
        request.is_authenticated = True
        request.user_id = user.supabase_user_id
        request.email = user.email
        request.role = user.role
        return request

    def test_admin_can_reopen_approved_policy(self):
        request = self.factory.post(f"/api/policies/{self.policy.id}/reopen/", {"reason": "Fix coverage"})
        self._attach_auth(request, self.admin)

        response = PolicyViewSet.as_view({"post": "reopen"})(request, pk=self.policy.id)

        self.assertEqual(response.status_code, 200)
        self.policy.refresh_from_db()
        self.assertEqual(self.policy.status, "under_review")

        event = PolicyEvent.objects.filter(policy=self.policy).latest("id")
        self.assertEqual(event.event_type, "reopened")
        self.assertEqual(event.metadata.get("reason"), "Fix coverage")

    def test_approved_policy_cannot_be_directly_reapproved(self):
        request = self.factory.post(
            f"/api/policies/{self.policy.id}/update_status/",
            {"status": "approved", "total_coverage_amount": 600000},
            format="json",
        )
        self._attach_auth(request, self.admin)

        response = PolicyViewSet.as_view({"post": "update_status"})(request, pk=self.policy.id)

        self.assertEqual(response.status_code, 400)
        self.policy.refresh_from_db()
        self.assertEqual(float(self.policy.total_coverage_amount), 500000.0)
        self.assertEqual(self.policy.status, "approved")

    def test_family_member_create_blocked_when_policy_is_approved(self):
        request = self.factory.post(
            "/api/family-members/",
            {"name": "Child One", "relation": "child"},
            format="json",
        )
        self._attach_auth(request, self.user)

        response = FamilyMemberViewSet.as_view({"post": "create"})(request)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(FamilyMember.objects.count(), 0)
