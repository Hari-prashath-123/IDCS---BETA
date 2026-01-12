from rest_framework import viewsets

from .models import Course, StudentProfile
from .serializers import CourseSerializer, StudentProfileSerializer


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer


class StudentProfileViewSet(viewsets.ModelViewSet):
    queryset = StudentProfile.objects.select_related('user', 'department').all()
    serializer_class = StudentProfileSerializer
