from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import StudentProfile


@receiver(post_save, sender=StudentProfile)
def set_default_student_password(sender, instance, created, **kwargs):
    """When a StudentProfile is created, set the user's password to reg_no
    if they don't already have a usable password."""
    if not created:
        return

    user = getattr(instance, 'user', None)
    if user is None:
        return

    try:
        if not user.has_usable_password():
            user.set_password(instance.reg_no)
            user.save()
    except Exception:
        # avoid breaking the transaction if something unexpected occurs
        pass
