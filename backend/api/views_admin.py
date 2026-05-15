"""
Admin Views for Claim Review and Management
Handles admin-specific operations for reviewing claims and managing ML extraction
"""

import json
import logging
import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.db import models
from django.db.models import Avg, Count, Max, Min, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.http import JsonResponse
from .models_claim import Claim
from .models_document import ClaimDocument
from users.models import User
from auth_service.custom_permissions import IsSupabaseAuthenticated

logger = logging.getLogger(__name__)


NAME_FIELD_CANDIDATES = {
    "hospital_bill": ["patient_name", "name"],
    "pharmacy_bill": ["patient_name", "name"],
    "aadhaar": ["name", "full_name"],
    "pan": ["name", "full_name"],
}


def _safe_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return value


def _iter_project_models():
    for model in apps.get_models():
        meta = model._meta
        if meta.auto_created or meta.proxy or not meta.managed:
            continue
        if meta.app_label in {"admin", "auth", "contenttypes", "sessions"}:
            continue
        if model.__module__.startswith("django."):
            continue
        yield model


def _status_like_fields(model):
    fields = []
    for field in model._meta.fields:
        name = field.name.lower()
        if isinstance(field, (models.CharField, models.TextField)) and (
            "status" in name or "state" in name or field.choices
        ):
            fields.append(field)
    return fields


def _find_datetime_field(model):
    preferred = ("created_at", "created_on", "created", "updated_at", "date", "timestamp")
    model_fields = {field.name: field for field in model._meta.fields}
    for name in preferred:
        if name in model_fields and isinstance(model_fields[name], (models.DateTimeField, models.DateField)):
            return model_fields[name].name
    for field in model._meta.fields:
        if isinstance(field, (models.DateTimeField, models.DateField)):
            return field.name
    return None


def _entity_score(model, total_count):
    score = 0.0
    name = model._meta.model_name.lower()
    if any(token in name for token in ("claim", "transaction", "request", "case", "document", "review")):
        score += 6.0
    score += len([f for f in model._meta.fields if isinstance(f, models.ForeignKey)]) * 0.8
    score += len(_status_like_fields(model)) * 1.2
    if _find_datetime_field(model):
        score += 1.5
    score += min(total_count, 1000) / 200.0
    return score


def _model_identifier(model):
    return f"{model._meta.app_label}.{model.__name__}"


def _collect_grouped_counts(model, queryset):
    grouped = []
    pk_name = model._meta.pk.name

    for field in model._meta.fields:
        is_textual = isinstance(field, (models.CharField, models.TextField))
        is_boolean = isinstance(field, models.BooleanField)
        if not (is_textual or is_boolean):
            continue

        if not is_boolean and not field.choices:
            distinct_count = queryset.exclude(**{f"{field.name}__isnull": True}).values(field.name).distinct().count()
            if distinct_count < 2 or distinct_count > 12:
                continue

        rows = (
            queryset.exclude(**{f"{field.name}__isnull": True})
            .values(field.name)
            .annotate(count=Count(pk_name))
            .order_by("-count")[:12]
        )

        choices_map = dict(field.choices) if field.choices else {}
        data = []
        for row in rows:
            raw_value = row[field.name]
            label = choices_map.get(raw_value, raw_value)
            data.append(
                {
                    "value": str(raw_value),
                    "label": str(label),
                    "count": row["count"],
                }
            )

        if data:
            grouped.append(
                {
                    "model_key": _model_identifier(model),
                    "model_label": model._meta.verbose_name_plural.title(),
                    "field": field.name,
                    "field_label": field.verbose_name.title(),
                    "data": data,
                }
            )

    return grouped


