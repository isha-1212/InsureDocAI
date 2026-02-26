from django.contrib import admin
from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['email', 'role', 'full_name', 'mobile', 'is_active', 'created_at']
    list_filter = ['role', 'is_active', 'created_at']
    search_fields = ['email', 'full_name', 'mobile', 'name']
    readonly_fields = ['user_id', 'supabase_user_id', 'created_at']
    
    fieldsets = (
        ('Authentication', {
            'fields': ('user_id', 'supabase_user_id', 'email', 'role')
        }),
        ('Personal Info', {
            'fields': ('name', 'full_name', 'mobile')
        }),
        ('Status', {
            'fields': ('is_active', 'created_at')
        }),
    )
