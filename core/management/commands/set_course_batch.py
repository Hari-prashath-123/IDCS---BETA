from django.core.management.base import BaseCommand
from core.models import Course


class Command(BaseCommand):
    help = 'Set batch to 2023 for courses that have no batch set'

    def add_arguments(self, parser):
        parser.add_argument('--year', type=int, default=2023, help='Batch year to set for existing courses')

    def handle(self, *args, **options):
        year = options['year']
        qs = Course.objects.filter(batch__isnull=True)
        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS('No courses without batch found.'))
            return
        updated = qs.update(batch=year)
        self.stdout.write(self.style.SUCCESS(f'Updated {updated} course(s) to batch {year}'))
