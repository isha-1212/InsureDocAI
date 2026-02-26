"""
Custom permission classes for role-based access control
"""

from rest_framework import permissions


class IsSupabaseAuthenticated(permissions.BasePermission):
    """
    Permission class that checks if user is authenticated via Supabase JWT
    Works with SupabaseAuthMiddleware
    """
    
    def has_permission(self, request, view):
        """
        Check if user is authenticated via Supabase middleware
        """
        return getattr(request, 'is_authenticated', False)


class IsAdmin(permissions.BasePermission):
    """
    Permission class that allows access only to admin users
    TODO: Implement role checking from UserProfile model
    """
    
    def has_permission(self, request, view):
        """
        Check if user has admin role
        TODO: Implement by checking user.profile.role == 'admin'
        """
        # Placeholder - implement role checking
        return request.user and request.user.is_authenticated


class IsPolicyHolder(permissions.BasePermission):
    """
    Permission class that allows access only to policy holder users
    TODO: Implement role checking from UserProfile model
    """
    
    def has_permission(self, request, view):
        """
        Check if user has policy holder (user) role
        TODO: Implement by checking user.profile.role == 'user'
        """
        # Placeholder - implement role checking
        return request.user and request.user.is_authenticated
