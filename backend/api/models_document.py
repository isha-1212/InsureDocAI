import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

class ClaimDocument(models.Model):
    """
    Documents uploaded for claims
    One document per type per claim (UNIQUE constraint)
    """
    
    DOCUMENT_TYPE_CHOICES = [
        ('hospital_bill', 'Hospital Bill'),
        ('pharmacy_bill', 'Pharmacy Bill'), 
        ('aadhaar', 'Aadhaar Card'),
        ('pan', 'PAN Card'),
        ('birth_certificate', 'Birth Certificate'),
    ]
    REVIEW_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    # UUID primary key
    document_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    # Foreign key to claim
    claim = models.ForeignKey(
        'api.Claim',
        on_delete=models.CASCADE,
        related_name='documents',
        db_column='claim_id'
    )
    
    # Document details
    document_type = models.CharField(
        max_length=20,
        choices=DOCUMENT_TYPE_CHOICES,
        help_text="Type of document - determines bucket and extractor to use"
    )
    file_path = models.TextField(
        help_text="Path inside Supabase Storage bucket"
    )
    file_url = models.URLField(
        max_length=1000,
        help_text="Public or signed URL for the document"
    )
    review_status = models.CharField(
        max_length=20,
        choices=REVIEW_STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    review_remarks = models.TextField(
        blank=True,
        null=True
    )
    reviewed_at = models.DateTimeField(
        blank=True,
        null=True
    )
    reviewed_by = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )
    
    # Timestamp
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'claim_documents'
        ordering = ['-uploaded_at']
        # Ensure only one document per type per claim
        unique_together = [['claim', 'document_type']]
    
    def __str__(self):
        return f"{self.document_type} for Claim {self.claim_id}"


class ClaimExtractedField(models.Model):
    """
    AI/ML extracted fields from claim documents
    Stores field name, value, and confidence score
    """
    
    id = models.AutoField(primary_key=True)
    
    # Foreign key to claim
    claim = models.ForeignKey(
        'api.Claim',
        on_delete=models.CASCADE,
        related_name='extracted_fields',
        db_column='claim_id'
    )
    
    # Document type (same as bucket name and determines which extractor was used)
    document_type = models.CharField(
        max_length=20,
        choices=ClaimDocument.DOCUMENT_TYPE_CHOICES,
        help_text="Document type - same as bucket name"
    )
    
    # Extracted field details
    field_name = models.CharField(
        max_length=100,
        help_text="Name of the extracted field (e.g., 'patient_name', 'amount')"
    )
    field_value = models.TextField(
        help_text="Extracted value from the document"
    )
    confidence_score = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        validators=[MinValueValidator(0.00), MaxValueValidator(1.00)],
        help_text="Confidence score between 0.00 and 1.00"
    )
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'claim_extracted_fields'
        ordering = ['-created_at']
        # Ensure only one field per document type per claim
        unique_together = [['claim', 'document_type', 'field_name']]
    
    def __str__(self):
        return f"{self.field_name}: {self.field_value} ({self.confidence_score}) - Claim {self.claim_id}"
"""
Policy Document Model
Stores metadata for files uploaded to Supabase Storage
"""
from django.db import models
from users.models import User


class PolicyDocument(models.Model):
    """
    Track uploaded policy documents in Supabase Storage
    
    Supports minor family member business rules:
    - If claim is for a minor, PAN/Aadhaar must belong to parent (father/mother)
    - Documents stored in appropriate buckets (pan, aadhaar, hospital_bills, etc.)
    """
    
    DOCUMENT_TYPE_CHOICES = [
        ('PAN', 'PAN Card'),
        ('AADHAAR', 'Aadhaar Card'),
        ('HOSPITAL_BILL', 'Hospital Bill'),
        ('PHARMACY_BILL', 'Pharmacy Bill'),
        ('POLICY', 'Policy Document'),
    ]
    
    BELONGS_TO_CHOICES = [
        ('self', 'Self'),
        ('father', 'Father'),
        ('mother', 'Mother'),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='policy_documents',
        db_column='user_id',
        null=True,
        blank=True
    )
    policy = models.ForeignKey(
        'Policy',
        on_delete=models.CASCADE,
        related_name='documents',
        db_column='policy_id'
    )
    family_member = models.ForeignKey(
        'FamilyMember',
        on_delete=models.CASCADE,
        related_name='documents',
        db_column='family_member_id',
        null=True,
        blank=True,
        help_text="The family member this document belongs to (if applicable)"
    )
    
    # Document metadata
    document_type = models.CharField(
        max_length=20,
        choices=DOCUMENT_TYPE_CHOICES,
        default='POLICY',
        help_text="Type of document uploaded"
    )
    belongs_to_relation = models.CharField(
        max_length=10,
        choices=BELONGS_TO_CHOICES,
        default='self',
        help_text="Whose document this is - self, father, or mother"
    )
    
    # Storage metadata
    bucket_name = models.CharField(
        max_length=100,
        default='policies',
        help_text="Supabase Storage bucket name"
    )
    file_path = models.CharField(
        max_length=500,
        help_text="Path in Supabase Storage"
    )
    file_size = models.IntegerField(help_text="Size in bytes")
    content_type = models.CharField(max_length=100, help_text="MIME type")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'policy_documents'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['user', 'document_type']),
            models.Index(fields=['policy', 'family_member']),
            models.Index(fields=['document_type', 'belongs_to_relation']),
        ]
    
    def __str__(self):
        if self.family_member:
            return f"{self.document_type} for {self.family_member.name} ({self.belongs_to_relation})"
        return f"{self.document_type} for Policy {self.policy.policy_number}"
    
    def clean(self):
        """Validate business rules"""
        from django.core.exceptions import ValidationError
        
        # If family_member is a minor, PAN/Aadhaar must belong to parent
        if self.family_member and self.family_member.is_minor:
            if self.document_type in ('PAN', 'AADHAAR'):
                if self.belongs_to_relation not in ('father', 'mother'):
                    raise ValidationError(
                        f"For minor family members, {self.document_type} must belong to father or mother"
                    )
        
        # If not a minor, documents must belong to self
        if self.family_member and not self.family_member.is_minor:
            if self.belongs_to_relation != 'self':
                raise ValidationError(
                    "For adult family members, documents must belong to self"
                )
