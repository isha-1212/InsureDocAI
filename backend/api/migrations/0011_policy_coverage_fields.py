from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_claim_timeline_events'),
    ]

    operations = [
        migrations.AddField(
            model_name='policy',
            name='total_coverage_amount',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Total coverage shared across the policy', max_digits=12, validators=[django.core.validators.MinValueValidator(0)]),
        ),
        migrations.AddField(
            model_name='policy',
            name='used_coverage_amount',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Coverage already consumed by approved claims', max_digits=12, validators=[django.core.validators.MinValueValidator(0)]),
        ),
    ]
