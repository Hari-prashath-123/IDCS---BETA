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
    try:
        if u.is_superuser:
            role = 'admin'

        # detect HoD / AHoD using Department FK relations
        elif Department.objects.filter(head_of_department=u).exists():
            role = 'hod'
            is_hod = True
        elif Department.objects.filter(ahod=u).exists():
            role = 'ahod'
            is_ahod = True
        else:
            # Fallback: some admin flows create staff entries with designation='hod' but
            # don't set Department.head_of_department. Check StaffProfile.designation.
            try:
                sp = StaffProfile.objects.filter(user=u).first()
                if sp:
                    des = (sp.designation or '').lower()
                    if 'hod' in des or ('head' in des and 'department' in des):
                        role = 'hod'
                        is_hod = True
                    elif 'ahod' in des or des.includes('assistant hod') or ( 'assistant' in des and 'hod' in des ):
                        role = 'ahod'
                        is_ahod = True
                    else:
                        if getattr(u, 'is_faculty', False):
                            role = 'staff'
                        elif getattr(u, 'is_student', False):
                            role = 'student'
                else:
                    if getattr(u, 'is_faculty', False):
                        role = 'staff'
                    elif getattr(u, 'is_student', False):
                        role = 'student'
            except Exception:
                # fallback to basic flags
                if getattr(u, 'is_faculty', False):
                    role = 'staff'
                elif getattr(u, 'is_student', False):
                    role = 'student'
    except Exception:
        # defensive: keep role as unknown on any error
        role = 'unknown'

    data = {
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'first_name': u.first_name,
        'last_name': u.last_name,
        'is_superuser': u.is_superuser,
        'is_staff': u.is_staff,
        'is_student': getattr(u, 'is_student', False),
        'is_faculty': getattr(u, 'is_faculty', False),
        'role': role,
        'is_hod': is_hod,
        'is_ahod': is_ahod,
    }
    return Response(data)
