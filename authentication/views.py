from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    u = request.user
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
    }
    return Response(data)
