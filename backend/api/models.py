
from django.db import models
from django.core.validators import MinValueValidator
from users.models import User

# Import models from separate files
from .models_document import PolicyDocument, ClaimDocument, ClaimExtractedField
from .models_claim import Claim

__all__ = ['Policy', 'FamilyMember', 'PolicyDocument', 'Claim', 'ClaimDocument', 'ClaimExtractedField']


class Policy(models.Model):
    
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    id = models.AutoField(primary_key=True)
    
    # One-to-One with User (one family = one policy)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='policy'
    )
    
    # Policy details
    policy_number = models.CharField(max_length=100, unique=True)
    start_date = models.DateField(help_text="Policy start date")
    end_date = models.DateField(help_text="Policy expiry date")
    
    # Supabase Storage URL
    policy_document_url = models.URLField(
        max_length=500,
        help_text="Supabase Storage public URL for policy PDF/Image"
    )
    
    # Admin review status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    rejection_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Admin provides reason if policy is rejected"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'policies'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['status']),
            models.Index(fields=['policy_number']),
        ]
    
    def __str__(self):
        return f"{self.policy_number} - {self.user.email}"
    
    @property
    def is_active(self):
        """Check if policy is currently valid"""
        from django.utils import timezone
        today = timezone.now().date()
        return (
            self.status == 'approved' and
            self.start_date <= today <= self.end_date
        )
    
    @property
    def is_expired(self):
        """Check if policy has expired"""
        from django.utils import timezone
        today = timezone.now().date()
        return today > self.end_date
    
    def get_family_members_count(self):
        """Get count of family members under this policy"""
        return self.family_members.count()


class FamilyMember(models.Model):
    """
    Family Members covered under a policy
    All members share the same policy_id
    Exactly how insurance companies structure it
    """
    
    RELATION_CHOICES = [
        ('self', 'Self'),
        ('spouse', 'Spouse'),
        ('child', 'Child'),
        ('parent', 'Parent'),
        ('father', 'Father'),
        ('mother', 'Mother'),
        ('son', 'Son'),
        ('daughter', 'Daughter'),
    ]
    
    id = models.AutoField(primary_key=True)
    
    # Foreign key to Policy (many family members → one policy)
    policy = models.ForeignKey(
        Policy,
        on_delete=models.CASCADE,
        related_name='family_members',
        help_text="All family members belong to one policy"
    )
    
    # Member information
    name = models.CharField(max_length=255)
    dob = models.DateField(blank=True, null=True, help_text="Date of birth")
    relation = models.CharField(
        max_length=20,
        choices=RELATION_CHOICES,
        help_text="Relation to policy holder"
    )
    is_minor = models.BooleanField(
        default=False,
        help_text="Automatically set based on age"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'family_members'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['policy']),
            models.Index(fields=['relation']),
        ]
        unique_together = ('policy', 'name', 'dob', 'relation')
    
    def __str__(self):
        return f"{self.name} ({self.relation}) - Policy: {self.policy.policy_number}"
    
    def save(self, *args, **kwargs):
        """Auto-calculate is_minor based on DOB"""
        if self.dob:
            from django.utils import timezone
            today = timezone.now().date()
            age = (today - self.dob).days / 365.25
            self.is_minor = age < 18
        super().save(*args, **kwargs)
    
    @property
    def age(self):
        """Calculate current age"""
        if not self.dob:
            return None
        from django.utils import timezone
        today = timezone.now().date()
        return int((today - self.dob).days / 365.25)
