from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    
    id = serializers.IntegerField(source='user_id', read_only=True)
    is_admin = serializers.SerializerMethodField()
    is_user = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(default=True, read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id',
            'user_id',
            'email',
            'role',
            'full_name',
            'name',
            'mobile',
            'is_active',
            'is_admin',
            'is_user',
            'created_at',
        ]
        read_only_fields = ['user_id', 'created_at', 'supabase_user_id']
    
    def get_is_admin(self, obj):
        return obj.role == 'admin'
    
    def get_is_user(self, obj):
        return obj.role == 'user'


class UserCreateSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = User
        fields = [
            'supabase_user_id',
            'email',
            'role',
            'full_name',
            'mobile',
        ]
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User already registered with this email")
        return value
    
    def validate_supabase_user_id(self, value):
        if User.objects.filter(supabase_user_id=value).exists():
            raise serializers.ValidationError("User profile already exists for this Supabase user")
        return value


# Backward compatibility aliases
UserProfile = User
UserProfileSerializer = UserSerializer
UserProfileCreateSerializer = UserCreateSerializer
