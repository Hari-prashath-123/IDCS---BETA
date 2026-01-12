from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q


class EmailOrIDBackend(ModelBackend):
    """Authenticate using email OR student reg_no OR staff faculty_id.

    Usage: call with username=<email|reg_no|faculty_id>, password=<password>
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        if username is None:
            username = kwargs.get(UserModel.USERNAME_FIELD)

        user = None

        # Try matching by email first (case-insensitive)
        try:
            user = UserModel.objects.get(Q(email__iexact=username))
        except UserModel.DoesNotExist:
            # Import profile models lazily to avoid import-time app registry issues
            try:
                from core.models import StudentProfile, StaffProfile
            except Exception:
                StudentProfile = StaffProfile = None

            if StudentProfile:
                try:
                    sp = StudentProfile.objects.select_related('user').get(reg_no=username)
                    user = sp.user
                except StudentProfile.DoesNotExist:
                    user = None

            if not user and StaffProfile:
                try:
                    sf = StaffProfile.objects.select_related('user').get(faculty_id=username)
                    user = sf.user
                except StaffProfile.DoesNotExist:
                    user = None

        if user is None:
            return None

        # Check password and active status using ModelBackend helper
        if user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None
