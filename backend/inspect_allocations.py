import os
import sys

# Ensure project root is on sys.path similar to manage.py
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()

from core.models import CourseAllocation
from core.models import ClassAdvisor, StaffProfile

print('CourseAllocations:')
for a in CourseAllocation.objects.all():
    courses = list(a.courses.values_list('id', 'code'))
    print(f'ID={a.id} dept_id={a.department_id} dept={a.department} batch={a.batch_year} sem={a.semester} courses={courses}')

# Also filter for batch 2023 sem 5
print('\nFiltered: batch=2023 sem=5')
for a in CourseAllocation.objects.filter(batch_year=2023, semester=5):
    courses = list(a.courses.values_list('id', 'code'))
    print(f'ID={a.id} dept_id={a.department_id} dept={a.department} batch={a.batch_year} sem={a.semester} courses={courses}')

print('\nClassAdvisors:')
for ca in ClassAdvisor.objects.all():
    print(f'ID={ca.id} dept_id={ca.department_id} dept={ca.department} batch={ca.batch_year} section={ca.section} staff_id={ca.staff_id} staff={ca.staff}')

print('\nStaffProfiles for staff IDs referenced in ClassAdvisor:')
staff_ids = set(ClassAdvisor.objects.values_list('staff_id', flat=True))
for sid in staff_ids:
    sp = StaffProfile.objects.filter(id=sid).first()
    print(f'id={sid} -> {sp}')
