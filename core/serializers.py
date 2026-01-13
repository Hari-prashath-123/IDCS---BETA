from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.db import IntegrityError
from .models import StudentProfile, Course, Department, StaffProfile, CourseAllocation


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


class CourseAllocationSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())
    courses = serializers.PrimaryKeyRelatedField(many=True, queryset=Course.objects.all(), required=False)

    class Meta:
        model = CourseAllocation
        fields = ['id', 'department', 'batch_year', 'semester', 'courses', 'created_at', 'updated_at']
    
    def to_representation(self, instance):
        """Return nested course details when reading."""
        representation = super().to_representation(instance)
        # Include course names and details in read representation
        representation['courses'] = CourseSerializer(instance.courses.all(), many=True).data
        return representation


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

        # 1. Create or Get User
        user_model = User
        user = user_model.objects.filter(email=email).first()

        if not user:
            user_kwargs = {'email': email}
            if hasattr(user_model, 'USERNAME_FIELD') and user_model.USERNAME_FIELD != 'email':
                user_kwargs['username'] = email
            try:
                user = user_model.objects.create_user(**user_kwargs)
            except TypeError:
                user = user_model.objects.create(**user_kwargs)

            if password:
                user.set_password(password)

            # Set flags for new user
            if hasattr(user, 'is_staff'):
                setattr(user, 'is_staff', True)
            if hasattr(user, 'is_faculty'):
                setattr(user, 'is_faculty', True)
            user.save()
        else:
            # Update existing user
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

        # 2. Create or Update Profile
        from rest_framework import serializers as _serializers
        existing_staff = StaffProfile.objects.filter(user=user).first()
        
        # Store department and designation BEFORE updating profile
        department = validated_data.get('department')
        designation = validated_data.get('designation', '')
        
        if existing_staff:
            # Update existing staff profile
            for field, value in validated_data.items():
                setattr(existing_staff, field, value)
            try:
                existing_staff.save()
                staff = existing_staff
            except IntegrityError as e:
                msg = str(e)
                if 'faculty_id' in msg:
                    raise _serializers.ValidationError({'faculty_id': 'A staff member with this Faculty ID already exists.'})
                raise _serializers.ValidationError({'detail': msg})
        else:
            # Create new profile
            try:
                staff = StaffProfile.objects.create(user=user, **validated_data)
            except IntegrityError as e:
                # This catches unique constraint failures (e.g. faculty_id or user)
                msg = str(e)
                if 'faculty_id' in msg:
                    raise _serializers.ValidationError({'faculty_id': 'A staff member with this Faculty ID already exists.'})
                if 'user_id' in msg or 'user' in msg:
                    raise _serializers.ValidationError({'user': 'A StaffProfile already exists for this user.'})
                # Generic fallback
                raise _serializers.ValidationError({'detail': msg})

        # 3. Assign Role (HoD / AHoD) - use saved department and designation from above
        if not department:
            department = getattr(staff, 'department', None)
        if not designation:
            designation = getattr(staff, 'designation', '')
        
        designation = str(designation).lower()

        if department:
            # Ensure department is a model instance (handles raw IDs if passed)
            from .models import Department as _Department
            if not isinstance(department, _Department):
                try:
                    department = _Department.objects.get(pk=department)
                except Exception:
                    department = None

            if department:
                # Broader check: looks for "hod", "head", "chair"
                is_head = any(x in designation for x in ['hod', 'head', 'chair'])
                is_assistant = any(x in designation for x in ['assistant', 'ahod', 'assist'])

                if is_head and not is_assistant:
                    print(f"Assigning {user.email} as HoD of {department.name}")
                    department.head_of_department = user
                    department.save()
                elif is_assistant:
                    print(f"Assigning {user.email} as AHoD of {department.name}")
                    department.ahod = user
                    department.save()

        return staff
