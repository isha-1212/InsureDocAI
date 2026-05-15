"""
ML Extraction Service for Claims Processing
Handles document extraction, caching, and ML pipeline execution
"""

import os
import sys
import tempfile
import logging
import django
from typing import Dict, List, Tuple, Optional

# Setup Django environment
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import transaction
from api.models_claim import Claim  # pyright: ignore[reportMissingImports]
from api.models_document import ClaimDocument, ClaimExtractedField  # pyright: ignore[reportMissingImports]
from api.supabase_client import get_supabase_client  # pyright: ignore[reportMissingImports]

# Add current ML directory to Python path
ML_DIR = os.path.dirname(__file__)
sys.path.append(ML_DIR)

# Add ML src directory so Pylance can resolve local extractor modules.
ML_SRC_DIR = os.path.join(ML_DIR, 'src')
if ML_SRC_DIR not in sys.path:
    sys.path.append(ML_SRC_DIR)

logger = logging.getLogger(__name__)


class MLExtractionService:
    """Service class for handling ML extraction from claim documents"""
    
    def __init__(self):
        self.supabase = get_supabase_client()
    
    def extract_claim_data(self, claim_id: str) -> Dict:
        """
        Main method to extract data from claim documents
        Returns cached data if available, otherwise performs ML extraction
        """
        try:
            # Validate claim exists
            claim = self._validate_claim(claim_id)
            
            # Check if extraction already exists (cache)
            cached_data = self._get_cached_extraction(claim_id)
            if cached_data:
                logger.info(f"Returning cached extraction data for claim {claim_id}")
                return self._format_response(claim_id, cached_data, "cached")
            
            # Get claim documents
            documents = self._get_claim_documents(claim_id)
            if not documents:
                return self._format_response(claim_id, {}, "no_documents")
            
            # Perform ML extraction
            extracted_data = self._perform_ml_extraction(claim_id, documents)
            
            return self._format_response(claim_id, extracted_data, "completed")
            
        except Exception as e:
            logger.error(f"Error extracting claim data for {claim_id}: {str(e)}")
            raise
    
    def _validate_claim(self, claim_id: str) -> Claim:
        """Validate that claim exists"""
        try:
            return Claim.objects.get(claim_id=claim_id)
        except Claim.DoesNotExist:
            raise ValueError(f"Claim with ID {claim_id} does not exist")
    
    def _get_cached_extraction(self, claim_id: str) -> Dict:
        """Check if extraction data already exists in database"""
        cached_fields = ClaimExtractedField.objects.filter(claim_id=claim_id)
        
        if not cached_fields.exists():
            return {}
        
        # Group cached data by document type
        grouped_data = {}
        for field in cached_fields:
            doc_type = field.document_type
            if doc_type not in grouped_data:
                grouped_data[doc_type] = []
            
            grouped_data[doc_type].append({
                'field_name': field.field_name,
                'value': field.field_value,
                'confidence': float(field.confidence_score) if field.confidence_score else 0.0
            })
        
        return grouped_data
    
    def _get_claim_documents(self, claim_id: str) -> List[ClaimDocument]:
        """Fetch all documents for a claim"""
        return list(ClaimDocument.objects.filter(claim_id=claim_id))
    
    @transaction.atomic
    def _perform_ml_extraction(self, claim_id: str, documents: List[ClaimDocument]) -> Dict:
        """Perform ML extraction on all documents and store results"""
        extracted_data = {}
        
        for document in documents:
            try:
                # Download document from Supabase
                local_file_path = self._download_document(document)
                
                # Extract data based on document type
                extraction_results = self._extract_document_data(
                    document.document_type, 
                    local_file_path
                )
                
                # Store extraction results in database
                self._store_extraction_results(
                    claim_id, 
                    document.document_type, 
                    extraction_results
                )
                
                # Add to response data
                extracted_data[document.document_type] = extraction_results
                
                # Clean up temporary file
                if os.path.exists(local_file_path):
                    os.remove(local_file_path)
                    
            except Exception as e:
                logger.error(f"Error processing document {document.document_id}: {str(e)}")
                # Continue with other documents even if one fails
                continue
        
        return extracted_data
    
    def _download_document(self, document: ClaimDocument) -> str:
        """Download document from Supabase storage to temporary file"""
        try:
            # Create temporary file
            temp_file = tempfile.NamedTemporaryFile(
                delete=False, 
                suffix=os.path.splitext(document.file_path)[1]
            )
            
            # Download from Supabase
            # Extract bucket and file path from file_url
            # Assuming file_url format: https://...supabase.../storage/v1/object/public/bucket_name/file_path
            bucket_name = document.document_type  # As per requirement
            file_path = document.file_path
            
            response = self.supabase.storage.from_(bucket_name).download(file_path)
            
            # Write to temporary file
            temp_file.write(response)
            temp_file.close()
            
            logger.info(f"Downloaded document {document.document_id} to {temp_file.name}")
            return temp_file.name
            
        except Exception as e:
            logger.error(f"Error downloading document {document.document_id}: {str(e)}")
            raise
    
    def _extract_document_data(self, document_type: str, file_path: str) -> List[Dict]:
        """Extract data from document using appropriate ML extractor"""
        try:
            if document_type == 'hospital_bill':
                return self._extract_hospital_bill(file_path)
            elif document_type == 'pharmacy_bill':
                return self._extract_pharmacy_bill(file_path)
            elif document_type in ['aadhaar', 'pan']:
                return self._extract_kyc_document(file_path, document_type)
            else:
                logger.warning(f"Unknown document type: {document_type}")
                return []
                
        except Exception as e:
            logger.error(f"Error extracting data from {document_type}: {str(e)}")
            return []
    
    def _extract_hospital_bill(self, file_path: str) -> List[Dict]:
        """Extract data from hospital bill using ML extractor"""
        try:
            # Import the hospital bill extractor from current ML directory
            from src.hospital_bill_extractor import extract_hospital_data  # pyright: ignore[reportMissingImports]
            
            results = extract_hospital_data(file_path)
            return self._normalize_extraction_results(results)
            
        except ImportError:
            logger.error("Hospital bill extractor not found in src/")
            # Fallback: try to use main pipeline
            return self._extract_with_main_pipeline(file_path, 'hospital_bill')
        except Exception as e:
            logger.error(f"Error in hospital bill extraction: {str(e)}")
            return []
    
    def _extract_pharmacy_bill(self, file_path: str) -> List[Dict]:
        """Extract data from pharmacy bill using ML extractor"""
        try:
            # Import the pharmacy bill extractor from current ML directory
            from src.pharmacy_bill_extractor import extract_pharmacy_data  # pyright: ignore[reportMissingImports]
            
            results = extract_pharmacy_data(file_path)
            return self._normalize_extraction_results(results)
            
        except ImportError:
            logger.error("Pharmacy bill extractor not found in src/")
            # Fallback: try to use main pipeline
            return self._extract_with_main_pipeline(file_path, 'pharmacy_bill')
        except Exception as e:
            logger.error(f"Error in pharmacy bill extraction: {str(e)}")
            return []
    
    def _extract_kyc_document(self, file_path: str, document_type: str) -> List[Dict]:
        """Extract data from KYC documents (Aadhaar/PAN) using ML extractor"""
        try:
            # Import and use KYC extractor from kyc directory
            from kyc.kyc_pipeline import extract_kyc_data
            
            results = extract_kyc_data(file_path, document_type)
            return self._normalize_extraction_results(results)
            
        except ImportError:
            logger.error("KYC extractor not found in kyc/")
            return []
        except Exception as e:
            logger.error(f"Error in KYC extraction: {str(e)}")
            return []
    
    def _extract_with_main_pipeline(self, file_path: str, document_type: str) -> List[Dict]:
        """Fallback: Use main ML pipeline for extraction"""
        try:
            from src.pipeline import extract_document_fields
            
            results = extract_document_fields(file_path, document_type)
            return self._normalize_extraction_results(results)
            
        except ImportError:
            logger.error("Main pipeline not found")
            return []
        except Exception as e:
            logger.error(f"Error in main pipeline extraction: {str(e)}")
            return []
    
    def _normalize_extraction_results(self, results) -> List[Dict]:
        """Normalize extraction results to standard format"""
        normalized = []
        
        if isinstance(results, dict):
            for field_name, data in results.items():
                if isinstance(data, dict) and 'value' in data:
                    normalized.append({
                        'field_name': field_name,
                        'value': str(data['value']),
                        'confidence': float(data.get('confidence', 0.0))
                    })
                else:
                    normalized.append({
                        'field_name': field_name,
                        'value': str(data),
                        'confidence': 0.0
                    })
        elif isinstance(results, list):
            for item in results:
                if isinstance(item, dict):
                    normalized.append({
                        'field_name': item.get('field_name', 'unknown'),
                        'value': str(item.get('value', '')),
                        'confidence': float(item.get('confidence', 0.0))
                    })
        
        return normalized
    
    def _store_extraction_results(self, claim_id: str, document_type: str, 
                                results: List[Dict]) -> None:
        """Store extraction results in claim_extracted_fields table"""
        for result in results:
            ClaimExtractedField.objects.create(
                claim_id=claim_id,
                document_type=document_type,
                field_name=result['field_name'],
                field_value=result['value'],
                confidence_score=result['confidence']
            )
        
        logger.info(f"Stored {len(results)} extracted fields for {document_type} in claim {claim_id}")
    
    def _format_response(self, claim_id: str, extracted_data: Dict, 
                        status: str) -> Dict:
        """Format the final API response"""
        return {
            'claim_id': claim_id,
            'extraction_status': status,
            'documents': extracted_data
        }


# Helper function for Django views to use
def extract_claim_fields(claim_id: str) -> Dict:
    """
    Main entry point for ML extraction from Django views
    """
    service = MLExtractionService()
    return service.extract_claim_data(claim_id)