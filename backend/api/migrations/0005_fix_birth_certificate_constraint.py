# Manual migration to fix birth_certificate constraint
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_rename_api_familyme_policy__idx_family_memb_policy__4a97a8_idx_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE claim_documents
                DROP CONSTRAINT IF EXISTS claim_documents_document_type_check;
                
                ALTER TABLE claim_documents
                ADD CONSTRAINT claim_documents_document_type_check
                CHECK (document_type IN ('hospital_bill', 'pharmacy_bill', 'aadhaar', 'pan', 'birth_certificate'));
            """,
            reverse_sql="""
                ALTER TABLE claim_documents
                DROP CONSTRAINT IF EXISTS claim_documents_document_type_check;
                
                ALTER TABLE claim_documents
                ADD CONSTRAINT claim_documents_document_type_check
                CHECK (document_type IN ('hospital_bill', 'pharmacy_bill', 'aadhaar', 'pan'));
            """
        ),
        migrations.RunSQL(
            sql="""
                ALTER TABLE claim_extracted_fields
                DROP CONSTRAINT IF EXISTS claim_extracted_fields_document_type_check;
                
                ALTER TABLE claim_extracted_fields
                ADD CONSTRAINT claim_extracted_fields_document_type_check
                CHECK (document_type IN ('hospital_bill', 'pharmacy_bill', 'aadhaar', 'pan', 'birth_certificate'));
            """,
            reverse_sql="""
                ALTER TABLE claim_extracted_fields
                DROP CONSTRAINT IF EXISTS claim_extracted_fields_document_type_check;
                
                ALTER TABLE claim_extracted_fields
                ADD CONSTRAINT claim_extracted_fields_document_type_check
                CHECK (document_type IN ('hospital_bill', 'pharmacy_bill', 'aadhaar', 'pan'));
            """
        ),
    ]
