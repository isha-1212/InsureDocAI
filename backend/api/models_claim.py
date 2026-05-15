"""
Claim models for the mediclaim system
"""

import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from users.models import User


class Claim(models.Model):
    """
    Insurance claim model
    """
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('reapplied', 'Reapplied'),
    ]
    
    # UUID primary key  
    claim_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    # Foreign key relationships
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='claims',
        db_column='user_id'
    )
    policy = models.ForeignKey(
        'api.Policy',
        on_delete=models.CASCADE,
        related_name='claims',
        db_column='policy_id'
    )
    member = models.ForeignKey(
        'api.FamilyMember',
        on_delete=models.SET_NULL,
        related_name='claims',
        db_column='member_id',
        null=True,
        blank=True
    )
    
    # Claim details
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    rejection_reason = models.TextField(
        null=True,
        blank=True
    )
    is_reopened = models.BooleanField(
        default=False
    )
    reopen_reason = models.TextField(
        null=True,
        blank=True
    )
    reopened_at = models.DateTimeField(
        null=True,
        blank=True
    )
    is_reapplied = models.BooleanField(
        default=False
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'claims'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Claim {self.claim_id} - {self.status}"


class ClaimEvent(models.Model):
    EVENT_CHOICES = [
        ('submitted', 'Submitted'),
        ('pending', 'Pending'),
        ('rejected', 'Rejected'),
        ('edited', 'Edited'),
        ('reapplied', 'Reapplied'),
        ('reopened', 'Reopened'),
        ('approved', 'Approved'),
    ]

    id = models.BigAutoField(primary_key=True)
    claim = models.ForeignKey(
        'api.Claim',
        on_delete=models.CASCADE,
        related_name='timeline_events',
        db_column='claim_id'
    )
    event_type = models.CharField(
        max_length=20,
        choices=EVENT_CHOICES,
        db_index=True
    )
    event_label = models.CharField(
        max_length=100
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'claim_events'
        ordering = ['created_at', 'id']

    def __str__(self):
        return f"{self.claim_id} - {self.event_type}"

