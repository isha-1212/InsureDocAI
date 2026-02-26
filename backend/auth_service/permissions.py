"""
Role-Based Access Control
Decorators and permission classes for protecting endpoints
"""
from functools import wraps
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from django.http import JsonResponse


def require_auth(view_func):
    """
    Decorator to require authentication for a view
    
    Usage:
        @require_auth
        def my_view(request):
            # request.user_id, request.email, request.role are available
            pass
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.is_authenticated:
            return JsonResponse(
                {"error": "Authentication required", "detail": "Missing or invalid token"},
                status=401
            )
        return view_func(request, *args, **kwargs)
    return wrapper


def require_admin(view_func):
    """
    Decorator to require admin role for a view
    
    Usage:
        @require_admin
        def admin_only_view(request):
            # Only admins can access this
            pass
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.is_authenticated:
            return JsonResponse(
                {"error": "Authentication required", "detail": "Missing or invalid token"},
                status=401
            )
        
        if request.role != "admin":
            return JsonResponse(
                {"error": "Admin access required", "detail": "Insufficient permissions"},
                status=403
            )
        
        return view_func(request, *args, **kwargs)
    return wrapper


def require_user(view_func):
    """
    Decorator to require user or admin role for a view
    
    Usage:
        @require_user
        def user_view(request):
            # Users and admins can access this
            pass
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.is_authenticated:
            return JsonResponse(
                {"error": "Authentication required", "detail": "Missing or invalid token"},
                status=401
            )
        
        if request.role not in ["user", "admin"]:
            return JsonResponse(
                {"error": "User access required", "detail": "Insufficient permissions"},
                status=403
            )
        
        return view_func(request, *args, **kwargs)
    return wrapper


# DRF Permission Classes

class IsAuthenticated(BasePermission):
    """
    DRF Permission class to check if user is authenticated
    """
    def has_permission(self, request, view):
        return request.is_authenticated


class IsAdmin(BasePermission):
    """
    DRF Permission class to check if user is admin
    """
    def has_permission(self, request, view):
        if not request.is_authenticated:
            raise AuthenticationFailed("Authentication required")
        
        if request.role != "admin":
            raise PermissionDenied("Admin access required")
        
        return True


class IsUser(BasePermission):
    """
    DRF Permission class to check if user is a regular user or admin
    """
    def has_permission(self, request, view):
        if not request.is_authenticated:
            raise AuthenticationFailed("Authentication required")
        
        if request.role not in ["user", "admin"]:
            raise PermissionDenied("User access required")
        
        return True
