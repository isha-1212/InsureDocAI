
from rest_framework import serializers
from django.utils import timezone
from .models import Policy, FamilyMember
from .models_document import PolicyDocument
from users.models import User


class FamilyMemberSerializer(serializers.ModelSerializer):
    
    age = serializers.ReadOnlyField()
    
    class Meta:
        model = FamilyMember
        fields = [
            'id',
            'policy',
            'name',
            'dob',
            'age',
            'relation',
            'is_minor',
            'created_at',
        ]
        read_only_fields = ['id', 'is_minor', 'created_at', 'age']
    
    def validate_dob(self, value):
        """Validate date of birth is not in future"""
        if value and value > timezone.now().date():
            raise serializers.ValidationError("Date of birth cannot be in the future")
        return value


class FamilyMemberCreateSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = FamilyMember
        fields = ['name', 'dob', 'relation']
    
    def validate_dob(self, value):
        """Validate date of birth is not in future"""
        if value and value > timezone.now().date():
            raise serializers.ValidationError("Date of birth cannot be in the future")
        return value


class PolicySerializer(serializers.ModelSerializer):
    
    family_members = FamilyMemberSerializer(many=True, read_only=True)
    family_members_count = serializers.SerializerMethodField()
    is_active = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()
    has_document = serializers.SerializerMethodField()
    
    # User details
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_mobile = serializers.CharField(source='user.mobile', read_only=True)
    user_id = serializers.IntegerField(source='user.user_id', read_only=True)
    
    class Meta:
        model = Policy
        fields = [
            'id',
            'user',
            'user_id',
            'user_email',
            'user_name',
            'user_mobile',
            'policy_number',
            'start_date',
            'end_date',
            'policy_document_url',
            'has_document',
            'status',
            'rejection_reason',
            'is_active',
            'is_expired',
            'family_members',
            'family_members_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
    
    def get_family_members_count(self, obj):
        """Get count of family members"""
        return obj.get_family_members_count()

    def get_has_document(self, obj):
        """Return True if there is at least one PolicyDocument attached."""
        # Uses related_name='documents' from PolicyDocument model
        return obj.documents.exists()
    
    def validate_policy_number(self, value):
        """Ensure policy number is unique"""
        instance = self.instance
        if Policy.objects.filter(policy_number=value).exclude(pk=instance.pk if instance else None).exists():
            raise serializers.ValidationError("Policy number already exists")
        return value
    
    def validate(self, data):
        """Validate date range"""
        if 'start_date' in data and 'end_date' in data:
            if data['start_date'] >= data['end_date']:
                raise serializers.ValidationError({
                    'end_date': 'End date must be after start date'
                })
        return data


class PolicyCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating a new policy
    User is set from request.user
    """
    
    family_members = FamilyMemberCreateSerializer(many=True, required=False)
    
    class Meta:
        model = Policy
        fields = [
            'policy_number',
            'start_date',
            'end_date',
            'policy_document_url',
            'family_members',
        ]
    
    def validate_policy_number(self, value):
        """Ensure policy number is unique"""
        if Policy.objects.filter(policy_number=value).exists():
            raise serializers.ValidationError("Policy number already exists")
        return value
    
    def validate(self, data):
        """Validate date range"""
        if data['start_date'] >= data['end_date']:
            raise serializers.ValidationError({
                'end_date': 'End date must be after start date'
            })
        return data
    
    def create(self, validated_data):
        """Create policy with family members"""
        family_members_data = validated_data.pop('family_members', [])
        
        # Create policy
        policy = Policy.objects.create(**validated_data)
        
        # Create family members
        for member_data in family_members_data:
            FamilyMember.objects.create(policy=policy, **member_data)
        
        return policy


class PolicyUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating policy details
    Only certain fields can be updated
    """
    
    class Meta:
        model = Policy
        fields = [
            'policy_number',
            'start_date',
            'end_date',
            'policy_document_url',
        ]
    
    def validate_policy_number(self, value):
        """Ensure policy number is unique"""
        instance = self.instance
        if Policy.objects.filter(policy_number=value).exclude(pk=instance.pk).exists():
            raise serializers.ValidationError("Policy number already exists")
        return value
    
    def validate(self, data):
        """Validate date range"""
        start_date = data.get('start_date', self.instance.start_date)
        end_date = data.get('end_date', self.instance.end_date)
        
        if start_date >= end_date:
            raise serializers.ValidationError({
                'end_date': 'End date must be after start date'
            })
        return data


class PolicyStatusUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for admin to approve/reject policies
    """
    
    class Meta:
        model = Policy
        fields = ['status', 'rejection_reason']
    
    def validate(self, data):
        """Ensure rejection_reason is provided when rejecting"""
        if data.get('status') == 'rejected' and not data.get('rejection_reason'):
            raise serializers.ValidationError({
                'rejection_reason': 'Rejection reason is required when rejecting a policy'
            })
        return data


class PolicyListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing policies
    Without nested family members for performance
    """
    
    family_members_count = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    is_active = serializers.ReadOnlyField()
    has_document = serializers.SerializerMethodField()
    
    class Meta:
        model = Policy
        fields = [
            'id',
            'user_id',
            'user_email',
            'user_name',
            'policy_number',
            'start_date',
            'end_date',
            'status',
            'is_active',
             'has_document',
            'family_members_count',
            'created_at',
        ]
    
    def get_family_members_count(self, obj):
        """Get count of family members"""
        return obj.get_family_members_count()

    def get_has_document(self, obj):
        """Return True if there is at least one PolicyDocument attached."""
        return obj.documents.exists()


class UserWithPolicySerializer(serializers.ModelSerializer):
    """
    User serializer with their policy information
    Used for admin dashboard to see all families
    """
    
    policy = PolicySerializer(read_only=True)
    has_policy = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'full_name',
            'mobile',
            'role',
            'has_policy',
            'policy',
            'created_at',
        ]
    
    def get_has_policy(self, obj):
        """Check if user has submitted a policy"""
        return hasattr(obj, 'policy')


