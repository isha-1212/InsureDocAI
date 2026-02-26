from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from .permissions import IsAuthenticated, IsAdmin, require_auth, require_admin
from .supabase_client import get_supabase


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response({
        "user_id": request.user_id,
        "email": request.email,
        "role": request.role,
        "authenticated": True,
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def validate_token(request):
    return Response({
        "valid": True,
        "user_id": request.user_id,
        "email": request.email,
        "role": request.role,
        "exp": request.auth_payload.get("exp") if request.auth_payload else None,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    return Response({
        "message": "Logout successful",
        "detail": "Please remove the token from client storage"
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_dashboard(request):
    return Response({
        "message": "Welcome to admin dashboard",
        "admin_email": request.email,
        "admin_id": request.user_id,
        "role": request.role,
        "features": [
            "Manage claims",
            "Review policies",
            "User management",
            "Analytics"
        ]
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_stats(request):
    return Response({
        "total_users": 0,
        "total_claims": 0,
        "pending_claims": 0,
        "approved_claims": 0,
        "rejected_claims": 0,
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
def health_check(request):
    return Response({
        "status": "healthy",
        "service": "auth_service",
        "authenticated": request.is_authenticated,
    }, status=status.HTTP_200_OK)
