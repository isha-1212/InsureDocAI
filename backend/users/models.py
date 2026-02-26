from django.db import models
import uuid


class User(models.Model):
    
    user_id = models.AutoField(primary_key=True)
    
    supabase_user_id = models.UUIDField(
        unique=True, 
        db_index=True,
        null=True,
        blank=True
    )
    
    name = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(unique=True, db_index=True, null=True, blank=True)
    full_name = models.CharField(max_length=255, blank=True, null=True)
    mobile = models.CharField(max_length=20, blank=True, null=True)
    
    role = models.CharField(
        max_length=20,
        choices=[
            ('user', 'User'),
            ('admin', 'Admin'),
        ],
        default='user',
        db_index=True
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['supabase_user_id']),
        ]
    
    def __str__(self):
        return f"{self.email} ({self.role})"
    
    @property
    def is_admin(self):
        """Check if user is admin"""
        return self.role == 'admin'
    
    @property
    def is_user(self):
        """Check if user is regular user"""
        return self.role == 'user'


# Keep backward compatibility alias
UserProfile = User
