from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
import logging

from .models import Policy, PolicyEvent, FamilyMember
from users.models import User
from auth_service.permissions import IsUser
from .serializers import (
    PolicySerializer,
    PolicyCreateSerializer,
    PolicyUpdateSerializer,
    PolicyStatusUpdateSerializer,
    PolicyListSerializer,
    FamilyMemberSerializer,
    FamilyMemberCreateSerializer,
    UserWithPolicySerializer,
)

logger = logging.getLogger(__name__)


# =========================
# Helper function
# =========================

def get_authenticated_user(request):
    supabase_user_id = getattr(request, "user_id", None)
    email = getattr(request, "email", None)
    role = getattr(request, "role", "user") or "user"

    if supabase_user_id:
        try:
            return User.objects.get(supabase_user_id=supabase_user_id)
        except User.DoesNotExist:
            pass

    if email:
        try:
            user = User.objects.get(email=email)
            update_fields = []
            if supabase_user_id and not user.supabase_user_id:
                user.supabase_user_id = supabase_user_id
                update_fields.append("supabase_user_id")
            if role == "admin" and user.role != "admin":
                user.role = "admin"
                update_fields.append("role")
            if update_fields:
                user.save(update_fields=update_fields)
            return user
        except User.DoesNotExist:
            if supabase_user_id:
                return User.objects.create(
                    supabase_user_id=supabase_user_id,
                    email=email,
                    role=role,
                )

    return None


def _log_policy_event(policy, event_type, event_label, metadata=None):
    PolicyEvent.objects.create(
        policy=policy,
        event_type=event_type,
        event_label=event_label,
        metadata=metadata or {},
    )


# =========================
# Policy ViewSet
# =========================

