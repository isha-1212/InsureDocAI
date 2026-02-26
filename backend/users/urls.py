"""
Users URL Configuration
"""
from django.urls import path, include
from rest_framework.routers import SimpleRouter
from . import views

router = SimpleRouter()
router.register(r'users', views.UserViewSet, basename='user')

app_name = 'users'

urlpatterns = [
    path('', include(router.urls)),
]
