from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0005_fix_birth_certificate_constraint"),
    ]

    operations = [
        migrations.AddField(
            model_name="claim",
            name="member",
            field=models.ForeignKey(
                blank=True,
                db_column="member_id",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="claims",
                to="api.familymember",
            ),
        ),
        migrations.AddField(
            model_name="claim",
            name="total_amount",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=12, null=True
            ),
        ),
    ]