class DocumentUploadSerializer(serializers.Serializer):
    """
    Serializer for document uploads with business rule validation
    
    Business Rules:
    - If family member is minor: PAN/Aadhaar must belong to parent (father/mother)
    - If family member is adult: All documents must belong to self
    - Documents are uploaded to appropriate buckets based on document_type
    """
    
    policy_id = serializers.IntegerField(required=True)
    family_member_id = serializers.IntegerField(required=False, allow_null=True)
    document_type = serializers.ChoiceField(
        choices=['PAN', 'AADHAAR', 'HOSPITAL_BILL', 'PHARMACY_BILL', 'POLICY'],
        required=True
    )
    belongs_to_relation = serializers.ChoiceField(
        choices=['self', 'father', 'mother'],
        required=True
    )
    file = serializers.FileField(required=True)
    
    def validate_file(self, value):
        """Validate file type and size"""
        allowed_types = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError(
                'Invalid file type. Only PDF, JPG, and PNG are allowed.'
            )
        
        # Max 5MB
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError(
                'File too large. Maximum size is 5MB.'
            )
        
        return value
    
    def validate(self, data):
        """Validate business rules for minor/adult family members"""
        user = self.context.get('user')
        if not user:
            raise serializers.ValidationError('User authentication required')
        
        # Validate policy ownership
        try:
            policy = Policy.objects.get(id=data['policy_id'], user=user)
        except Policy.DoesNotExist:
            raise serializers.ValidationError({
                'policy_id': 'Policy not found or you do not have access'
            })
        
        data['policy'] = policy
        
        # If family_member_id is provided, validate it
        if data.get('family_member_id'):
            try:
                family_member = FamilyMember.objects.get(
                    id=data['family_member_id'],
                    policy=policy
                )
            except FamilyMember.DoesNotExist:
                raise serializers.ValidationError({
                    'family_member_id': 'Family member not found in this policy'
                })
            
            data['family_member'] = family_member
            
            # Business Rule: Minor family members
            if family_member.is_minor:
                # For minors, only PAN and AADHAAR documents are relevant for validation
                if data['document_type'] in ('PAN', 'AADHAAR'):
                    if data['belongs_to_relation'] not in ('father', 'mother'):
                        raise serializers.ValidationError({
                            'belongs_to_relation': 
                                f"For minor family members, {data['document_type']} must belong to father or mother"
                        })
            else:
                # Business Rule: Adult family members - documents must belong to self
                if data['belongs_to_relation'] != 'self':
                    raise serializers.ValidationError({
                        'belongs_to_relation': 
                            'For adult family members, documents must belong to self'
                    })
        else:
            # No family member specified - documents belong to policy holder (self)
            if data['belongs_to_relation'] != 'self':
                raise serializers.ValidationError({
                    'belongs_to_relation': 
                        'Documents for policy holder must belong to self'
                })
            data['family_member'] = None
        
        return data


class PolicyDocumentSerializer(serializers.ModelSerializer):
    """Serializer for PolicyDocument with signed URL generation"""
    
    family_member_name = serializers.CharField(source='family_member.name', read_only=True)
    family_member_relation = serializers.CharField(source='family_member.relation', read_only=True)
    
    class Meta:
        model = PolicyDocument
        fields = [
            'id',
            'document_type',
            'belongs_to_relation',
            'family_member',
            'family_member_name',
            'family_member_relation',
            'bucket_name',
            'file_path',
            'file_size',
            'content_type',
            'uploaded_at',
        ]
        read_only_fields = ['id', 'uploaded_at']
