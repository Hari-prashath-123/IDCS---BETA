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
    Expected columns: name, email, faculty_id, department_code, designation
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
            
            # Validate required columns
            required_columns = ['name', 'email', 'faculty_id', 'department_code', 'designation']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
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
                    # Skip rows with missing critical data
                    if pd.isna(row['email']) or pd.isna(row['faculty_id']):
                        errors.append(f"Row {index + 2}: Missing email or faculty_id")
                        continue

                    email = str(row['email']).strip()
                    faculty_id = str(row['faculty_id']).strip()
                    name = str(row['name']).strip() if not pd.isna(row['name']) else ''
                    department_code = str(row['department_code']).strip() if not pd.isna(row['department_code']) else ''
                    designation = str(row['designation']).strip() if not pd.isna(row['designation']) else ''

                    # Get or create User
                    user, user_created = User.objects.get_or_create(
                        email=email,
                        defaults={
                            'username': email,
                            'is_faculty': True
                        }
                    )
                    
                    # Set password to faculty_id if user was just created
                    if user_created:
                        user.set_password(faculty_id)
                        user.is_faculty = True
                        user.save()

                    # Get Department instance
                    try:
                        department = Department.objects.get(code=department_code)
                    except Department.DoesNotExist:
                        errors.append(f"Row {index + 2}: Department with code '{department_code}' not found")
                        continue

                    # Create or Update StaffProfile
                    staff_profile, profile_created = StaffProfile.objects.update_or_create(
                        user=user,
                        defaults={
                            'faculty_id': faculty_id,
                            'name': name,
                            'department': department,
                            'designation': designation
                        }
                    )

                    if profile_created:
                        created_count += 1
                    else:
                        updated_count += 1

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
