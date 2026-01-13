import pandas as pd
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.core.files.storage import default_storage
from django.contrib.auth import get_user_model

from .models import Course, StudentProfile, StaffProfile, Department
from .serializers import CourseSerializer, StudentProfileSerializer
from .serializers import StaffProfileSerializer, DepartmentSerializer
from .serializers import StudentCreateSerializer, StaffCreateSerializer

from rest_framework import generics

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
