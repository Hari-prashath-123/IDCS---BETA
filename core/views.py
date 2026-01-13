import pandas as pd
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.core.files.storage import default_storage
from django.contrib.auth import get_user_model

from .models import Course, StudentProfile, StaffProfile, Department, CourseAllocation, ClassAdvisor, Timetable
from .serializers import CourseSerializer, StudentProfileSerializer
from .serializers import StaffProfileSerializer, DepartmentSerializer
from .serializers import StudentCreateSerializer, StaffCreateSerializer
from .serializers import CourseAllocationSerializer, ClassAdvisorSerializer, TimetableSerializer

from rest_framework import generics
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from django.db import IntegrityError

User = get_user_model()


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

    def get_queryset(self):
        """
        Optionally filter courses by semester or department.
        Examples:
            ?semester=3
            ?department=5 (filters by target_departments)
        """
        queryset = Course.objects.all().prefetch_related('target_departments')
        
        # Filter by semester
        semester = self.request.query_params.get('semester', None)
        if semester is not None:
            queryset = queryset.filter(semester=semester)
        
        # Filter by target department
        department = self.request.query_params.get('department', None)
        if department is not None:
            queryset = queryset.filter(target_departments__id=department).distinct()
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """
        Override create to ensure proper handling of target_departments.
        The serializer should handle the ManyToMany relationship correctly,
        but we ensure proper response format here.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


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
            allocation = CourseAllocation.objects.filter(
                department_id=dept,
                batch_year=int(batch),
                semester=int(semester),
            ).prefetch_related('courses').first()
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

        allocation, created = CourseAllocation.objects.get_or_create(
            department_id=dept,
            batch_year=int(batch),
            semester=int(semester),
        )

        try:
            # set courses (allow empty list)
            allocation.courses.set(courses)
            allocation.save()
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CourseAllocationSerializer(allocation)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=status_code)

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
            if not (has_dept_code or has_dept_name):
                missing_columns.append('department_code or department')

            if missing_columns:
                return Response(
                    {'error': f'Missing required columns: {", ".join(missing_columns)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            created_count = 0
            updated_count = 0
            errors = []

            # Iterate through rows
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
                    if has_dept_code and not pd.isna(row['department_code']):
                        department_code = str(row['department_code']).strip()
                        department_name = ''
                    elif has_dept_name and not pd.isna(row['department']):
                        department_name = str(row['department']).strip()
                        department_code = ''
                    else:
                        department_code = ''
                        department_name = ''
                    year = int(row['year']) if not pd.isna(row['year']) else 1
                    section = str(row['section']).strip() if not pd.isna(row['section']) else ''
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
                            section=section
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

                    # Resolve department if provided; if missing, leave unchanged for updates
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
