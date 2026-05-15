from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0009_update_claim_status_check"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClaimEvent",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("event_type", models.CharField(choices=[
                    ("submitted", "Submitted"),
                    ("pending", "Pending"),
                    ("rejected", "Rejected"),
                    ("edited", "Edited"),
                    ("reapplied", "Reapplied"),
                    ("approved", "Approved"),
                ], db_index=True, max_length=20)),
                ("event_label", models.CharField(max_length=100)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("claim", models.ForeignKey(db_column="claim_id", on_delete=django.db.models.deletion.CASCADE, related_name="timeline_events", to="api.claim")),
            ],
            options={
                "db_table": "claim_events",
                "ordering": ["created_at", "id"],
            },
        ),
    ]
