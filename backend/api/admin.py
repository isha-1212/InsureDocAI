from django.contrib import admin
from .models import Policy, FamilyMember, PolicyDocument


@admin.register(Policy)
class PolicyAdmin(admin.ModelAdmin):
    list_display = ['policy_number', 'user', 'status', 'start_date', 'end_date', 'created_at']
    list_filter = ['status', 'start_date', 'end_date', 'created_at']
    search_fields = ['policy_number', 'user__email', 'user__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('User Info', {
            'fields': ('user',)
        }),
        ('Policy Details', {
            'fields': ('policy_number', 'start_date', 'end_date', 'policy_document_url')
        }),
        ('Status', {
            'fields': ('status', 'rejection_reason')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(FamilyMember)
class FamilyMemberAdmin(admin.ModelAdmin):
    list_display = ['name', 'policy', 'relation', 'dob', 'is_minor', 'created_at']
    list_filter = ['relation', 'is_minor', 'created_at']
    search_fields = ['name', 'policy__policy_number', 'policy__user__email']
    readonly_fields = ['id', 'created_at']
    
    fieldsets = (
        ('Policy', {
            'fields': ('policy',)
        }),
        ('Member Info', {
            'fields': ('name', 'dob', 'relation', 'is_minor')
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )


@admin.register(PolicyDocument)
class PolicyDocumentAdmin(admin.ModelAdmin):
    list_display = ['policy', 'user', 'file_path', 'file_size', 'content_type', 'uploaded_at']
    list_filter = ['content_type', 'uploaded_at']
    search_fields = ['policy__policy_number', 'user__email', 'file_path']
    readonly_fields = ['uploaded_at']
    
    fieldsets = (
        ('Linked Records', {
            'fields': ('user', 'policy')
        }),
        ('Storage Info', {
            'fields': ('bucket_name', 'file_path', 'file_size', 'content_type')
        }),
        ('Timestamp', {
            'fields': ('uploaded_at',)
        }),
    )
