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
        # Reuse existing user if email already exists to avoid UNIQUE constraint failures
        user = user_model.objects.filter(email=email).first()

        if not user:
            user_kwargs = { 'email': email }
            if hasattr(user_model, 'USERNAME_FIELD') and user_model.USERNAME_FIELD != 'email':
                user_kwargs['username'] = email

            try:
                user = user_model.objects.create_user(**user_kwargs)
            except TypeError:
                user = user_model.objects.create(**user_kwargs)

            if password:
                user.set_password(password)
            # Set basic flags for newly created user
            if hasattr(user, 'is_staff'):
                setattr(user, 'is_staff', True)
            if hasattr(user, 'is_faculty'):
                setattr(user, 'is_faculty', True)
            user.save()
        else:
            # Existing user found — update basic flags and optionally password if provided
            if password:
                try:
                    user.set_password(password)
                except Exception:
                    pass
            if hasattr(user, 'is_staff'):
                setattr(user, 'is_staff', True)
            if hasattr(user, 'is_faculty'):
                setattr(user, 'is_faculty', True)
            user.save()

        # Prevent creating duplicate StaffProfile for an existing user
        from rest_framework import serializers as _serializers
        if StaffProfile.objects.filter(user=user).exists():
            raise _serializers.ValidationError({'user': 'StaffProfile already exists for this user'})

        staff = StaffProfile.objects.create(user=user, **validated_data)
        # ---------------------------------------------------------
        # 3. CRITICAL FIX: Link User to Department as HoD/AHoD
        # ---------------------------------------------------------
        department = validated_data.get('department') or getattr(staff, 'department', None)
        # Safer way to handle potential None values for designation
        designation = (validated_data.get('designation') or '').lower()

        if department:
            # Normalize department: if it's a PK, resolve to model instance
            from .models import Department as _Department
            if not isinstance(department, _Department):
                try:
                    department = _Department.objects.get(pk=department)
                except Exception:
                    department = None

            if department:
                if 'hod' in designation and 'assistant' not in designation and 'ahod' not in designation:
                    # Set as Head of Department
                    department.head_of_department = user
                    department.save()
                elif 'ahod' in designation or 'assistant' in designation:
                    # Set as Assistant Head
                    department.ahod = user
                    department.save()

        return staff
