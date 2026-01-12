from rest_framework.routers import DefaultRouter
from django.urls import path, include

from .views import CourseViewSet, StudentProfileViewSet

router = DefaultRouter()
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'students', StudentProfileViewSet, basename='studentprofile')

urlpatterns = [
    path('', include(router.urls)),
]
