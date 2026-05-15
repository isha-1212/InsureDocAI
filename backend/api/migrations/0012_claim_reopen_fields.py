from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_policy_coverage_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='claim',
            name='is_reopened',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='claim',
            name='reopen_reason',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='claim',
            name='reopened_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