def _collect_numeric_summaries(model, queryset):
    numeric_fields = []
    for field in model._meta.fields:
        if isinstance(
            field,
            (
                models.IntegerField,
                models.BigIntegerField,
                models.SmallIntegerField,
                models.PositiveIntegerField,
                models.PositiveSmallIntegerField,
                models.FloatField,
                models.DecimalField,
            ),
        ):
            if isinstance(field, models.AutoField):
                continue
            numeric_fields.append(field)

    summaries = []
    for field in numeric_fields:
        aggregates = queryset.aggregate(
            sum_value=Sum(field.name),
            avg_value=Avg(field.name),
            min_value=Min(field.name),
            max_value=Max(field.name),
        )
        if all(value is None for value in aggregates.values()):
            continue

        summaries.append(
            {
                "model_key": _model_identifier(model),
                "model_label": model._meta.verbose_name_plural.title(),
                "field": field.name,
                "field_label": field.verbose_name.title(),
                "sum": _safe_value(aggregates["sum_value"]),
                "avg": _safe_value(aggregates["avg_value"]),
                "min": _safe_value(aggregates["min_value"]),
                "max": _safe_value(aggregates["max_value"]),
            }
        )

    return summaries


def _build_recent_records(model, limit=10):
    queryset = model.objects.all()
    ordering_field = _find_datetime_field(model) or model._meta.pk.name
    queryset = queryset.order_by(f"-{ordering_field}")[:limit]

    records = []
    for obj in queryset:
        row = {}
        for field in model._meta.fields:
            if isinstance(field, models.ForeignKey):
                value = getattr(obj, field.attname, None)
            else:
                value = getattr(obj, field.name, None)
            row[field.name] = _safe_value(value)
        records.append(row)

    columns = list(records[0].keys()) if records else []
    return {
        "model_key": _model_identifier(model),
        "model_label": model._meta.verbose_name_plural.title(),
        "ordering_field": ordering_field,
        "columns": columns,
        "records": records,
    }


