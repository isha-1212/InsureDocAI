"""
User Views - Simplified for new User model
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from auth_service.permissions import IsAuthenticated, IsAdmin
from .models import User
from .serializers import UserSerializer, UserCreateSerializer


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user profiles
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    def get_permissions(self):
        if self.action == 'register':
            permission_classes = [AllowAny]
        elif self.action in ['list', 'destroy']:
            permission_classes = [IsAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_serializer_class(self):
        if self.action in ['create', 'register']:
            return UserCreateSerializer
        return UserSerializer
    
    def get_queryset(self):
        if getattr(self.request, 'role', None) == 'admin':
            return User.objects.all()
        else:
            user_id = getattr(self.request, 'user_id', None)
            if user_id:
                return User.objects.filter(supabase_user_id=user_id)
            return User.objects.none()
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        try:
            profile = User.objects.get(supabase_user_id=request.user_id)
            serializer = self.get_serializer(profile)
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response(
                {
                    "error": "Profile not found",
                    "detail": "User profile has not been created yet",
                    "user_id": str(request.user_id),
                    "email": getattr(request, 'email', '')
                },
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def register(self, request):
        """
        POST /users/profiles/register/
        Register a new user after Supabase signup
        Idempotent - returns existing user if already registered
        """
        supabase_user_id = request.data.get('supabase_user_id')
        email = request.data.get('email')
        
        if not supabase_user_id or not email:
            return Response(
                {"error": "supabase_user_id and email are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            existing_user = User.objects.get(supabase_user_id=supabase_user_id)
            return Response(
                {
                    "message": "User already registered",
                    "user": UserSerializer(existing_user).data,
                    "is_new": False
                },
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            pass
        
        try:
            existing_user_by_email = User.objects.get(email=email)
            if existing_user_by_email.supabase_user_id and existing_user_by_email.supabase_user_id != supabase_user_id:
                return Response(
                    {
                        "error": "Email already registered",
                        "detail": "An account with this email already exists"
                    },
                    status=status.HTTP_409_CONFLICT
                )
            else:
                existing_user_by_email.supabase_user_id = supabase_user_id
                if 'full_name' in request.data:
                    existing_user_by_email.full_name = request.data['full_name']
                if 'name' in request.data:
                    existing_user_by_email.name = request.data['name']
                if 'mobile' in request.data:
                    existing_user_by_email.mobile = request.data['mobile']
                if 'role' in request.data:
                    existing_user_by_email.role = request.data['role']
                existing_user_by_email.save()
                
                return Response(
                    {
                        "message": "User profile linked successfully",
                        "user": UserSerializer(existing_user_by_email).data,
                        "is_new": False
                    },
                    status=status.HTTP_200_OK
                )
        except User.DoesNotExist:
            pass
        
        serializer = UserCreateSerializer(data=request.data)
        if serializer.is_valid():
            profile = serializer.save()
            return Response(
                {
                    "message": "User registered successfully",
                    "user": UserSerializer(profile).data,
                    "is_new": True
                },
                status=status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
