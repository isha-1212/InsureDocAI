from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0007_add_review_fields_to_claim_documents"),
    ]

    operations = [
        migrations.AddField(
            model_name="claim",
            name="is_reapplied",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="claim",
            name="rejection_reason",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="claim",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("reapplied", "Reapplied"),
                ],
                db_index=True,
                default="pending",
                max_length=20,
            ),
        ),
    ]
