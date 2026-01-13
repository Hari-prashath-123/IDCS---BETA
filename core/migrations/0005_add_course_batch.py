from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_remove_course_credits_remove_course_department_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="course",
            name="batch",
            field=models.PositiveSmallIntegerField(blank=True, null=True, help_text="Academic batch year (e.g., 2023)"),
        ),
    ]
