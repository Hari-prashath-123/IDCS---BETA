from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import StudentProfile, Course
from .models import Department, StaffProfile

from .models import StaffProfile


User = get_user_model()


class CourseSerializer(serializers.ModelSerializer):
    total_marks = serializers.ReadOnlyField()
    target_departments = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Department.objects.all(),
        required=False
    )
    
    class Meta:
        model = Course
        fields = [
            'id', 'name', 'code', 'semester', 'admin_department_name',
            'target_departments', 'class_types', 'category',
            'L', 'T', 'P', 'S', 'C',
            'internal_marks', 'external_marks', 'total_marks',
            'created_at', 'updated_at'
        ]


class StudentProfileSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )

    class Meta:
        model = StudentProfile
        fields = [
            'id',
            'user',
            'user_id',
            'reg_no',
            'roll_no',
            'name',
            'department',
            'year',
            'section',
            'dob',
            'created_at',
            'updated_at',
        ]


class StaffProfileSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )

    class Meta:
        model = StaffProfile
        fields = [
            'id',
            'user',
            'user_id',
            'faculty_id',
            'name',
            'department',
            'designation',
            'created_at',
            'updated_at',
        ]


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'type', 'parent']


class StudentCreateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = StudentProfile
        # include all relevant fields plus email/password
        fields = [
            'id', 'email', 'password', 'reg_no', 'roll_no', 'name', 'department', 'year', 'section', 'dob',
            'phone_number', 'father_name', 'mother_name', 'parent_phone', 'address', 'community', 'residence',
            'is_first_graduate', 'mentor',
        ]

    def create(self, validated_data):
        email = validated_data.pop('email')
        password = validated_data.pop('password', None) or None
        # create user
        user_model = User
        user_kwargs = { 'email': email }
        # set username if field exists on model
        if hasattr(user_model, 'USERNAME_FIELD') and user_model.USERNAME_FIELD != 'email':
            user_kwargs['username'] = email

        # Use create_user if available for proper password hashing
        try:
            user = user_model.objects.create_user(**user_kwargs)
        except TypeError:
            # fallback: create and set password
            user = user_model.objects.create(**user_kwargs)

        if password:
            user.set_password(password)
        # mark as student if field exists
        if hasattr(user, 'is_student'):
            setattr(user, 'is_student', True)
        user.save()

        # create student profile
        student = StudentProfile.objects.create(user=user, **validated_data)
        return student


class StaffCreateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = StaffProfile
        fields = [
            'id', 'email', 'password', 'faculty_id', 'name', 'department', 'designation', 'date_of_joining',
            'phone_number', 'address',
        ]

    def create(self, validated_data):
        email = validated_data.pop('email')
        password = validated_data.pop('password', None) or None
        user_model = User
        user_kwargs = { 'email': email }
        if hasattr(user_model, 'USERNAME_FIELD') and user_model.USERNAME_FIELD != 'email':
            user_kwargs['username'] = email

        try:
            user = user_model.objects.create_user(**user_kwargs)
        except TypeError:
            user = user_model.objects.create(**user_kwargs)

        if password:
            user.set_password(password)
        if hasattr(user, 'is_staff'):
            setattr(user, 'is_staff', True)
        if hasattr(user, 'is_faculty'):
            setattr(user, 'is_faculty', True)
        user.save()

        staff = StaffProfile.objects.create(user=user, **validated_data)
        return staff
