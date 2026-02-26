"""
Supabase Client Configuration
Manages connection to Supabase service
"""
import os
from supabase import create_client, Client
from django.conf import settings


class SupabaseClient:
    """Singleton Supabase client instance"""
    _instance: Client = None

    @classmethod
    def get_client(cls) -> Client:
        """Get or create Supabase client instance"""
        if cls._instance is None:
            supabase_url = settings.SUPABASE_URL
            supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY
            
            if not supabase_url or not supabase_key:
                raise ValueError(
                    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment"
                )
            
            cls._instance = create_client(supabase_url, supabase_key)
        
        return cls._instance


def get_supabase() -> Client:
    """Helper function to get Supabase client"""
    return SupabaseClient.get_client()
