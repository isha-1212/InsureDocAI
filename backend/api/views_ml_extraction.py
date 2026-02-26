"""
Django API View for ML Extraction
Handles the /api/admin/claims/<claim_id>/extract/ endpoint
"""

import logging
import sys
import os
import asyncio
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import JsonResponse

# Add ML directory to path to import ML service
ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'ML')
if ML_DIR not in sys.path:
    sys.path.insert(0, ML_DIR)

logger = logging.getLogger(__name__)


class ClaimExtractionAPIView(APIView):
    """
    API view for ML extraction from claim documents
    POST /api/admin/claims/<claim_id>/extract/
    """
    
    def post(self, request, claim_id):
        """
        Extract ML data from claim documents
        Returns cached data if available, otherwise performs extraction
        """
        try:
            # Import ML service from ML folder (Flask-based)
            from ml_extraction_service_flask import extract_claim_fields
            
            # Validate claim_id format (UUID)
            if not claim_id:
                return Response({
                    'error': 'Claim ID is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            logger.info(f"Starting ML extraction for claim: {claim_id}")
            
            # Run async extractor from a sync DRF view.
            result = asyncio.run(extract_claim_fields(claim_id, async_mode=True))
            
            logger.info(f"ML extraction completed for claim: {claim_id}, status: {result['extraction_status']}")
            
            return Response(result, status=status.HTTP_200_OK)
            
        except ValueError as e:
            # Handle claim not found or validation errors
            logger.warning(f"Validation error for claim {claim_id}: {str(e)}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_404_NOT_FOUND)
            
        except Exception as e:
            # Handle unexpected errors
            logger.error(f"Unexpected error in ML extraction for claim {claim_id}: {str(e)}")
            return Response({
                'error': 'Internal server error during ML extraction',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ClaimDocumentExtractionAPIView(APIView):
    """
    API view for ML extraction from one specific claim document.
    POST /api/admin/claims/<claim_id>/documents/<document_id>/extract/
    """

    def post(self, request, claim_id, document_id):
        try:
            from ml_extraction_service_flask import extract_claim_document

            if not claim_id or not document_id:
                return Response({
                    'error': 'Claim ID and Document ID are required'
                }, status=status.HTTP_400_BAD_REQUEST)

            logger.info(f"Starting ML extraction for claim {claim_id}, document {document_id}")
            result = asyncio.run(extract_claim_document(claim_id, document_id, async_mode=True))
            return Response(result, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Unexpected error in document extraction for claim {claim_id}, document {document_id}: {str(e)}")
            logger.exception("Document extraction traceback")
            return Response({
                'error': 'Internal server error during document extraction',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Function-based view alternative
def extract_claim_data_view(request, claim_id):
    """
    Function-based view for claim extraction
    Alternative to class-based view
    """
    if request.method != 'POST':
        return JsonResponse({
            'error': 'Only POST method allowed'
        }, status=405)
    
    try:
        # Import ML service from ML folder (Flask-based)
        sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'ML'))
        from ml_extraction_service_flask import extract_claim_fields
        
        if not claim_id:
            return JsonResponse({
                'error': 'Claim ID is required'
            }, status=400)
        
        logger.info(f"Starting ML extraction for claim: {claim_id}")
        
        # Perform ML extraction
        result = asyncio.run(extract_claim_fields(claim_id, async_mode=True))
        
        logger.info(f"ML extraction completed for claim: {claim_id}")
        
        return JsonResponse(result, status=200)
        
    except ValueError as e:
        logger.warning(f"Validation error for claim {claim_id}: {str(e)}")
        return JsonResponse({
            'error': str(e)
        }, status=404)
        
    except Exception as e:
        logger.error(f"Unexpected error in ML extraction for claim {claim_id}: {str(e)}")
        return JsonResponse({
            'error': 'Internal server error during ML extraction',
            'details': str(e)
        }, status=500)
