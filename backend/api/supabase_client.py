import os
from typing import Dict, Any

import requests
from django.conf import settings


def _get_base_config() -> Dict[str, str]:
    supabase_url = os.environ.get("SUPABASE_URL") or settings.SUPABASE_URL
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or settings.SUPABASE_SERVICE_ROLE_KEY

    if not supabase_url or not supabase_key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables or Django settings",
        )

    supabase_url = supabase_url.rstrip("/")
    return {"url": supabase_url, "key": supabase_key}


def upload_to_policies_bucket(file_path: str, file_bytes: bytes, content_type: str):

    cfg = _get_base_config()
    url = f"{cfg['url']}/storage/v1/object/policies/{file_path}"

    headers = {
        "Authorization": f"Bearer {cfg['key']}",
        "apikey": cfg["key"],
        "Content-Type": content_type,
    }

    # upsert=false via query param to match previous behaviour
    resp = requests.post(url, headers=headers, params={"upsert": "false"}, data=file_bytes, timeout=30)
    return resp


def upload_to_bucket(bucket_name: str, file_path: str, file_bytes: bytes, content_type: str):

    cfg = _get_base_config()
    url = f"{cfg['url']}/storage/v1/object/{bucket_name}/{file_path}"

    headers = {
        "Authorization": f"Bearer {cfg['key']}",
        "apikey": cfg["key"],
        "Content-Type": content_type,
    }

    # upsert=false via query param to match previous behaviour
    resp = requests.post(url, headers=headers, params={"upsert": "false"}, data=file_bytes, timeout=30)
    return resp


def create_signed_url(bucket: str, file_path: str, expires_in: int = 300) -> Dict[str, Any]:

    cfg = _get_base_config()
    url = f"{cfg['url']}/storage/v1/object/sign/{bucket}/{file_path}"

    headers = {
        "Authorization": f"Bearer {cfg['key']}",
        "apikey": cfg["key"],
        "Content-Type": "application/json",
    }

    resp = requests.post(url, headers=headers, json={"expiresIn": expires_in}, timeout=30)
    
    if not resp.ok:
        try:
            error_detail = resp.json()
            raise Exception(f"Supabase Storage error: {error_detail}")
        except:
            resp.raise_for_status()
    
    data = resp.json()

    signed = data.get("signedURL") or data.get("signed_url")
    if isinstance(signed, str):
        normalized = signed
        if normalized.startswith("/object/"):
            normalized = f"/storage/v1{normalized}"
        elif normalized.startswith("object/"):
            normalized = f"/storage/v1/{normalized}"
        if not normalized.startswith("http"):
            normalized = f"{cfg['url']}{normalized}"
        data["signedURL"] = normalized
        data["signed_url"] = normalized

    return data


def get_authenticated_download_url(bucket: str, file_path: str) -> str:
    # Return a path to our backend endpoint that will handle the authenticated download
    return f"/api/download/{bucket}/{file_path}"


def download_file_authenticated(bucket: str, file_path: str) -> requests.Response:
    cfg = _get_base_config()
    url = f"{cfg['url']}/storage/v1/object/{bucket}/{file_path}"
    
    headers = {
        "Authorization": f"Bearer {cfg['key']}",
        "apikey": cfg["key"],
    }
    
    resp = requests.get(url, headers=headers, timeout=30)
    return resp


def get_public_url(bucket: str, file_path: str) -> str:
    cfg = _get_base_config()
    return f"{cfg['url']}/storage/v1/object/public/{bucket}/{file_path}"


def get_supabase_client() -> None:
    """Deprecated wrapper kept for backwards compatibility.

    The old code expected `get_supabase_client()` to return an object with
    a `.storage` attribute. New code should import and use
    `upload_to_policies_bucket` and `create_signed_url` directly.
    """

    return None
