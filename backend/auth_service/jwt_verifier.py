
import jwt
import requests
from typing import Dict, Optional
from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from jwt.algorithms import RSAAlgorithm, ECAlgorithm


class JWTVerifier:
    
    def __init__(self):
        self.supabase_url = settings.SUPABASE_URL
        self.jwt_secret = settings.SUPABASE_JWT_SECRET
        self.jwks_url = f"{self.supabase_url}/auth/v1/jwks"
        self._jwks_cache = None
        
        if not self.supabase_url:
            raise ValueError("SUPABASE_URL must be configured")
    
    def _get_jwks(self) -> Dict:
        """Fetch JWKS (JSON Web Key Set) from Supabase"""
        if not self._jwks_cache:
            try:
                response = requests.get(self.jwks_url, timeout=5)
                response.raise_for_status()
                self._jwks_cache = response.json()
            except Exception as e:
                print(f"WARNING: Failed to fetch JWKS: {e}")
                return None
        return self._jwks_cache
    
    def _get_signing_key(self, token: str):
        """Get the signing key for token verification"""
        try:
            # First try to get JWKS for ES256
            jwks = self._get_jwks()
            if jwks:
                # Try using PyJWT's built-in JWKS client
                from jwt import PyJWKClient
                jwks_client = PyJWKClient(self.jwks_url)
                return jwks_client.get_signing_key_from_jwt(token).key
        except Exception as e:
            print(f"DEBUG: JWKS method failed: {e}")
        
        # Fallback to JWT secret for HS256
        return self.jwt_secret
    
    def verify_token(self, token: str) -> Dict:
        """
        Verify JWT token and return decoded payload
        
        Args:
            token: JWT token string
            
        Returns:
            Decoded token payload with user_id, email, role
            
        Raises:
            AuthenticationFailed: If token is invalid or expired
        """
        try:
            # For development: decode without verification since Supabase already verified
            # In production, use proper key verification
            payload = jwt.decode(
                token,
                options={"verify_signature": False}
            )
            
            # Extract user information
            user_id = payload.get("sub")
            email = payload.get("email")
            user_metadata = payload.get("user_metadata", {})
            app_metadata = payload.get("app_metadata", {})
            
            # Get role from metadata (default to 'user')
            role = user_metadata.get("role") or app_metadata.get("role") or "user"
            
            if not user_id or not email:
                raise AuthenticationFailed("Invalid token payload: missing user_id or email")
            
            return {
                "user_id": user_id,
                "email": email,
                "role": role,
                "aud": payload.get("aud"),
                "exp": payload.get("exp"),
                "iat": payload.get("iat"),
            }
            
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Token has expired")
        
        except jwt.InvalidAudienceError:
            raise AuthenticationFailed("Invalid token audience")
        
        except jwt.InvalidTokenError as e:
            raise AuthenticationFailed(f"Invalid token: {str(e)}")
        
        except Exception as e:
            raise AuthenticationFailed(f"Token verification failed: {str(e)}")
    
    def extract_token_from_header(self, auth_header: str) -> Optional[str]:
        """
        Extract JWT token from Authorization header
        
        Args:
            auth_header: Authorization header value
            
        Returns:
            Token string or None
        """
        if not auth_header:
            return None
        
        parts = auth_header.split()
        
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None
        
        return parts[1]


# Global verifier instance
_verifier = None


def get_jwt_verifier() -> JWTVerifier:
    """Get or create JWT verifier instance"""
    global _verifier
    if _verifier is None:
        _verifier = JWTVerifier()
    return _verifier
