from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0012_claim_reopen_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="policy",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("under_review", "Under Review"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                ],
                db_index=True,
                default="pending",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="PolicyEvent",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("event_type", models.CharField(
                    choices=[
                        ("submitted", "Submitted"),
                        ("updated", "Updated"),
                        ("approved", "Approved"),
                        ("reopened", "Reopened"),
                        ("rejected", "Rejected"),
                    ],
                    db_index=True,
                    max_length=20,
                )),
                ("event_label", models.CharField(max_length=100)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("policy", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="timeline_events", to="api.policy")),
            ],
            options={
                "db_table": "policy_events",
                "ordering": ["created_at", "id"],
            },
        ),
    ]