def _build_document_processing_insights():
    try:
        from .models_document import ClaimDocument, ClaimExtractedField, PolicyDocument
        from .models_claim import Claim
    except Exception:
        return {
            "documents_per_day": [],
            "documents_by_type": [],
            "document_distribution": [],
            "cards": {
                "total_documents_processed": 0,
                "total_policy_upload_users": 0,
                "total_claims": 0,
            },
            "avg_confidence_by_type": [],
            "cross_document_matching": {
                "matched": 0,
                "mismatched": 0,
                "total_compared": 0,
                "match_rate": 0,
                "mismatch_rate": 0,
                "breakdown": [
                    {"status": "Matched", "count": 0},
                    {"status": "Mismatched", "count": 0},
                ],
            },
        }

    now = timezone.now()
    last_30_days = now - timedelta(days=30)

    per_day_rows = (
        ClaimDocument.objects.filter(uploaded_at__gte=last_30_days)
        .annotate(day=TruncDate("uploaded_at"))
        .values("day")
        .annotate(count=Count("document_id"))
        .order_by("day")
    )
    documents_per_day = [
        {"day": _safe_value(row["day"]), "count": row["count"]}
        for row in per_day_rows
    ]

    type_counts = (
        ClaimDocument.objects.values("document_type")
        .annotate(count=Count("document_id"))
        .order_by("-count")
    )

    type_label_map = dict(getattr(ClaimDocument, "DOCUMENT_TYPE_CHOICES", []))
    documents_by_type = []
    for row in type_counts:
        doc_type = row["document_type"]
        documents_by_type.append(
            {
                "document_type": doc_type,
                "label": type_label_map.get(doc_type, str(doc_type).replace("_", " ").title()),
                "count": row["count"],
            }
        )

    confidence_rows = (
        ClaimExtractedField.objects.values("document_type")
        .annotate(avg_confidence=Avg("confidence_score"))
        .order_by("document_type")
    )
    avg_confidence_by_type = []
    for row in confidence_rows:
        doc_type = row["document_type"]
        avg_confidence_by_type.append(
            {
                "document_type": doc_type,
                "label": type_label_map.get(doc_type, str(doc_type).replace("_", " ").title()),
                "avg_confidence": _safe_value(row["avg_confidence"]),
            }
        )

    # Cross-document name matching: compare canonical name fields per claim.
    valid_doc_types = list(NAME_FIELD_CANDIDATES.keys())
    valid_fields = sorted({field for fields in NAME_FIELD_CANDIDATES.values() for field in fields})
    extracted_name_rows = ClaimExtractedField.objects.filter(
        document_type__in=valid_doc_types,
        field_name__in=valid_fields,
    ).values("claim_id", "document_type", "field_name", "field_value")

    names_by_claim = {}
    for row in extracted_name_rows:
        claim_id = str(row["claim_id"])
        doc_type = row["document_type"]
        field_name = row["field_name"]
        field_value = (row.get("field_value") or "").strip()
        if not field_value:
            continue
        names_by_claim.setdefault(claim_id, {}).setdefault(doc_type, {})[field_name] = field_value

    def _normalize_name(name: str) -> str:
        normalized = re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()
        return re.sub(r"\s+", " ", normalized)

    matched = 0
    mismatched = 0
    for claim_docs in names_by_claim.values():
        normalized_names = []
        for doc_type, candidates in NAME_FIELD_CANDIDATES.items():
            doc_fields = claim_docs.get(doc_type, {})
            selected = next((doc_fields.get(candidate) for candidate in candidates if doc_fields.get(candidate)), None)
            if selected:
                normalized_names.append(_normalize_name(selected))

        # Require at least 2 documents to compare.
        if len(normalized_names) < 2:
            continue

        if len(set(normalized_names)) == 1:
            matched += 1
        else:
            mismatched += 1

    total_compared = matched + mismatched
    match_rate = round((matched / total_compared) * 100, 2) if total_compared else 0
    mismatch_rate = round((mismatched / total_compared) * 100, 2) if total_compared else 0
    total_policy_upload_users = (
        PolicyDocument.objects.filter(
            document_type="POLICY",
            policy__user__role="user",
        )
        .values("policy__user_id")
        .distinct()
        .count()
    )

    # Calculate pending metrics for bar chart
    from .models import Policy
    pending_policies = Policy.objects.exclude(status='approved').count()
    pending_claims = Claim.objects.filter(status='pending').count()
    documents_for_review = ClaimDocument.objects.filter(
        claim__status__in=['pending', 'reapplied']
    ).count()

    return {
        "documents_per_day": documents_per_day,
        "documents_by_type": documents_by_type,
        "document_distribution": documents_by_type,
        "cards": {
            "total_documents_processed": ClaimDocument.objects.count(),
            "total_policy_upload_users": total_policy_upload_users,
            "total_claims": Claim.objects.count(),
        },
        "avg_confidence_by_type": avg_confidence_by_type,
        "pending_metrics": {
            "pending_policies": pending_policies,
            "pending_claims": pending_claims,
            "documents_for_review": documents_for_review,
            "breakdown": [
                {"name": "Pending Policies", "value": pending_policies},
                {"name": "Pending Claims", "value": pending_claims},
                {"name": "Documents for Review", "value": documents_for_review},
            ],
        },
        "cross_document_matching": {
            "matched": matched,
            "mismatched": mismatched,
            "total_compared": total_compared,
            "match_rate": match_rate,
            "mismatch_rate": mismatch_rate,
            "breakdown": [
                {"status": "Matched", "count": matched},
                {"status": "Mismatched", "count": mismatched},
            ],
        },
    }


def _build_admin_overview_payload():
    entity_totals = []
    grouped_counts = []
    numeric_summaries = []
    model_rankings = []

    for model in _iter_project_models():
        try:
            queryset = model.objects.all()
            total_count = queryset.count()
        except Exception as exc:
            logger.warning("Skipping model %s due to query error: %s", model.__name__, exc)
            continue

        entity_totals.append(
            {
                "model_key": _model_identifier(model),
                "model_label": model._meta.verbose_name_plural.title(),
                "total_count": total_count,
            }
        )

        grouped_counts.extend(_collect_grouped_counts(model, queryset))
        numeric_summaries.extend(_collect_numeric_summaries(model, queryset))
        model_rankings.append((model, _entity_score(model, total_count), total_count))

    entity_totals.sort(key=lambda item: item["total_count"], reverse=True)
    grouped_counts.sort(key=lambda item: len(item["data"]), reverse=True)

    operational_model = None
    if model_rankings:
        model_rankings.sort(key=lambda item: (item[1], item[2]), reverse=True)
        operational_model = model_rankings[0][0]

    recent = _build_recent_records(operational_model) if operational_model else {
        "model_key": None,
        "model_label": None,
        "ordering_field": None,
        "columns": [],
        "records": [],
    }

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "entity_totals": entity_totals,
        "grouped_counts": grouped_counts,
        "numeric_summaries": numeric_summaries,
        "recent": recent,
        "insights": _build_document_processing_insights(),
    }


