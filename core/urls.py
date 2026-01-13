from rest_framework.routers import DefaultRouter
from django.urls import path, include

from .views import CourseViewSet, StudentProfileViewSet, StaffProfileViewSet, DepartmentViewSet, BulkImportStudentsView, BulkImportStaffView
from .views import StudentCreateView, StaffCreateView, CourseAllocationViewSet, ClassAdvisorViewSet, TimetableViewSet
from .views import CurriculumBatchViewSet

router = DefaultRouter()
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'students', StudentProfileViewSet, basename='studentprofile')
router.register(r'staff', StaffProfileViewSet, basename='staff')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'course-allocations', CourseAllocationViewSet, basename='course-allocation')
router.register(r'class-advisors', ClassAdvisorViewSet, basename='class-advisor')
router.register(r'timetables', TimetableViewSet, basename='timetable')
router.register(r'curriculum-batches', CurriculumBatchViewSet, basename='curriculumbatch')

# Important: register explicit import/create endpoints BEFORE the router include
# so that paths like /students/create/ are not swallowed by the router's detail
# routes (which would treat 'create' as a lookup value and reject POST).
urlpatterns = [
    path('students/bulk-import/', BulkImportStudentsView.as_view(), name='bulk-import-students'),
    path('staff/bulk-import/', BulkImportStaffView.as_view(), name='bulk-import-staff'),
    path('import/students/', BulkImportStudentsView.as_view(), name='import-students'),
    path('import/staff/', BulkImportStaffView.as_view(), name='import-staff'),
    path('students/create/', StudentCreateView.as_view(), name='create-student'),
    path('staff/create/', StaffCreateView.as_view(), name='create-staff'),
    path('', include(router.urls)),
]
