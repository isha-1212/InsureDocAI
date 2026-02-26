from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q
import logging

from .models import Policy, FamilyMember
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

    if supabase_user_id:
        try:
            return User.objects.get(supabase_user_id=supabase_user_id)
        except User.DoesNotExist:
            pass

    if email:
        try:
            user = User.objects.get(email=email)
            if supabase_user_id and not user.supabase_user_id:
                user.supabase_user_id = supabase_user_id
                user.save(update_fields=["supabase_user_id"])
            return user
        except User.DoesNotExist:
            return None

    return None


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
            ).prefetch_related("family_members")

        return Policy.objects.filter(
            user=user
        ).select_related("user").prefetch_related("family_members")

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

            return Response(
                PolicySerializer(policy).data,
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=400)

    # =========================

    def update(self, request, pk=None):

        queryset = self.get_queryset()
        policy = get_object_or_404(queryset, pk=pk)

        if policy.status == "approved":
            return Response(
                {"error": "Cannot update approved policy"},
                status=400
            )

        serializer = PolicyUpdateSerializer(
            policy,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():

            serializer.save()

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
            "family_members"
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
    def update_status(self, request, pk=None):

        user = get_authenticated_user(request)

        if not user or not user.is_admin:

            return Response(
                {"error": "Admin access required"},
                status=403
            )

        policy = get_object_or_404(Policy, pk=pk)

        serializer = PolicyStatusUpdateSerializer(
            policy,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                PolicySerializer(policy).data
            )

        return Response(serializer.errors, status=400)

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
            status="pending"
        ).select_related("user").prefetch_related("family_members")

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

        serializer = FamilyMemberCreateSerializer(data=request.data)

        if serializer.is_valid():

            member = serializer.save(policy=policy)

            return Response(
                FamilyMemberSerializer(member).data,
                status=201
            )

        return Response(serializer.errors, status=400)

    # =========================

    def update(self, request, pk=None):

        queryset = self.get_queryset()
        member = get_object_or_404(queryset, pk=pk)

        serializer = FamilyMemberCreateSerializer(
            member,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                FamilyMemberSerializer(member).data
            )

        return Response(serializer.errors, status=400)

    # =========================

    def destroy(self, request, pk=None):

        queryset = self.get_queryset()
        member = get_object_or_404(queryset, pk=pk)

        member.delete()

        return Response(
            {"message": "Family member deleted"},
            status=204
        )
