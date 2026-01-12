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
            
            # Validate required columns
            required_columns = ['name', 'email', 'reg_no', 'department_code', 'year', 'section']
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
                    if pd.isna(row['email']) or pd.isna(row['reg_no']):
                        errors.append(f"Row {index + 2}: Missing email or reg_no")
                        continue

                    email = str(row['email']).strip()
                    reg_no = str(row['reg_no']).strip()
                    name = str(row['name']).strip() if not pd.isna(row['name']) else ''
                    department_code = str(row['department_code']).strip() if not pd.isna(row['department_code']) else ''
                    year = int(row['year']) if not pd.isna(row['year']) else 1
                    section = str(row['section']).strip() if not pd.isna(row['section']) else ''

                    # Get or create User
                    user, user_created = User.objects.get_or_create(
                        email=email,
                        defaults={
                            'username': email,
                            'is_student': True
                        }
                    )
                    
                    # Set password to reg_no if user was just created
                    if user_created:
                        user.set_password(reg_no)
                        user.is_student = True
                        user.save()

                    # Get Department instance
                    try:
                        department = Department.objects.get(code=department_code)
                    except Department.DoesNotExist:
                        errors.append(f"Row {index + 2}: Department with code '{department_code}' not found")
                        continue

                    # Create or Update StudentProfile
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
