from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# detect HoD by checking Department relations
from core.models import Department, StaffProfile


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    u = request.user
    # determine role: admin, hod, ahod, staff, student, unknown
    role = 'unknown'
    is_hod = False
    is_ahod = False
    
    # defensive: user object may not have all attributes depending on auth backend
    user_email = getattr(u, 'email', '')
    print(f"\n=== current_user for {user_email} ===")
    
    try:
        if u.is_superuser:
            role = 'admin'
            print(f"✓ Role: admin (is_superuser=True)")

        # detect HoD / AHoD using Department FK relations
        elif Department.objects.filter(head_of_department=u).exists():
            role = 'hod'
            is_hod = True
            depts = Department.objects.filter(head_of_department=u)
            print(f"✓ Role: HoD (assigned to {depts.count()} department(s): {[d.name for d in depts]})")
        elif Department.objects.filter(ahod=u).exists():
            role = 'ahod'
            is_ahod = True
            depts = Department.objects.filter(ahod=u)
            print(f"✓ Role: AHoD (assigned to {depts.count()} department(s): {[d.name for d in depts]})")
        else:
            # Fallback: some admin flows create staff entries with designation='hod' but
            # don't set Department.head_of_department. Check StaffProfile.designation.
            try:
                sp = StaffProfile.objects.filter(user=u).first()
                if sp:
                    des = (sp.designation or '').lower()
                    print(f"  StaffProfile found: designation='{sp.designation}', department={sp.department}")
                    if 'hod' in des or ('head' in des and 'department' in des):
                        role = 'hod'
                        is_hod = True
                        print(f"✓ Role: HoD (from designation '{sp.designation}')")
                    elif 'ahod' in des or ('assistant hod' in des) or ( 'assistant' in des and 'hod' in des ):
                        role = 'ahod'
                        is_ahod = True
                        print(f"✓ Role: AHoD (from designation '{sp.designation}')")
                    else:
                        if getattr(u, 'is_faculty', False):
                            role = 'staff'
                            print(f"✓ Role: staff (is_faculty=True)")
                        elif getattr(u, 'is_student', False):
                            role = 'student'
                            print(f"✓ Role: student (is_student=True)")
                else:
                    print(f"  No StaffProfile found")
                    if getattr(u, 'is_faculty', False):
                        role = 'staff'
                        print(f"✓ Role: staff (is_faculty=True)")
                    elif getattr(u, 'is_student', False):
                        role = 'student'
                        print(f"✓ Role: student (is_student=True)")
            except Exception as e:
                print(f"  Exception in StaffProfile check: {e}")
                # fallback to basic flags
                if getattr(u, 'is_faculty', False):
                    role = 'staff'
                elif getattr(u, 'is_student', False):
                    role = 'student'
    except Exception as e:
        print(f"  Exception in role detection: {e}")
        # defensive: keep role as unknown on any error
        role = 'unknown'

    print(f"Final role: {role}, is_hod: {is_hod}, is_ahod: {is_ahod}\n")
    
    data = {
        'id': getattr(u, 'id', None),
        'username': getattr(u, 'username', None),
        'email': getattr(u, 'email', None),
        'first_name': getattr(u, 'first_name', ''),
        'last_name': getattr(u, 'last_name', ''),
        'is_superuser': getattr(u, 'is_superuser', False),
        'is_staff': getattr(u, 'is_staff', False),
        'is_student': getattr(u, 'is_student', False),
        'is_faculty': getattr(u, 'is_faculty', False),
        'role': role,
        'is_hod': is_hod,
        'is_ahod': is_ahod,
    }
    return Response(data)
