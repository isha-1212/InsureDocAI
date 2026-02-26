"""
JWT Authentication Middleware for validating Supabase tokens
TODO: Implement JWT verification logic using python-jose or PyJWT
"""

from django.contrib.auth.models import AnonymousUser
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed


class SupabaseJWTAuthentication(authentication.BaseAuthentication):
    """
    Custom authentication class to validate Supabase JWT tokens
    TODO: Implement token verification with Supabase public key
    """
    
    def authenticate(self, request):
        """
        Authenticate the request using Supabase JWT token
        
        Returns:
            tuple: (user, token) if authentication successful
            None: if no authentication attempted
        
        Raises:
            AuthenticationFailed: if authentication fails
        """
        # TODO: Extract token from Authorization header
        # TODO: Verify token signature using Supabase JWT secret
        # TODO: Extract user_id from token payload
        # TODO: Fetch or create Django user based on Supabase user_id
        # TODO: Return (user, token) tuple
        
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header.startswith('Bearer '):
            return None
        
        # Placeholder - implement actual JWT verification
        return None
    
    def authenticate_header(self, request):
        """
        Return authentication scheme for WWW-Authenticate header
        """
        return 'Bearer'
