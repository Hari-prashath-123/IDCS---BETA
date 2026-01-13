from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from core.models import StaffProfile


User = get_user_model()


class Command(BaseCommand):
    help = 'Set password for all staff users (those with a StaffProfile)'

    def add_arguments(self, parser):
        parser.add_argument('--password', type=str, default='Password123!', help='Password to set for staff users')
        parser.add_argument('--dry-run', action='store_true', help='Show which users would be updated without changing passwords')

    def handle(self, *args, **options):
        pwd = options.get('password')
        dry = options.get('dry_run', False)

        qs = StaffProfile.objects.select_related('user').all()
        total = qs.count()
        updated = 0

        self.stdout.write(f'Found {total} staff profiles')

        for sp in qs:
            user = getattr(sp, 'user', None)
            if not user:
                self.stdout.write(self.style.WARNING(f'StaffProfile id={sp.id} has no related user; skipping'))
                continue

            identifier = getattr(user, 'email', None) or getattr(user, 'username', None) or f'id={user.id}'
            if dry:
                self.stdout.write(f'[dry-run] Would set password for user {identifier} (user_id={user.id})')
                continue

            try:
                user.set_password(pwd)
                user.save()
                updated += 1
                self.stdout.write(self.style.SUCCESS(f'Updated password for user {identifier} (user_id={user.id})'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Failed to update user {identifier}: {e}'))

        self.stdout.write(self.style.SUCCESS(f'Done. Updated {updated}/{total} users.'))
