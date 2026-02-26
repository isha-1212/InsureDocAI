# Add missing columns to policy_documents table
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0001_initial'),
        ('api', '0002_policy_documents_and_family_members'),
    ]

    operations = [
        # Add missing columns to policy_documents table
        migrations.AddField(
            model_name='policydocument',
            name='user',
            field=models.ForeignKey(
                db_column='user_id',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='policy_documents',
                to='users.user',
                null=True  # Allow null temporarily for existing records
            ),
        ),
        migrations.AddField(
            model_name='policydocument',
            name='family_member',
            field=models.ForeignKey(
                blank=True,
                db_column='family_member_id',
                help_text='The family member this document belongs to (if applicable)',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='documents',
                to='api.familymember'
            ),
        ),
        migrations.AddField(
            model_name='policydocument',
            name='belongs_to_relation',
            field=models.CharField(
                choices=[('self', 'Self'), ('father', 'Father'), ('mother', 'Mother')],
                default='self',
                help_text='Whose document this is - self, father, or mother',
                max_length=10
            ),
        ),
        migrations.AddField(
            model_name='policydocument',
            name='bucket_name',
            field=models.CharField(
                default='policies',
                help_text='Supabase Storage bucket name',
                max_length=100
            ),
        ),
        migrations.AddField(
            model_name='policydocument',
            name='file_size',
            field=models.IntegerField(
                help_text='Size in bytes',
                default=0
            ),
        ),
        migrations.AddField(
            model_name='policydocument',
            name='content_type',
            field=models.CharField(
                help_text='MIME type',
                max_length=100,
                default='application/pdf'
            ),
        ),
    ]