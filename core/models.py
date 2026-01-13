from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import transaction


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
    # Basic Info
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    semester = models.PositiveSmallIntegerField(help_text="Semester (1-8)")
    admin_department_name = models.CharField(max_length=255, help_text="Manually entered department name")
    
    # Target Departments - which departments study this course
    target_departments = models.ManyToManyField(
        Department, 
        related_name='curriculum_courses',
        blank=True,
        help_text="Departments that study this course"
    )
    
    # Class Types (e.g., Theory, Practical)
    class_types = models.JSONField(
        default=list,
        help_text="List of class types: ['Theory', 'Practical']"
    )
    
    # Category (e.g., PC, ES, PE, HS, etc.)
    category = models.CharField(
        max_length=10,
        help_text="Course category (e.g., PC, ES, PE, HS)"
    )
    
    # Credits Structure: L-T-P-S-C
    L = models.FloatField(default=0, help_text="Lecture credits")
    T = models.FloatField(default=0, help_text="Tutorial credits")
    P = models.FloatField(default=0, help_text="Practical credits")
    S = models.FloatField(default=0, help_text="Self-study credits")
    C = models.FloatField(default=0, help_text="Total credits")
    # Batch year for which this course entry applies
    batch = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Academic batch year (e.g., 2023)")
    # Approval workflow fields
    # Default to False so proposals are pending approval unless explicitly approved
    is_approved = models.BooleanField(default=False, help_text="Whether the course proposal is approved")
    is_rejected = models.BooleanField(default=False, help_text="Whether the course proposal was rejected")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_courses',
        help_text='User who proposed or created this course'
    )
    
    # Marks
    internal_marks = models.IntegerField(default=0)
    external_marks = models.IntegerField(default=0)
    
    @property
    def total_marks(self):
        """Calculate total marks as sum of internal and external marks"""
        return self.internal_marks + self.external_marks

    def __str__(self):
        return f"{self.code} - {self.name}"


class CourseAllocation(TimeStampedModel):
    """Which courses are active for a given department, batch and semester.

    - `department`: department owning the allocation
    - `batch_year`: joining/entry year (e.g. 2023)
    - `semester`: semester number (1-8)
    - `courses`: many-to-many to `Course` (courses taught this semester)
    """

    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='course_allocations',
    )
    batch_year = models.PositiveIntegerField(help_text='Joining year, e.g. 2023')
    semester = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(8)],
        help_text='Semester (1-8)'
    )
    courses = models.ManyToManyField(
        Course,
        related_name='allocations',
        blank=True,
        help_text='Courses allocated for this department/batch/semester'
    )

    class Meta:
        unique_together = ['department', 'batch_year', 'semester']
        verbose_name = 'Course Allocation'
        verbose_name_plural = 'Course Allocations'

    def __str__(self):
        return f"{self.department} — Batch {self.batch_year} — Sem {self.semester}"


class StudentProfile(TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_profile'
    )
    reg_no = models.CharField(max_length=50, unique=True)
    roll_no = models.CharField(max_length=50, null=True, blank=True)
    # Year the student joined (used for curriculum mapping)
    batch_year = models.IntegerField(null=True, blank=True, help_text="Year the student joined, used for curriculum mapping")
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


class ClassAdvisor(TimeStampedModel):
    """Maps a staff member as advisor for a specific class (department + batch + section)"""
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='class_advisors',
        help_text='Department for the class'
    )
    batch_year = models.PositiveIntegerField(
        help_text='Joining year, e.g., 2024'
    )
    section = models.CharField(
        max_length=10,
        help_text='Section code, e.g., A, B, C'
    )
    staff = models.ForeignKey(
        'StaffProfile',
        on_delete=models.CASCADE,
        related_name='advised_classes',
        help_text='Staff member acting as class advisor'
    )

    class Meta:
        unique_together = ['department', 'batch_year', 'section']
        verbose_name = 'Class Advisor'
        verbose_name_plural = 'Class Advisors'

    def __str__(self):
        return f"{self.department.code} - Batch {self.batch_year} - Sec {self.section} - Advisor: {self.staff.name}"


class Timetable(TimeStampedModel):
    """Stores timetable entries for a class (department + batch + section + semester)"""
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='timetable_entries',
        help_text='Department for the class'
    )
    batch_year = models.PositiveIntegerField(
        help_text='Joining year, e.g., 2024'
    )
    section = models.CharField(
        max_length=10,
        help_text='Section code, e.g., A, B, C'
    )
    semester = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(8)],
        help_text='Semester (1-8)'
    )
    
    DAY_CHOICES = [
        ('Monday', 'Monday'),
        ('Tuesday', 'Tuesday'),
        ('Wednesday', 'Wednesday'),
        ('Thursday', 'Thursday'),
        ('Friday', 'Friday'),
    ]
    day = models.CharField(
        max_length=10,
        choices=DAY_CHOICES,
        help_text='Day of the week'
    )
    period = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(7)],
        help_text='Period number (1-7)'
    )
    subject = models.ForeignKey(
        Course,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='timetable_slots',
        help_text='Course/subject for this slot'
    )

    class Meta:
        unique_together = ['department', 'batch_year', 'section', 'semester', 'day', 'period']
        verbose_name = 'Timetable Entry'
        verbose_name_plural = 'Timetable Entries'

    def __str__(self):
        subject_name = self.subject.code if self.subject else 'Free'
        return f"{self.department.code} - Batch {self.batch_year} - Sec {self.section} - Sem {self.semester} - {self.day} P{self.period}: {subject_name}"


class CurriculumBatch(models.Model):
    """Represents a curriculum batch year and which one is active globally."""
    year = models.PositiveIntegerField(unique=True)
    is_active = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Curriculum Batch'
        verbose_name_plural = 'Curriculum Batches'

    def save(self, *args, **kwargs):
        # If setting this batch active, deactivate all others atomically
        with transaction.atomic():
            if self.is_active:
                # set others to False
                CurriculumBatch.objects.filter(is_active=True).exclude(pk=self.pk).update(is_active=False)
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.year}{' (active)' if self.is_active else ''}"
