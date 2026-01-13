#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
django.setup()

from core.models import Department, StaffProfile
from django.contrib.auth import get_user_model

User = get_user_model()

# Check HoD user
email = 'hodai@krct.ac.in'
u = User.objects.filter(email=email).first()

if not u:
    print(f"❌ User with email {email} not found")
else:
    print(f"✓ User found: {u.email} (ID: {u.id})")
    print(f"  - is_superuser: {u.is_superuser}")
    print(f"  - is_staff: {u.is_staff}")
    print(f"  - is_faculty: {getattr(u, 'is_faculty', False)}")
    
    # Check staff profile
    sp = StaffProfile.objects.filter(user=u).first()
    if sp:
        print(f"\n✓ Staff Profile found:")
        print(f"  - Name: {sp.name}")
        print(f"  - Faculty ID: {sp.faculty_id}")
        print(f"  - Designation: {sp.designation}")
        print(f"  - Department: {sp.department}")
    else:
        print(f"\n❌ No StaffProfile found for user {email}")
    
    # Check if assigned as HoD
    depts_as_hod = Department.objects.filter(head_of_department=u)
    if depts_as_hod.exists():
        print(f"\n✓ Assigned as HoD of {depts_as_hod.count()} department(s):")
        for dept in depts_as_hod:
            print(f"  - {dept.name} ({dept.code})")
    else:
        print(f"\n❌ NOT assigned as HoD of any department")
    
    # Check if assigned as AHoD
    depts_as_ahod = Department.objects.filter(ahod=u)
    if depts_as_ahod.exists():
        print(f"\n✓ Assigned as AHoD of {depts_as_ahod.count()} department(s):")
        for dept in depts_as_ahod:
            print(f"  - {dept.name} ({dept.code})")