@api_view(["GET"])
@permission_classes([IsSupabaseAuthenticated])
def admin_overview(request):
    """
    Dynamic admin overview endpoint.
    Builds totals, grouped categorical stats, numeric summaries, and recent records
    by introspecting available project models and fields.
    """
    try:
        return Response(_build_admin_overview_payload(), status=status.HTTP_200_OK)
    except Exception as exc:
        logger.error("Error building admin overview: %s", exc, exc_info=True)
        return Response(
            {"error": "Failed to build admin overview", "details": str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsSupabaseAuthenticated])
def admin_recent(request):
    """
    Dynamic recent activity endpoint.
    Returns latest records from the detected main operational model.
    """
    try:
        payload = _build_admin_overview_payload()
        return Response(payload["recent"], status=status.HTTP_200_OK)
    except Exception as exc:
        logger.error("Error building admin recent data: %s", exc, exc_info=True)
        return Response(
            {"error": "Failed to build recent records", "details": str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsSupabaseAuthenticated])
def get_claims_for_review(request):
    """
    Get claims grouped for claim workflow review.
    """
    try:
        admin_email = getattr(request, 'email', None)
        admin_user = User.objects.filter(email=admin_email, role='admin').first() if admin_email else None
        if not admin_user:
            return Response({'detail': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    c.claim_id,
                    c.user_id,
                    c.policy_id,
                    c.status,
                    c.created_at,
                    c.updated_at,
                    c.rejection_reason,
                    c.is_reapplied,
                    u.user_id as user_pk,
                    u.name,
                    u.full_name,
                    u.email,
                    p.policy_number,
                    docs.documents_json,
                    docs.document_count
                FROM claims c
                INNER JOIN users u ON c.user_id = u.supabase_user_id
                INNER JOIN policies p ON c.policy_id = p.id
                INNER JOIN LATERAL (
                    SELECT
                        COALESCE(
                            json_agg(
                                json_build_object(
                                    'document_id', cd.document_id::text,
                                    'document_type', cd.document_type,
                                    'file_url', cd.file_url,
                                    'uploaded_at', cd.uploaded_at
                                )
                                ORDER BY cd.uploaded_at DESC
                            ),
                            '[]'::json
                        ) AS documents_json,
                        COUNT(*) AS document_count
                    FROM claim_documents cd
                    WHERE cd.claim_id = c.claim_id
                ) docs ON TRUE
                WHERE c.status IN ('pending', 'approved', 'rejected', 'reapplied')
                  AND docs.document_count > 0
                ORDER BY c.created_at DESC
            """)
            
            claim_rows = cursor.fetchall()

        pending_claims = []
        approved_claims = []
        rejected_claims = []
        for row in claim_rows:
            (
                claim_id,
                user_uuid,
                policy_id,
                claim_status,
                created_at,
                updated_at,
                rejection_reason,
                is_reapplied,
                user_pk,
                name,
                full_name,
                email,
                policy_number,
                documents_json,
                document_count,
            ) = row

            if isinstance(documents_json, str):
                try:
                    documents_json = json.loads(documents_json)
                except Exception:
                    documents_json = []

            document_data = []
            for doc in (documents_json or []):
                uploaded_at = doc.get('uploaded_at')
                document_data.append({
                    'document_id': str(doc.get('document_id')) if doc.get('document_id') is not None else None,
                    'document_type': doc.get('document_type'),
                    'file_url': doc.get('file_url'),
                    'uploaded_at': uploaded_at.isoformat() if hasattr(uploaded_at, 'isoformat') else uploaded_at
                })
            
            # Calculate risk level based on document count
            risk_level = "Low"
            doc_count_value = int(document_count or 0)
            if doc_count_value >= 3:
                risk_level = "Medium"
            if doc_count_value >= 4:
                risk_level = "High"
            
            # Get user's display name
            user_name = name or full_name or email or f"User {user_pk}"

            claim_payload = {
                'claim_id': str(claim_id),
                'user_id': user_pk,
                'user_name': user_name,
                'user_email': email,
                'policy_id': str(policy_id),
                'policy_number': policy_number,
                'status': claim_status,
                'is_reapplied': bool(is_reapplied or claim_status == 'reapplied'),
                'is_new_claim': claim_status == 'pending' and not is_reapplied,
                'rejection_reason': rejection_reason,
                'risk_level': risk_level,
                'created_at': created_at.isoformat() if created_at else None,
                'updated_at': updated_at.isoformat() if updated_at else None,
                'documents': document_data,
                'document_count': doc_count_value
            }

            if claim_status in ('pending', 'reapplied'):
                pending_claims.append(claim_payload)
            elif claim_status == 'approved':
                approved_claims.append(claim_payload)
            elif claim_status == 'rejected':
                rejected_claims.append(claim_payload)

        return Response({
            'pending_claims': pending_claims,
            'approved_claims': approved_claims,
            'rejected_claims': rejected_claims,
            'counts': {
                'pending': len(pending_claims),
                'approved': len(approved_claims),
                'rejected': len(rejected_claims),
            },
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting claims for review: {str(e)}", exc_info=True)
        return Response({
            'error': 'Internal server error',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsSupabaseAuthenticated])
def create_test_data(request):
    """
    Create test data for development - users, policies, claims, and documents
    """
    try:
        import uuid
        from .models import Policy
        from django.db import connection
        
        # Create test user if not exists
        test_email = "test@example.com"
        user, created = User.objects.get_or_create(
            email=test_email,
            defaults={
                'name': 'Test User',
                'full_name': 'Test User Full Name',
                'mobile': '1234567890',
                'role': 'user',
                'supabase_user_id': uuid.uuid4()
            }
        )
        
        # Create test policy if not exists
        policy, created = Policy.objects.get_or_create(
            policy_number='TEST-POLICY-001',
            defaults={
                'user': user,
                'start_date': '2024-01-01',
                'end_date': '2024-12-31',
                'policy_document_url': 'https://example.com/test-policy.pdf',
                'status': 'approved'
            }
        )
        
        # Create test claim using raw SQL to handle type issues
        with connection.cursor() as cursor:
            # First check if claim already exists
            cursor.execute("""
                SELECT claim_id FROM claims 
                WHERE user_id = %s AND policy_id = %s 
                LIMIT 1
            """, [str(user.supabase_user_id), policy.id])
            
            existing_claim = cursor.fetchone()
            
            if not existing_claim:
                # Create new claim
                cursor.execute("""
                    INSERT INTO claims (claim_id, user_id, policy_id, status, created_at, updated_at)
                    VALUES (gen_random_uuid(), %s, %s, 'pending', NOW(), NOW())
                    RETURNING claim_id
                """, [str(user.supabase_user_id), policy.id])
                
                claim_result = cursor.fetchone()
                claim_id = claim_result[0] if claim_result else None
            else:
                claim_id = existing_claim[0]
        
        if not claim_id:
            return Response({
                'error': 'Failed to create or find claim'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Create test documents using raw SQL too
        doc_types = [
            ('hospital_bill', 'hospital_bills'), 
            ('aadhaar', 'aadhaar'), 
            ('pan', 'pan')
        ]
        docs_created = 0
        
        with connection.cursor() as cursor:
            for doc_type, bucket_name in doc_types:
                # Check if document already exists
                cursor.execute("""
                    SELECT document_id FROM claim_documents 
                    WHERE claim_id = %s AND document_type = %s 
                    LIMIT 1
                """, [claim_id, doc_type])
                
                existing_doc = cursor.fetchone()
                
                if not existing_doc:
                    cursor.execute("""
                        INSERT INTO claim_documents 
                        (document_id, claim_id, document_type, file_url, file_path, uploaded_at)
                        VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
                    """, [
                        claim_id, 
                        doc_type,
                        f'{bucket_name}/test_{doc_type}.pdf',
                        f'test_user/{doc_type}_test.pdf'
                    ])
                    docs_created += 1
        
        return Response({
            'message': 'Test data created successfully',
            'user_id': user.user_id,
            'user_supabase_id': str(user.supabase_user_id),
            'policy_id': policy.id,
            'claim_id': str(claim_id),
            'documents_created': docs_created
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating test data: {str(e)}", exc_info=True)
        return Response({
            'error': 'Failed to create test data',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsSupabaseAuthenticated])
def get_claim_details_for_review(request, claim_id):
    """
    Get detailed information about a specific claim for admin review
    Includes all documents and their metadata
    """
    try:
        # Get the claim
        try:
            claim = Claim.objects.get(claim_id=claim_id)
        except Claim.DoesNotExist:
            return Response({
                'error': f'Claim with ID {claim_id} not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get all documents for this claim
        documents = ClaimDocument.objects.filter(claim_id=claim_id)
        
        # Get Supabase client for generating signed URLs
        from .supabase_client import get_supabase_client
        supabase_client = get_supabase_client()
        
        document_data = []
        for doc in documents:
            # Generate signed URL for the document
            signed_url = None
            bucket_name = None
            
            if doc.file_path:
                # Determine bucket name based on document type
                doc_type_lower = doc.document_type.lower()
                if 'hospital' in doc_type_lower:
                    bucket_name = 'hospital_bills'
                elif 'pharmacy' in doc_type_lower:
                    bucket_name = 'pharmacy_bills'
                elif 'aadhaar' in doc_type_lower or 'aadhar' in doc_type_lower:
                    bucket_name = 'aadhaar'
                elif 'pan' in doc_type_lower:
                    bucket_name = 'pan'
                else:
                    bucket_name = 'hospital_bills'  # default
                
                try:
                    # Generate signed URL (expires in 1 hour)
                    response = supabase_client.storage.from_(bucket_name).create_signed_url(
                        doc.file_path, 3600
                    )
                    if response:
                        signed_url = response.get('signedURL')
                except Exception as e:
                    logger.error(f"Error generating signed URL for document {doc.document_id}: {str(e)}")
            
            document_data.append({
                'document_id': str(doc.document_id),
                'document_type': doc.document_type,
                'file_url': doc.file_url,
                'signed_url': signed_url,
                'bucket_name': bucket_name,
                'original_filename': doc.original_filename,
                'file_size': doc.file_size,
                'content_type': doc.content_type,
                'uploaded_at': doc.uploaded_at.isoformat() if doc.uploaded_at else None
            })
        
        # Organize documents by type for easier frontend handling
        documents_by_type = {}
        for doc in document_data:
            doc_type = doc['document_type']
            if doc_type not in documents_by_type:
                documents_by_type[doc_type] = []
            documents_by_type[doc_type].append(doc)
        
        claim_details = {
            'claim_id': str(claim.claim_id),
            'user_id': claim.user_id,
            'policy_id': str(claim.policy_id),
            'member_id': str(claim.member_id),
            'total_amount': str(claim.total_amount) if claim.total_amount else None,
            'status': claim.status,
            'created_at': claim.created_at.isoformat() if claim.created_at else None,
            'updated_at': claim.updated_at.isoformat() if claim.updated_at else None,
            'documents': document_data,
            'documents_by_type': documents_by_type,
            'document_count': len(document_data)
        }
        
        return Response(claim_details, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting claim details for {claim_id}: {str(e)}")
        return Response({
            'error': 'Internal server error',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsSupabaseAuthenticated])
def extract_claim_data_for_review(request, claim_id):
    """
    Trigger ML extraction for a claim's documents during admin review
    This will fetch real documents from Supabase and process them through ML
    """
    try:
        # Import here to avoid circular imports
        import sys
        import os
        ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'ML')
        if ML_DIR not in sys.path:
            sys.path.insert(0, ML_DIR)
        import asyncio
        from ml_extraction_service_flask import extract_claim_fields
        
        logger.info(f"Admin requested ML extraction for claim: {claim_id}")
        
        # Validate claim exists and has documents
        try:
            claim = Claim.objects.get(claim_id=claim_id)
        except Claim.DoesNotExist:
            return Response({
                'error': f'Claim with ID {claim_id} not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if claim has documents
        document_count = ClaimDocument.objects.filter(claim_id=claim_id).count()
        if document_count == 0:
            return Response({
                'error': 'No documents found for this claim',
                'claim_id': claim_id
            }, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"Processing {document_count} documents for claim {claim_id}")
        
        # Perform ML extraction using real documents from Supabase
        extraction_result = asyncio.run(extract_claim_fields(claim_id, async_mode=True))
        
        logger.info(f"ML extraction completed for claim {claim_id}, status: {extraction_result.get('extraction_status')}")
        
        # Add metadata about the extraction
        extraction_result['extracted_at'] = datetime.now().isoformat()
        extraction_result['extracted_by'] = getattr(request, 'user_email', 'unknown')
        
        return Response(extraction_result, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error during ML extraction for claim {claim_id}: {str(e)}")
        return Response({
            'error': 'ML extraction failed',
            'details': str(e),
            'claim_id': claim_id
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsSupabaseAuthenticated])
def validate_claim_fields(request, claim_id):
    """
    Validate claim fields and return validation summary for admin review
    """
    try:
        from .models_document import ClaimExtractedField
        from .models import Policy
        
        # Get claim
        try:
            claim = Claim.objects.get(claim_id=claim_id)
        except Claim.DoesNotExist:
            return Response({
                'error': f'Claim with ID {claim_id} not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get all documents for this claim
        documents = ClaimDocument.objects.filter(claim_id=claim_id)
        if not documents.exists():
            return Response({
                'error': 'No documents found for this claim'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get extracted fields for all documents
        extracted_fields = ClaimExtractedField.objects.filter(claim_id=claim_id)
        
        # Group fields by document type
        field_groups = {}
        confidence_scores = []
        
        for field in extracted_fields:
            doc_type = field.document_type
            if doc_type not in field_groups:
                field_groups[doc_type] = []
            
            confidence = field.confidence_score or 0
            confidence_scores.append(confidence)
            
            field_groups[doc_type].append({
                'field_name': field.field_name,
                'value': field.field_value or '',
                'confidence': confidence
            })
        
        # Calculate scores
        average_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0
        final_confidence = round(average_confidence, 2)
        
        # Determine confidence level
        if final_confidence >= 85:
            confidence_level = 'high'
        elif final_confidence >= 70:
            confidence_level = 'medium'
        else:
            confidence_level = 'low'
        
        # Get policy info
        policy = claim.policy
        
        # Run validation checks
        checks = []
        missing_documents = []
        low_confidence_count = 0
        
        # Check 1: All required documents present
        required_doc_types = ['hospital_bill', 'aadhaar']
        for doc_type in required_doc_types:
            if not documents.filter(document_type=doc_type).exists():
                missing_documents.append(doc_type)
        
        checks.append({
            'type': 'documents_complete',
            'severity': 'critical' if missing_documents else 'info',
            'label': 'Required Documents Check',
            'passed': len(missing_documents) == 0,
            'action_label': f'Missing: {", ".join(missing_documents)}' if missing_documents else 'All required documents present',
            'details': {'missing_documents': missing_documents}
        })
        
        # Check 2: Confidence score check
        low_confidence_fields = [f for f in extracted_fields if (f.confidence_score or 0) < 70]
        low_confidence_count = len(low_confidence_fields)
        
        checks.append({
            'type': 'confidence_threshold',
            'severity': 'warning' if low_confidence_count > 2 else 'info',
            'label': 'Extraction Confidence Check',
            'passed': low_confidence_count <= 2,
            'action_label': f'{low_confidence_count} fields below 70% confidence' if low_confidence_count > 0 else 'Good extraction quality',
            'details': {'low_confidence_count': low_confidence_count}
        })
        
        # Check 3: Name consistency check
        name_fields = {}
        for field in extracted_fields:
            if field.field_name.lower() in ['name', 'patient_name', 'full_name']:
                if field.document_type not in name_fields:
                    name_fields[field.document_type] = []
                name_fields[field.document_type].append(field.field_value)
        
        name_mismatch = False
        if len(name_fields) > 1:
            # Normalize names for comparison
            normalized_names = set()
            for names in name_fields.values():
                if names:
                    normalized = re.sub(r'[^a-z0-9]+', ' ', names[0].lower()).strip()
                    normalized_names.add(normalized)
            
            name_mismatch = len(normalized_names) > 1
        
        checks.append({
            'type': 'name_consistency',
            'severity': 'warning' if name_mismatch else 'info',
            'label': 'Cross-Document Name Consistency',
            'passed': not name_mismatch,
            'action_label': 'Name mismatch detected across documents' if name_mismatch else 'Names match across documents',
            'details': {'name_fields': name_fields}
        })
        
        # Check 4: Coverage validation
        exceeds_coverage = False
        if policy and claim.total_amount:
            remaining_coverage = policy.remaining_coverage_amount or 0
            if float(claim.total_amount) > remaining_coverage:
                exceeds_coverage = True
        
        checks.append({
            'type': 'coverage_validation',
            'severity': 'critical' if exceeds_coverage else 'info',
            'label': 'Coverage Limit Check',
            'passed': not exceeds_coverage,
            'action_label': f'Claim exceeds remaining coverage' if exceeds_coverage else 'Within coverage limits',
            'details': {'exceeds_coverage': exceeds_coverage}
        })
        
        # Determine overall recommendation
        critical_failures = [c for c in checks if c['severity'] == 'critical' and not c['passed']]
        warning_count = len([c for c in checks if c['severity'] == 'warning' and not c['passed']])
        
        if critical_failures:
            recommendation_status = 'reject'
            recommendation_label = 'Reject - Critical Issues'
            recommendation_description = f'Found {len(critical_failures)} critical issue(s)'
            next_action = 'Request additional documents or coverage adjustment'
        elif warning_count >= 2:
            recommendation_status = 'review'
            recommendation_label = 'Manual Review Required'
            recommendation_description = f'{warning_count} warnings detected - manual verification needed'
            next_action = 'Contact policyholder for clarification'
        elif final_confidence < 70:
            recommendation_status = 'review'
            recommendation_label = 'Manual Review Recommended'
            recommendation_description = 'Low extraction confidence - recommend manual review'
            next_action = 'Review extracted fields manually'
        else:
            recommendation_status = 'approve'
            recommendation_label = 'Auto-Approve Eligible'
            recommendation_description = 'All checks passed with high confidence'
            next_action = 'Proceed with approval'
        
        # Build response
        validation_summary = {
            'claim_id': str(claim_id),
            'final_confidence_score': final_confidence,
            'average_field_confidence': round(average_confidence, 2),
            'confidence_level': confidence_level,
            'recommendation': {
                'status': recommendation_status,
                'label': recommendation_label,
                'description': recommendation_description,
                'reasons': [c['action_label'] for c in checks if not c['passed']],
                'next_action': next_action
            },
            'checks': checks,
            'field_groups': field_groups,
            'summary': {
                'missing_documents': missing_documents,
                'low_confidence_count': low_confidence_count,
                'documents_processed': documents.count()
            }
        }
        
        return Response(validation_summary, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error validating claim {claim_id}: {str(e)}", exc_info=True)
        return Response({
            'error': 'Validation failed',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
