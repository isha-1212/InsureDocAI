"""
Auth Service URL Configuration
"""
from django.urls import path
from . import views

app_name = 'auth_service'

urlpatterns = [
    # Health check (no auth required)
    path('health/', views.health_check, name='health_check'),
    
    # User endpoints
    path('me/', views.me, name='me'),
    path('validate/', views.validate_token, name='validate_token'),
    path('logout/', views.logout, name='logout'),
    
    # Admin endpoints
    path('admin/dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('admin/stats/', views.admin_stats, name='admin_stats'),
]
