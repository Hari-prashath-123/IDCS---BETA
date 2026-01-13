import pandas as pd
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.core.files.storage import default_storage
from django.contrib.auth import get_user_model

from .models import Course, StudentProfile, StaffProfile, Department, CourseAllocation, ClassAdvisor, Timetable, CurriculumBatch
from .serializers import CourseSerializer, StudentProfileSerializer
from .serializers import StaffProfileSerializer, DepartmentSerializer
from .serializers import StudentCreateSerializer, StaffCreateSerializer
from .serializers import CourseAllocationSerializer, ClassAdvisorSerializer, TimetableSerializer

from rest_framework import generics
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from django.db import IntegrityError
from rest_framework.permissions import IsAdminUser, AllowAny
from django.db.models import Q

User = get_user_model()


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    def get_queryset(self):
        """
        Optionally filter courses by semester or department.
        Admins see all courses.
        HODs/Staff see approved courses OR courses they created.
        Examples:
            ?semester=3
            ?department=5 (filters by target_departments)
        """
        user = getattr(self.request, 'user', None)
        queryset = Course.objects.all().prefetch_related('target_departments')

        # Admins see everything
        if user and user.is_authenticated and user.is_superuser:
            base_qs = queryset
        else:
            # Non-admins should see approved courses or those they created
            if user and user.is_authenticated:
                base_qs = queryset.filter(Q(is_approved=True) | Q(created_by=user))
            else:
                # anonymous users only see approved courses
                base_qs = queryset.filter(is_approved=True)

        # Filter by semester
        semester = self.request.query_params.get('semester', None)
        if semester is not None:
            base_qs = base_qs.filter(semester=semester)

        # Filter by target department
        department = self.request.query_params.get('department', None)
        if department is not None:
            base_qs = base_qs.filter(target_departments__id=department).distinct()

        return base_qs

    def create(self, request, *args, **kwargs):
        """
        Override create to set approval metadata based on user role.
        - Superusers: is_approved=True
        - Other authenticated users: is_approved=False and created_by=request.user
        """
        # Make a mutable copy of incoming data
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        user = getattr(request, 'user', None)

        # By default, creations require admin approval. To immediately approve
        # at creation time an explicit `auto_approve=true` must be sent and the
        # requesting user must be a superuser.
        auto_approve = False
        try:
            # allow both string and boolean forms
            if 'auto_approve' in data:
                v = data.get('auto_approve')
                if isinstance(v, str):
                    auto_approve = v.lower() in ['1', 'true', 'yes']
                else:
                    auto_approve = bool(v)
                # remove flag so serializer doesn't fail on unknown field
                data.pop('auto_approve', None)
        except Exception:
            auto_approve = False

        # If explicitly requested and the user is superuser, allow immediate approval
        if user and user.is_authenticated and getattr(user, 'is_superuser', False) and auto_approve:
            data['is_approved'] = True
            data.pop('created_by', None)
        else:
            # mark as pending approval
            data['is_approved'] = False
            data['is_rejected'] = False
            if user and user.is_authenticated:
                data['created_by'] = getattr(user, 'id', None)

        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception as e:
            # Log payload and validation errors to server console for debugging
            try:
                print('Course create validation failed. Payload:', data)
                print('Validation errors:', serializer.errors)
            except Exception:
                pass
            # Return structured errors to client
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        self.perform_create(serializer)

        # If created by an admin and course has batch/semester and target_departments,
        # auto-add the course to CourseAllocation for those departments so it appears
        # immediately in semester allocations.
        try:
            course_obj = serializer.instance
            if user and user.is_authenticated and user.is_superuser:
                # require batch and semester to be present
                if getattr(course_obj, 'batch', None) and getattr(course_obj, 'semester', None):
                    # iterate through target_departments M2M
                    for dept in course_obj.target_departments.all():
                        try:
                            allocation, created = CourseAllocation.objects.get_or_create(
                                department=dept,
                                batch_year=course_obj.batch,
                                semester=course_obj.semester,
                            )
                            allocation.courses.add(course_obj)
                            allocation.save()
                        except Exception:
                            # don't block creation on allocation errors
                            pass
        except Exception:
            pass

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def approve(self, request, pk=None):
        """Approve a course (admin only)."""
        course = self.get_object()
        course.is_approved = True
        course.is_rejected = False
        course.save()
        return Response(self.get_serializer(course).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def reject(self, request, pk=None):
        """Reject a course proposal (admin only). Marks as rejected."""
        course = self.get_object()
        course.is_rejected = True
        course.is_approved = False
        course.save()
        return Response(self.get_serializer(course).data)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def pending(self, request):
        """Return all pending course proposals (admin only)."""
        qs = Course.objects.filter(is_approved=False, is_rejected=False)
        data = self.get_serializer(qs, many=True).data
        return Response(data)


class StudentProfileViewSet(viewsets.ModelViewSet):
    queryset = StudentProfile.objects.select_related('user', 'department').all()
    serializer_class = StudentProfileSerializer


class StaffProfileViewSet(viewsets.ModelViewSet):
    queryset = StaffProfile.objects.select_related('user', 'department').all()
    # import serializer lazily to avoid circular import issues
    serializer_class = StaffProfileSerializer


class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer


class StudentCreateView(generics.CreateAPIView):
    queryset = StudentProfile.objects.all()
    serializer_class = StudentCreateSerializer


class StaffCreateView(generics.CreateAPIView):
    queryset = StaffProfile.objects.all()
    serializer_class = StaffCreateSerializer
    
    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            # If it's a DRF ValidationError, return 400 with details
            try:
                from rest_framework.exceptions import ValidationError as DRFValidationError
                if isinstance(e, DRFValidationError):
                    return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                pass

            import traceback
            tb = traceback.format_exc()
            # Print to server log for debugging
            print('StaffCreateView error:', str(e))
            print(tb)
            return Response({'error': str(e), 'traceback': tb}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CourseAllocationViewSet(viewsets.ModelViewSet):
    """Manage CourseAllocation objects.

    - Custom action `active_courses` returns courses for given department_id, batch_year, semester.
    - create/update override allow bulk assigning courses to allocation.
    """
    queryset = CourseAllocation.objects.all().select_related('department')
    serializer_class = CourseAllocationSerializer

    @action(detail=False, methods=['get'], url_path='active-courses')
    def active_courses(self, request):
        dept = request.query_params.get('department_id') or request.query_params.get('department')
        batch = request.query_params.get('batch_year') or request.query_params.get('batch')
        semester = request.query_params.get('semester')

        if not (dept and batch and semester):
            # return empty list when required params missing
            return Response([], status=status.HTTP_200_OK)

        try:
                # try exact department first
                allocation = CourseAllocation.objects.filter(
                    department_id=dept,
                    batch_year=int(batch),
                    semester=int(semester),
                ).prefetch_related('courses').first()
                # fallback: if not found, try the parent department (some site setups store
                # allocations at a parent umbrella department while classes belong to a sub-dept)
                if not allocation:
                    try:
                        from .models import Department
                        dep = Department.objects.filter(id=dept).first()
                        if dep and dep.parent_id:
                            allocation = CourseAllocation.objects.filter(
                                department_id=dep.parent_id,
                                batch_year=int(batch),
                                semester=int(semester),
                            ).prefetch_related('courses').first()
                    except Exception:
                        allocation = None
        except Exception:
            allocation = None

        if allocation:
            courses = allocation.courses.all()
            data = CourseSerializer(courses, many=True).data
            return Response(data, status=status.HTTP_200_OK)

        # Not found -> return empty list (safer fallback)
        return Response([], status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        """Create or update allocation and bulk-assign courses.

        Expected payload: { department: <id>, batch_year: 2023, semester: 3, courses: [1,2,3] }
        If an allocation for department/batch/semester exists, replace its `courses` set.
        """
        data = request.data
        dept = data.get('department')
        batch = data.get('batch_year')
        semester = data.get('semester')
        courses = data.get('courses', [])

        if not (dept and batch and semester):
            return Response({'detail': 'department, batch_year and semester are required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            # Use update_or_create to obtain the allocation object atomically
            allocation, created = CourseAllocation.objects.update_or_create(
                department_id=dept,
                batch_year=int(batch),
                semester=int(semester),
                defaults={}
            )

            # Replace the courses relation so unchecked courses are removed
            allocation.courses.set(courses)
            allocation.save()

            serializer = CourseAllocationSerializer(allocation)
            # Always return 200 OK for upserts from the HOD UI
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        # reuse partial update behavior but ensure bulk course assignment is handled
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = request.data
        courses = data.get('courses', None)

        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if courses is not None:
            try:
                instance.courses.set(courses)
            except Exception as e:
                return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(self.get_serializer(instance).data)


class CurriculumBatchViewSet(viewsets.ModelViewSet):
    """Manage curriculum batches.

    - Admins (IsAdminUser) may list, create, and update batches (toggle is_active).
    - Unauthenticated/regular users may only read the currently active batch.
    """
    queryset = CurriculumBatch.objects.all()
    serializer_class = None  # set in __init__ to avoid circular imports

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from .serializers import CurriculumBatchSerializer
        self.serializer_class = CurriculumBatchSerializer

    def get_permissions(self):
        # Mutating actions require admin privileges
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        # Read actions allowed for anyone
        return [AllowAny()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, 'user', None)
        # If user is not authenticated or not admin, only expose the active batch
        if not (user and user.is_authenticated and (user.is_staff or user.is_superuser)):
            return qs.filter(is_active=True)
        return qs.order_by('-year')


class BulkImportStudentsView(APIView):
    """
    API endpoint to bulk import students from an Excel file.
    Expected columns: name, email, reg_no, department_code, year, section
    """

    def post(self, request, *args, **kwargs):
        # Check if file is provided
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        file = request.FILES['file']
        
        # Validate file extension
        if not (file.name.endswith('.xlsx') or file.name.endswith('.xls')):
            return Response(
                {'error': 'Invalid file format. Please upload an Excel file (.xlsx or .xls)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Read the Excel file using pandas
            df = pd.read_excel(file)
            
            # Validate required columns. Accept either 'department_code' or 'department' (name).
            # For students, only `reg_no` is strictly required; other fields are optional.
            required_columns = ['name', 'reg_no', 'year', 'section']
            missing_columns = [col for col in required_columns if col not in df.columns]

            # department can be provided as 'department_code' or 'department' (name)
            has_dept_code = 'department_code' in df.columns
            has_dept_name = 'department' in df.columns

            # If department column missing, attempt to infer from filename (e.g., 'CSE_2024_students.xlsx')
            default_department = None
            if not (has_dept_code or has_dept_name):
                try:
                    lower_name = file.name.lower() if file and hasattr(file, 'name') else ''
                    # look for department code or name appearing in filename
                    deps = Department.objects.all()
                    matches = []
                    for d in deps:
                        if d.code and d.code.lower() in lower_name:
                            matches.append(d)
                        elif d.name and d.name.lower().replace(' ', '_') in lower_name:
                            matches.append(d)
                    if len(matches) == 1:
                        default_department = matches[0]
                        # treat as if department column present with this code
                        has_dept_code = True
                    else:
                        missing_columns.append('department_code or department')
                except Exception:
                    missing_columns.append('department_code or department')

            if missing_columns:
                return Response(
                    {'error': f'Missing required columns: {", ".join(missing_columns)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            created_count = 0
            updated_count = 0
            errors = []

            # Normalize header keys for flexible DOB handling
            def find_column_by_names(cols, candidates):
                for c in cols:
                    if str(c).strip().lower() in [x.lower() for x in candidates]:
                        return c
                return None

            dob_col = find_column_by_names(df.columns, ['dob', 'date_of_birth', 'date of birth', 'date'])

            # Iterate through rows
            # If department not provided per-row, attempt to infer from filename
            default_department = None
            try:
                lower_name = file.name.lower() if file and hasattr(file, 'name') else ''
                deps = Department.objects.all()
                matches = []
                for d in deps:
                    if d.code and d.code.lower() in lower_name:
                        matches.append(d)
                    elif d.name and d.name.lower().replace(' ', '_') in lower_name:
                        matches.append(d)
                if len(matches) == 1:
                    default_department = matches[0]
            except Exception:
                default_department = None

            for index, row in df.iterrows():
                try:
                    # Skip rows with missing critical data (reg_no required)
                    if pd.isna(row['reg_no']):
                        errors.append(f"Row {index + 2}: Missing reg_no")
                        continue

                    # normalize reg_no to string (handle floats read by pandas)
                    raw_reg = row['reg_no']
                    if pd.isna(raw_reg):
                        reg_no = ''
                    else:
                        try:
                            if isinstance(raw_reg, float) and raw_reg.is_integer():
                                reg_no = str(int(raw_reg))
                            else:
                                reg_no = str(raw_reg).strip()
                        except Exception:
                            reg_no = str(raw_reg).strip()

                    # email is optional; generate placeholder if missing
                    if not pd.isna(row.get('email')):
                        email = str(row['email']).strip()
                    else:
                        email = f"{reg_no}@noemail.local"
                    name = str(row['name']).strip() if not pd.isna(row['name']) else ''
                    # support either department_code or department (name)
                    if has_dept_code and 'department_code' in df.columns and not pd.isna(row['department_code']):
                        department_code = str(row['department_code']).strip()
                        department_name = ''
                    elif has_dept_name and 'department' in df.columns and not pd.isna(row['department']):
                        department_name = str(row['department']).strip()
                        department_code = ''
                    else:
                        # fallback to default inferred department from filename if available
                        if default_department:
                            department = default_department
                            department_code = department.code if department and getattr(department, 'code', None) else ''
                            department_name = department.name if department and getattr(department, 'name', None) else ''
                        else:
                            department_code = ''
                            department_name = ''
                    year = int(row['year']) if not pd.isna(row['year']) else 1
                    section = str(row['section']).strip() if not pd.isna(row['section']) else ''
                    # parse DOB if provided
                    parsed_dob = None
                    if dob_col and not pd.isna(row.get(dob_col)):
                        try:
                            ts = pd.to_datetime(row.get(dob_col), errors='coerce')
                            if not pd.isna(ts):
                                try:
                                    parsed_dob = ts.date()
                                except Exception:
                                    parsed_dob = ts.to_pydatetime().date()
                        except Exception:
                            parsed_dob = None
                    # optional roll_no column
                    roll_no = None
                    if 'roll_no' in df.columns and not pd.isna(row.get('roll_no')):
                        try:
                            roll_no = str(row.get('roll_no')).strip()
                        except Exception:
                            roll_no = str(row.get('roll_no'))

                    # Try to find existing student by reg_no first; if found, update that record
                    student_profile = None
                    try:
                        student_profile = StudentProfile.objects.select_related('user', 'department').filter(reg_no=reg_no).first()
                    except Exception:
                        student_profile = None

                    # Get Department instance (by code or by name)
                    department = None
                    if department_code:
                        try:
                            department = Department.objects.get(code=department_code)
                        except Department.DoesNotExist:
                            errors.append(f"Row {index + 2}: Department with code '{department_code}' not found")
                            continue
                    elif department_name:
                        try:
                            department = Department.objects.get(name=department_name)
                        except Department.DoesNotExist:
                            errors.append(f"Row {index + 2}: Department with name '{department_name}' not found")
                            continue

                    if student_profile:
                        # Update existing student's profile and user
                        user = student_profile.user
                        # Update email if provided and different
                        if email and email != getattr(user, 'email', None):
                            try:
                                user.email = email
                                if hasattr(user, 'USERNAME_FIELD') and user.USERNAME_FIELD != 'email':
                                    # ensure username remains set if needed
                                    setattr(user, user.USERNAME_FIELD, email)
                                user.save()
                            except Exception:
                                pass

                        # Update password if provided
                        if 'password' in df.columns and not pd.isna(row.get('password')):
                            try:
                                pw = str(row['password']).strip()
                                if pw:
                                    user.set_password(pw)
                                    user.save()
                            except Exception:
                                pass

                        # Update profile fields
                        student_profile.name = name or student_profile.name
                        student_profile.department = department or student_profile.department
                        student_profile.year = year
                        student_profile.section = section or student_profile.section
                        if parsed_dob:
                            student_profile.dob = parsed_dob
                        student_profile.reg_no = reg_no
                        if roll_no:
                            student_profile.roll_no = roll_no
                        try:
                            student_profile.save()
                            updated_count += 1
                        except Exception as e:
                            errors.append(f"Row {index + 2}: Failed to update student: {str(e)}")
                        continue

                    # No existing student by reg_no: create or get user by email (or placeholder)
                    user, user_created = User.objects.get_or_create(
                        email=email,
                        defaults={
                            'username': email,
                            'is_student': True
                        }
                    )

                    # Ensure user has a password
                    if user_created:
                        try:
                            user.set_password(reg_no)
                            if hasattr(user, 'is_student'):
                                user.is_student = True
                            user.save()
                        except Exception:
                            pass

                    # If password column provided, set password when creating/updating user
                    if 'password' in df.columns and not pd.isna(row.get('password')):
                        try:
                            pw = str(row['password']).strip()
                            if pw:
                                user.set_password(pw)
                                user.save()
                        except Exception:
                            pass

                    # Create StudentProfile
                    try:
                        student_profile = StudentProfile.objects.create(
                            user=user,
                            reg_no=reg_no,
                            roll_no=roll_no if roll_no else None,
                            name=name,
                            department=department,
                            year=year,
                            section=section,
                            dob=parsed_dob
                        )
                        created_count += 1
                    except Exception as e:
                        # If creation fails, attempt an update fallback
                        try:
                            student_profile, profile_created = StudentProfile.objects.update_or_create(
                                user=user,
                                defaults={
                                    'reg_no': reg_no,
                                    'name': name,
                                    'department': department,
                                    'year': year,
                                    'section': section
                                }
                            )
                            if profile_created:
                                created_count += 1
                            else:
                                updated_count += 1
                        except Exception as e2:
                            errors.append(f"Row {index + 2}: Failed to create/update student: {str(e2)}")
                            continue

                except Exception as e:
                    errors.append(f"Row {index + 2}: {str(e)}")
                    continue

            return Response({
                'success': True,
                'message': f'Bulk import completed',
                'created': created_count,
                'updated': updated_count,
                'errors': errors if errors else None
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            # Return the traceback in response to help debugging during development
            return Response(
                {'error': f'Failed to process file: {str(e)}', 'traceback': tb},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BulkImportStaffView(APIView):
    """
    API endpoint to bulk import staff from an Excel file.
    Expected columns (flexible): id|faculty_id, name, dept|department|department_code, role|designation, qualification, date of joining
    """

    def post(self, request, *args, **kwargs):
        # Check if file is provided
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        file = request.FILES['file']
        
        # Validate file extension
        if not (file.name.endswith('.xlsx') or file.name.endswith('.xls')):
            return Response(
                {'error': 'Invalid file format. Please upload an Excel file (.xlsx or .xls)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Read the Excel file using pandas
            df = pd.read_excel(file)
            
            # Normalize column names to simple keys (lowercase, spaces -> underscores)
            normalized_cols = {col: col for col in df.columns}
            key_map = {}
            for col in df.columns:
                key = str(col).strip().lower().replace(' ', '_')
                key_map[key] = col

            # Accept faculty id column named 'faculty_id' or 'id'
            faculty_col = None
            if 'faculty_id' in key_map:
                faculty_col = key_map['faculty_id']
            elif 'id' in key_map:
                faculty_col = key_map['id']

            if not faculty_col:
                return Response(
                    {'error': "Missing required column: 'faculty_id' or 'id'"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            created_count = 0
            updated_count = 0
            errors = []

            # Iterate through rows
            for index, row in df.iterrows():
                try:
                    # Read faculty id (required)
                    raw_faculty = row.get(faculty_col)
                    if pd.isna(raw_faculty):
                        errors.append(f"Row {index + 2}: Missing faculty id")
                        continue
                    faculty_id = str(raw_faculty).strip()

                    # Helper to fetch optional fields if present
                    def get_field(possible_keys):
                        for k in possible_keys:
                            if k in key_map:
                                raw = row.get(key_map[k])
                                if pd.isna(raw):
                                    return None
                                return str(raw).strip()
                        return None

                    email = get_field(['email'])
                    name = get_field(['name']) or ''
                    # department may be provided as code or name under keys dept, department_code, department
                    dept_val = get_field(['department_code', 'dept', 'department'])
                    designation = get_field(['designation', 'role', 'position'])
                    qualification = get_field(['qualification'])
                    doj = get_field(['date_of_joining', 'date', 'date_of_joining', 'date_of_joining'])

                    # parse date_of_joining into a Python date if possible
                    parsed_doj = None
                    if doj:
                        try:
                            # sanitize common curly quotes and extra whitespace
                            if isinstance(doj, str):
                                clean = doj.replace('“', '"').replace('”', '"').strip().strip('"')
                            else:
                                clean = doj
                            # use pandas to_datetime for robust parsing
                            ts = pd.to_datetime(clean, errors='coerce')
                            if not pd.isna(ts):
                                # convert to date object (DateField expects date)
                                try:
                                    parsed_doj = ts.date()
                                except Exception:
                                    # fallback for numpy/pandas types
                                    parsed_doj = ts.to_pydatetime().date()
                        except Exception:
                            parsed_doj = None

                    # Find existing staff by faculty_id
                    staff_profile = StaffProfile.objects.filter(faculty_id=faculty_id).select_related('user', 'department').first()

                    user = None
                    user_created = False

                    # If email provided, try to get/create user by email, otherwise if staff_profile exists use its user
                    if email:
                        user, user_created = User.objects.get_or_create(
                            email=email,
                            defaults={
                                'username': email,
                                'is_faculty': True
                            }
                        )
                        if user_created:
                            try:
                                user.set_password(faculty_id)
                                user.is_faculty = True
                                user.save()
                            except Exception:
                                pass
                    elif staff_profile:
                        user = staff_profile.user
                    else:
                        # No email and no existing profile: create a placeholder user using faculty_id
                        placeholder_email = f"{faculty_id}@noemail.local"
                        user, user_created = User.objects.get_or_create(
                            email=placeholder_email,
                            defaults={
                                'username': placeholder_email,
                                'is_faculty': True
                            }
                        )
                        if user_created:
                            try:
                                user.set_password(faculty_id)
                                user.is_faculty = True
                                user.save()
                            except Exception:
                                pass

                    # Resolve department if provided; if missing, try default inferred department
                    department = None
                    if dept_val:
                        # try code first
                        try:
                            department = Department.objects.get(code=dept_val)
                        except Department.DoesNotExist:
                            try:
                                department = Department.objects.get(name=dept_val)
                            except Department.DoesNotExist:
                                errors.append(f"Row {index + 2}: Department '{dept_val}' not found")
                                continue
                    elif default_department:
                        department = default_department

                    # Create or update staff profile
                    if staff_profile:
                        # Update only non-empty fields
                        if name:
                            staff_profile.name = name
                        if department is not None:
                            staff_profile.department = department
                        if designation:
                            staff_profile.designation = designation
                        if qualification:
                            staff_profile.qualification = qualification
                        if parsed_doj:
                            try:
                                staff_profile.date_of_joining = parsed_doj
                            except Exception:
                                pass

                        # update faculty_id if different (unlikely)
                        staff_profile.faculty_id = faculty_id

                        # Update related user email if provided and different
                        if email and getattr(user, 'email', None) != email:
                            try:
                                user.email = email
                                if hasattr(user, 'USERNAME_FIELD') and user.USERNAME_FIELD != 'email':
                                    setattr(user, user.USERNAME_FIELD, email)
                                user.save()
                            except Exception:
                                pass

                        try:
                            staff_profile.save()
                            updated_count += 1
                        except Exception as e:
                            errors.append(f"Row {index + 2}: Failed to update staff: {str(e)}")
                        continue

                    # No existing staff profile: create one
                    try:
                        staff_profile = StaffProfile.objects.create(
                            user=user,
                            faculty_id=faculty_id,
                            name=name,
                            department=department,
                            designation=designation or '',
                            qualification=qualification or ''
                        )
                        # try to set date_of_joining if model supports it (use parsed date)
                        if parsed_doj:
                            try:
                                staff_profile.date_of_joining = parsed_doj
                                staff_profile.save()
                            except Exception:
                                pass
                        created_count += 1
                    except Exception as e:
                        # fallback to update_or_create
                        try:
                            staff_profile, profile_created = StaffProfile.objects.update_or_create(
                                faculty_id=faculty_id,
                                defaults={
                                    'user': user,
                                    'name': name,
                                    'department': department,
                                    'designation': designation or '',
                                    'qualification': qualification or ''
                                }
                            )
                            if profile_created:
                                created_count += 1
                            else:
                                updated_count += 1
                        except Exception as e2:
                            errors.append(f"Row {index + 2}: Failed to create/update staff: {str(e2)}")
                            continue

                except Exception as e:
                    errors.append(f"Row {index + 2}: {str(e)}")
                    continue

            return Response({
                'success': True,
                'message': f'Bulk import completed',
                'created': created_count,
                'updated': updated_count,
                'errors': errors if errors else None
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'error': f'Failed to process file: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ClassAdvisorViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing class advisors.
    Allows HODs/admins to assign staff as class advisors.
    Includes custom action for staff to find their assigned classes.
    """
    queryset = ClassAdvisor.objects.select_related('department', 'staff', 'staff__user').all()
    serializer_class = ClassAdvisorSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'], url_path='my-classes')
    def my_classes(self, request):
        """
        Returns all classes where the current user is the advisor.
        Used by staff to see which classes they are responsible for.
        """
        user = request.user
        if not user or not user.is_authenticated:
            return Response(
                {'detail': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Find classes where this user's staff profile is the advisor
        my_advisorships = ClassAdvisor.objects.filter(
            staff__user=user
        ).select_related('department', 'staff')
        
        serializer = self.get_serializer(my_advisorships, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except DRFValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

        try:
            self.perform_create(serializer)
        except IntegrityError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class TimetableViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing timetable entries.
    Supports bulk create/update and filtering by department, batch, section, semester.
    """
    queryset = Timetable.objects.select_related('department', 'subject').all()
    serializer_class = TimetableSerializer
    # permission_classes = [IsAuthenticated]  # Uncomment to require authentication
    
    def get_queryset(self):
        """
        Filter timetable entries based on query parameters.
        Supports: department, batch_year, section, semester
        """
        queryset = super().get_queryset()
        
        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(department_id=department)
        
        batch_year = self.request.query_params.get('batch_year')
        if batch_year:
            queryset = queryset.filter(batch_year=batch_year)
        
        section = self.request.query_params.get('section')
        if section:
            queryset = queryset.filter(section=section)
        
        semester = self.request.query_params.get('semester')
        if semester:
            queryset = queryset.filter(semester=semester)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """
        Support bulk create/update of timetable slots.
        
        Expected payload:
        {
            "slots": [
                {
                    "department": 1,
                    "batch_year": 2024,
                    "section": "A",
                    "semester": 1,
                    "day": "Monday",
                    "period": 1,
                    "subject": 5  // or null
                },
                ...
            ]
        }
        
        Or single object for single create.
        """
        data = request.data
        
        # Check if bulk operation (slots array)
        if 'slots' in data and isinstance(data['slots'], list):
            created_count = 0
            updated_count = 0
            errors = []
            
            for slot_data in data['slots']:
                try:
                    # Extract unique identifiers
                    lookup_fields = {
                        'department_id': slot_data.get('department'),
                        'batch_year': slot_data.get('batch_year'),
                        'section': slot_data.get('section'),
                        'semester': slot_data.get('semester'),
                        'day': slot_data.get('day'),
                        'period': slot_data.get('period'),
                    }
                    
                    # Update or create
                    obj, created = Timetable.objects.update_or_create(
                        **lookup_fields,
                        defaults={'subject_id': slot_data.get('subject')}
                    )
                    
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                        
                except Exception as e:
                    errors.append({
                        'slot': slot_data,
                        'error': str(e)
                    })
            
            return Response({
                'created': created_count,
                'updated': updated_count,
                'errors': errors if errors else None
            }, status=status.HTTP_201_CREATED)
        
        # Single create - use default behavior
        return super().create(request, *args, **kwargs)
