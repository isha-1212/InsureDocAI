from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0006_add_member_and_total_amount_to_claims"),
    ]

    operations = [
        migrations.AddField(
            model_name="claimdocument",
            name="review_status",
            field=models.CharField(
                choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")],
                db_index=True,
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="claimdocument",
            name="review_remarks",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="claimdocument",
            name="reviewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="claimdocument",
            name="reviewed_by",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
