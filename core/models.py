from django.db import models
from django.conf import settings


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Department(TimeStampedModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    head_of_department = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='headed_departments',
    )

    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='sub_departments',
    )

    DEPT_TYPE_CHOICES = [
        ('ACADEMIC', 'Academic'),
        ('NON_ACADEMIC', 'Non Academic'),
        ('FIRST_YEAR', 'First Year'),
    ]
    type = models.CharField(max_length=20, choices=DEPT_TYPE_CHOICES, default='ACADEMIC')

    ahod = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='ahod_department',
    )

    def __str__(self):
        if self.parent:
            # show parent.code - name for sub-departments
            return f"{self.parent.code} - {self.name}"
        return f"{self.name} ({self.code})"


class Course(TimeStampedModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name='courses'
    )
    credits = models.PositiveSmallIntegerField()

    def __str__(self):
        return f"{self.code} - {self.name}"


class StudentProfile(TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_profile'
    )
    reg_no = models.CharField(max_length=50, unique=True)
    roll_no = models.CharField(max_length=50, null=True, blank=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL, related_name='students'
    )
    year = models.PositiveSmallIntegerField(null=True, blank=True)
    section = models.CharField(max_length=20, null=True, blank=True)
    dob = models.DateField(null=True, blank=True)

    # Additional fields migrated from legacy project
    phone_number = models.CharField(max_length=15, null=True, blank=True)
    father_name = models.CharField(max_length=255, null=True, blank=True)
    mother_name = models.CharField(max_length=255, null=True, blank=True)
    parent_phone = models.CharField(max_length=15, null=True, blank=True)
    address = models.TextField(null=True, blank=True)

    COMMUNITY_CHOICES = [
        ("BC", "BC"),
        ("MBC", "MBC"),
        ("SC", "SC"),
        ("ST", "ST"),
        ("OC", "OC"),
        ("OBC", "OBC"),
    ]
    community = models.CharField(max_length=10, choices=COMMUNITY_CHOICES, null=True, blank=True)

    RESIDENCE_CHOICES = [
        ("Day Scholar", "Day Scholar"),
        ("Hosteller", "Hosteller"),
    ]
    residence = models.CharField(max_length=20, choices=RESIDENCE_CHOICES, null=True, blank=True)

    is_first_graduate = models.BooleanField(default=False)

    mentor = models.ForeignKey('StaffProfile', null=True, blank=True, on_delete=models.SET_NULL, related_name='mentees')

    def get_year_department(self):
        """
        Return the appropriate department for the student's year.
        - If the student is in year 1, return the 'S&H' department (First Year department) if it exists.
        - Otherwise, return the student's assigned `department` (their main branch).
        """
        try:
            if self.year == 1:
                # prefer department with code 'S&H' as the first-year umbrella
                first_year = Department.objects.filter(code='S&H').first()
                if first_year:
                    return first_year
        except Exception:
            # defensive: any error -> fall back to assigned department
            pass
        return self.department

    def __str__(self):
        return f"{self.name} ({self.reg_no})"


class StaffProfile(TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='staff_profile'
    )
    faculty_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL, related_name='faculty'
    )
    designation = models.CharField(max_length=255, null=True, blank=True)
    qualification = models.CharField(max_length=255, null=True, blank=True)
    date_of_joining = models.DateField(null=True, blank=True)

    # Additional contact/profile fields
    phone_number = models.CharField(max_length=15, null=True, blank=True)
    address = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.faculty_id})"