class PolicyViewSet(viewsets.ModelViewSet):

    permission_classes = [IsUser]

    def get_queryset(self):

        user = get_authenticated_user(self.request)

        if not user:
            return Policy.objects.none()

        if user.is_admin:
            return Policy.objects.select_related(
                "user"
            ).prefetch_related("family_members", "timeline_events")

        return Policy.objects.filter(
            user=user
        ).select_related("user").prefetch_related("family_members", "timeline_events")

    # =========================

    def get_serializer_class(self):

        if self.action == "create":
            return PolicyCreateSerializer

        elif self.action in ["update", "partial_update"]:
            return PolicyUpdateSerializer

        elif self.action == "update_status":
            return PolicyStatusUpdateSerializer

        elif self.action == "list":
            return PolicyListSerializer

        return PolicySerializer

    # =========================

    def list(self, request):

        queryset = self.get_queryset()
        serializer = PolicyListSerializer(queryset, many=True)

        return Response({
            "count": queryset.count(),
            "policies": serializer.data
        })

    # =========================

    def retrieve(self, request, pk=None):

        queryset = self.get_queryset()
        policy = get_object_or_404(queryset, pk=pk)

        serializer = PolicySerializer(policy)

        return Response(serializer.data)

    # =========================

    def create(self, request):

        user = get_authenticated_user(request)

        if not user:
            return Response(
                {"error": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        existing_policy = Policy.objects.filter(user=user).first()

        if existing_policy:
            return Response(
                {
                    "error": "You already have a policy submitted",
                    "policy_id": existing_policy.id,
                    "policy_number": existing_policy.policy_number,
                    "status": existing_policy.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = PolicyCreateSerializer(data=request.data)

        if serializer.is_valid():

            policy = serializer.save(user=user)
            _log_policy_event(
                policy,
                "submitted",
                "Policy submitted for verification",
                {
                    "status": policy.status,
                    "workflow_label": policy.workflow_label,
                },
            )

            return Response(
                PolicySerializer(policy).data,
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=400)

    # =========================

    def update(self, request, pk=None):

        queryset = self.get_queryset()
        policy = get_object_or_404(queryset, pk=pk)

        if not policy.is_editable:
            return Response(
                {"error": f"Policy is locked while status is '{policy.status}'. Reopen it before editing."},
                status=400
            )

        serializer = PolicyUpdateSerializer(
            policy,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():

            serializer.save()
            _log_policy_event(
                policy,
                "updated",
                "Policy details updated",
                {
                    "updated_fields": sorted(serializer.validated_data.keys()),
                    "status": policy.status,
                },
            )

            return Response(
                PolicySerializer(policy).data
            )

        return Response(serializer.errors, status=400)

    # =========================

    def destroy(self, request, pk=None):

        queryset = self.get_queryset()
        policy = get_object_or_404(queryset, pk=pk)

        user = get_authenticated_user(request)

        if not user:
            return Response(
                {"error": "Authentication required"},
                status=401
            )

        if not user.is_admin and policy.status != "pending":

            return Response(
                {"error": "Cannot delete approved or rejected policy"},
                status=403
            )

        policy.delete()

        return Response(
            {"message": "Policy deleted"},
            status=204
        )

    # =========================
    # FIXED my_policy endpoint
    # =========================

    @action(detail=False, methods=["get"])
    def my_policy(self, request):

        user = get_authenticated_user(request)

        if not user:

            return Response(
                {
                    "has_policy": False,
                    "policy": None
                },
                status=200
            )

        policy = Policy.objects.select_related(
            "user"
        ).prefetch_related(
            "family_members", "timeline_events"
        ).filter(
            user=user
        ).first()

        if not policy:

            return Response(
                {
                    "has_policy": False,
                    "policy": None
                },
                status=200
            )

        serializer = PolicySerializer(policy)
        policy_data = serializer.data
        
        # Add status to the policy data for frontend compatibility
        policy_data['status'] = policy.status

        return Response(
            {
                "has_policy": True,
                "policy": policy_data
            },
            status=200
        )

    # =========================

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def update_status(self, request, pk=None):

        user = get_authenticated_user(request)

        if not user or not user.is_admin:

            return Response(
                {"error": "Admin access required"},
                status=403
            )

        policy = get_object_or_404(
            Policy.objects.select_for_update().prefetch_related("timeline_events"),
            pk=pk
        )

        serializer = PolicyStatusUpdateSerializer(
            policy,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():

            previous_status = policy.status
            serializer.save()
            if policy.status == "approved":
                _log_policy_event(
                    policy,
                    "approved",
                    "Policy approved",
                    {
                        "from_status": previous_status,
                        "total_coverage_amount": float(policy.total_coverage_amount or 0),
                    },
                )
            elif policy.status == "rejected":
                _log_policy_event(
                    policy,
                    "rejected",
                    "Policy rejected",
                    {
                        "from_status": previous_status,
                        "reason": policy.rejection_reason,
                    },
                )
            elif policy.status == "under_review":
                _log_policy_event(
                    policy,
                    "updated",
                    "Policy moved back under review",
                    {
                        "from_status": previous_status,
                    },
                )

            return Response(
                PolicySerializer(policy).data
            )

        return Response(serializer.errors, status=400)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def reopen(self, request, pk=None):

        user = get_authenticated_user(request)

        if not user or not user.is_admin:
            return Response(
                {"error": "Admin access required"},
                status=403
            )

        policy = get_object_or_404(Policy.objects.select_for_update(), pk=pk)

        if policy.status != "approved":
            return Response(
                {"error": "Only approved policies can be reopened"},
                status=400
            )

        reopen_reason = str(
            request.data.get("reason") or request.data.get("reopen_reason") or ""
        ).strip()

        policy.status = "under_review"
        policy.save(update_fields=["status", "updated_at"])

        _log_policy_event(
            policy,
            "reopened",
            "Policy reopened for correction",
            {
                "reason": reopen_reason,
                "from_status": "approved",
            },
        )

        return Response(PolicySerializer(policy).data)

    # =========================

    @action(detail=False, methods=["get"])
    def pending(self, request):

        user = get_authenticated_user(request)

        if not user or not user.is_admin:

            return Response(
                {"error": "Admin access required"},
                status=403
            )

        policies = Policy.objects.filter(
            status__in=["pending", "under_review"]
        ).select_related("user").prefetch_related("family_members", "timeline_events")

        serializer = PolicyListSerializer(policies, many=True)

        return Response({
            "count": policies.count(),
            "policies": serializer.data
        })

    # =========================

    @action(detail=False, methods=["get"])
    def all_families(self, request):

        user = get_authenticated_user(request)

        if not user or not user.is_admin:

            return Response(
                {"error": "Admin access required"},
                status=403
            )

        users = User.objects.filter(
            role="user"
        ).prefetch_related("policy__family_members")

        serializer = UserWithPolicySerializer(users, many=True)

        return Response({
            "total_users": users.count(),
            "families": serializer.data
        })


# =========================
# Family Member ViewSet
# =========================

class FamilyMemberViewSet(viewsets.ModelViewSet):

    permission_classes = [IsUser]
    serializer_class = FamilyMemberSerializer

    def get_queryset(self):

        user = get_authenticated_user(self.request)

        if not user:
            return FamilyMember.objects.none()

        if user.is_admin:

            return FamilyMember.objects.select_related(
                "policy__user"
            )

        policy = Policy.objects.filter(user=user).first()

        if not policy:
            return FamilyMember.objects.none()

        return FamilyMember.objects.filter(policy=policy)

    # =========================

    def create(self, request):

        user = get_authenticated_user(request)

        if not user:
            return Response({"error": "Authentication required"}, status=401)

        policy = Policy.objects.filter(user=user).first()

        if not policy:

            return Response(
                {"error": "Create policy first"},
                status=400
            )

        # Only allow adding family members after admin has approved the policy
        if policy.status != 'approved':
            return Response(
                {"error": "Policy must be approved by admin before adding family members."},
                status=400
            )

        serializer = FamilyMemberCreateSerializer(data=request.data)

        if serializer.is_valid():

            member = serializer.save(policy=policy)
            _log_policy_event(
                policy,
                "updated",
                "Family member added",
                {
                    "member_id": member.id,
                    "member_name": member.name,
                },
            )

            return Response(
                FamilyMemberSerializer(member).data,
                status=201
            )

        return Response(serializer.errors, status=400)

    # =========================

    def update(self, request, pk=None):

        queryset = self.get_queryset()
        member = get_object_or_404(queryset, pk=pk)

        if not member.policy.is_editable:
            return Response(
                {"error": f"Policy is locked while status is '{member.policy.status}'. Reopen it before editing members."},
                status=400
            )

        serializer = FamilyMemberCreateSerializer(
            member,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():

            serializer.save()
            _log_policy_event(
                member.policy,
                "updated",
                "Family member updated",
                {
                    "member_id": member.id,
                    "updated_fields": sorted(serializer.validated_data.keys()),
                },
            )

            return Response(
                FamilyMemberSerializer(member).data
            )

        return Response(serializer.errors, status=400)

    # =========================

    def destroy(self, request, pk=None):

        queryset = self.get_queryset()
        member = get_object_or_404(queryset, pk=pk)

        if not member.policy.is_editable:
            return Response(
                {"error": f"Policy is locked while status is '{member.policy.status}'. Reopen it before editing members."},
                status=400
            )

        # Check if member has any associated claims
        claims_count = member.claims.count()
        if claims_count > 0:
            return Response(
                {
                    "error": "This family member is associated with existing claims and cannot be deleted.",
                    "details": f"Found {claims_count} claim(s) linked to this member."
                },
                status=400
            )

        member_name = member.name
        policy = member.policy

        member.delete()
        _log_policy_event(
            policy,
            "updated",
            "Family member removed",
            {
                "member_name": member_name,
            },
        )

        return Response(
            {"message": "Family member deleted"},
            status=204
        )
