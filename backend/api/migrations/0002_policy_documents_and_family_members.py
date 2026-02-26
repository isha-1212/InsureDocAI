# Generated manually to sync with existing database tables
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0001_initial'),
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='FamilyMember',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('dob', models.DateField(blank=True, help_text='Date of birth', null=True)),
                ('relation', models.CharField(choices=[('self', 'Self'), ('spouse', 'Spouse'), ('child', 'Child'), ('parent', 'Parent'), ('father', 'Father'), ('mother', 'Mother'), ('son', 'Son'), ('daughter', 'Daughter')], help_text='Relation to policy holder', max_length=20)),
                ('is_minor', models.BooleanField(default=False, help_text='Automatically set based on age')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('policy', models.ForeignKey(help_text='All family members belong to one policy', on_delete=django.db.models.deletion.CASCADE, related_name='family_members', to='api.policy')),
            ],
            options={
                'db_table': 'family_members',
                'ordering': ['created_at'],
                'indexes': [
                    models.Index(fields=['policy'], name='api_familyme_policy__idx'),
                    models.Index(fields=['relation'], name='api_familyme_relatio_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='PolicyDocument',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('document_type', models.CharField(choices=[('PAN', 'PAN Card'), ('AADHAAR', 'Aadhaar Card'), ('HOSPITAL_BILL', 'Hospital Bill'), ('PHARMACY_BILL', 'Pharmacy Bill'), ('POLICY', 'Policy Document')], default='POLICY', help_text='Type of document uploaded', max_length=20)),
                ('belongs_to_relation', models.CharField(choices=[('self', 'Self'), ('father', 'Father'), ('mother', 'Mother')], default='self', help_text='Whose document this is - self, father, or mother', max_length=10)),
                ('bucket_name', models.CharField(default='policies', help_text='Supabase Storage bucket name', max_length=100)),
                ('file_path', models.CharField(help_text='Path in Supabase Storage', max_length=500)),
                ('file_size', models.IntegerField(help_text='Size in bytes')),
                ('content_type', models.CharField(help_text='MIME type', max_length=100)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('family_member', models.ForeignKey(blank=True, db_column='family_member_id', help_text='The family member this document belongs to (if applicable)', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='api.familymember')),
                ('policy', models.ForeignKey(db_column='policy_id', on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='api.policy')),
                ('user', models.ForeignKey(db_column='user_id', on_delete=django.db.models.deletion.CASCADE, related_name='policy_documents', to='users.user')),
            ],
            options={
                'db_table': 'policy_documents',
                'ordering': ['-uploaded_at'],
                'indexes': [
                    models.Index(fields=['user', 'document_type'], name='api_policydo_user_id_doc_idx'),
                    models.Index(fields=['policy', 'family_member'], name='api_policydo_policy__fam_idx'),
                    models.Index(fields=['document_type', 'belongs_to_relation'], name='api_policydo_documen_bel_idx'),
                ],
            },
        ),
        migrations.AlterUniqueTogether(
            name='familymember',
            unique_together={('policy', 'name', 'dob', 'relation')},
        ),
    ]