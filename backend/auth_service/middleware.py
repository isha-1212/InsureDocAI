"""
Authentication Middleware
Automatically verifies Supabase JWT tokens and attaches user info to request
"""
from django.utils.deprecation import MiddlewareMixin
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
from .jwt_verifier import get_jwt_verifier
import traceback


class SupabaseAuthMiddleware(MiddlewareMixin):
    """
    Middleware to verify Supabase JWT tokens and attach user info to request

    Adds:
    - request.user_id
    - request.email
    - request.role
    - request.is_authenticated
    """

    def __init__(self, get_response):
        super().__init__(get_response)
        self.jwt_verifier = get_jwt_verifier()

    def process_request(self, request):
        # Default unauthenticated state
        request.user_id = None
        request.email = None
        request.role = None
        request.is_authenticated = False
        request.auth_payload = None

        # Skip static + admin
        skip_paths = ["/admin", "/static", "/media"]

        if any(request.path.startswith(p) for p in skip_paths):
            return None

        auth_header = request.META.get("HTTP_AUTHORIZATION")

        if not auth_header:
            return None

        try:
            token = self.jwt_verifier.extract_token_from_header(auth_header)
            if not token:
                return None

            payload = self.jwt_verifier.verify_token(token)

            request.user_id = payload.get("user_id")
            request.email = payload.get("email")
            request.role = payload.get("role", "user")
            request.is_authenticated = True
            request.auth_payload = payload

        except AuthenticationFailed as e:
            # Invalid JWT → normal unauthenticated request
            print("JWT invalid:", str(e))
            return None

        except Exception as e:
            # This is CRITICAL — show the real error
            print("\n========== SUPABASE AUTH ERROR ==========")
            print(str(e))
            traceback.print_exc()
            print("========================================\n")

            # In debug mode, crash so we can see it
            if settings.DEBUG:
                raise

            # In production, just treat as unauthenticated
            return None

        return None
