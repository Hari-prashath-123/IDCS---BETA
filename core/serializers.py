from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import StudentProfile, Course


User = get_user_model()


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['id', 'name', 'code', 'department', 'credits', 'created_at', 'updated_at']


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
