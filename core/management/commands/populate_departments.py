from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Department


class Command(BaseCommand):
    help = 'Populate departments with parents, standalone, sub-departments and non-academic departments.'

    def create_dept(self, name, code, dept_type='ACADEMIC', parent=None):
        # Use get_or_create to avoid duplicates
        defaults = {'name': name, 'type': dept_type, 'parent': parent}
        dept, created = Department.objects.get_or_create(code=code, defaults=defaults)
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created department: {code} - {name} (type={dept_type})'))
        else:
            # Ensure fields are up-to-date if existing
            updated = False
            if dept.name != name:
                dept.name = name
                updated = True
            if dept.type != dept_type:
                dept.type = dept_type
                updated = True
            # parent may be None; update only if differs
            if (dept.parent_id or None) != (parent.id if parent else None):
                dept.parent = parent
                updated = True
            if updated:
                dept.save()
                self.stdout.write(self.style.SUCCESS(f'Updated department: {code}'))
            else:
                self.stdout.write(self.style.WARNING(f'Already exists: {code}'))
        return dept

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write('Starting department population...')

        # Step 1: Parent Departments (HoD level)
        ai = self.create_dept('AI', 'AI', dept_type='ACADEMIC')
        sh = self.create_dept('S&H', 'S&H', dept_type='FIRST_YEAR')

        # Step 2: Standalone Academic Departments
        standalone = ['CSE', 'EEE', 'ECE', 'IT', 'CIVIL', 'MECH']
        for code in standalone:
            self.create_dept(code, code, dept_type='ACADEMIC')

        # Step 3: Sub-Departments (AHoD level)
        # Under AI
        self.create_dept('AI&DS', 'AI&DS', dept_type='ACADEMIC', parent=ai)
        self.create_dept('AI&ML', 'AI&ML', dept_type='ACADEMIC', parent=ai)

        # Under S&H
        sh_subs = ['Maths', 'Physics', 'Chemistry', 'English', 'Tamil']
        for name in sh_subs:
            code = name.upper()
            self.create_dept(name, code, dept_type='FIRST_YEAR', parent=sh)

        # Step 4: Non-Academic Departments
        non_academic = ['PE', 'T&P', 'R&D', 'EDC', 'COE', 'CFSW', 'IQAC']
        for code in non_academic:
            # use code as name where no explicit full name given
            self.create_dept(code, code, dept_type='NON_ACADEMIC')

        self.stdout.write(self.style.SUCCESS('Department population completed.'))
        self.stdout.write('Run `python manage.py makemigrations` and `python manage.py migrate` if models changed.')
