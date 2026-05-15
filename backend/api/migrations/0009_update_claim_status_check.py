from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0008_claim_workflow_fields"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_status_check;
                ALTER TABLE claims
                ADD CONSTRAINT claims_status_check
                CHECK (status IN ('pending', 'approved', 'rejected', 'reapplied'));
            """,
            reverse_sql="""
                ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_status_check;
                ALTER TABLE claims
                ADD CONSTRAINT claims_status_check
                CHECK (status IN ('pending', 'approved', 'rejected'));
            """,
        ),
    ]
