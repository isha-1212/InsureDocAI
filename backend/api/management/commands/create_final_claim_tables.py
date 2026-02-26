from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Create claim tables with proper UUID schema and constraints'

    def handle(self, *args, **options):
        sql_commands = [
            # Add unique constraint to users.supabase_user_id if it doesn't exist
            """
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name = 'users_supabase_user_id_unique' 
                    AND table_name = 'users'
                ) THEN
                    ALTER TABLE users ADD CONSTRAINT users_supabase_user_id_unique UNIQUE (supabase_user_id);
                END IF;
            END $$;
            """,
            
            # Drop existing claims table if it exists
            "DROP TABLE IF EXISTS claims CASCADE;",
            
            # Drop any remaining related tables
            "DROP TABLE IF EXISTS claim_documents CASCADE;",
            "DROP TABLE IF EXISTS claim_extracted_fields CASCADE;",
            
            # Create the correct claims table with UUID primary key
            """
            CREATE TABLE claims (
                claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(supabase_user_id) ON DELETE CASCADE,
                policy_id INTEGER REFERENCES policies(id) ON DELETE CASCADE,
                status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            """,
            
            # Create indexes for claims
            "CREATE INDEX idx_claims_user_id ON claims(user_id);",
            "CREATE INDEX idx_claims_status ON claims(status);",
            "CREATE INDEX idx_claims_created_at ON claims(created_at);",
            
            # Create claim_documents table
            """
            CREATE TABLE claim_documents (
                document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                claim_id UUID REFERENCES claims(claim_id) ON DELETE CASCADE,
                document_type TEXT NOT NULL CHECK (document_type IN ('hospital_bill', 'pharmacy_bill', 'aadhaar', 'pan', 'birth_certificate')),
                file_path TEXT NOT NULL,
                file_url TEXT NOT NULL,
                uploaded_at TIMESTAMP DEFAULT NOW(),
                
                UNIQUE (claim_id, document_type)
            );
            """,
            
            # Create indexes for claim_documents
            "CREATE INDEX idx_claim_documents_claim_id ON claim_documents(claim_id);",
            "CREATE INDEX idx_claim_documents_type ON claim_documents(document_type);",
            
            # Create claim_extracted_fields table
            """
            CREATE TABLE claim_extracted_fields (
                id SERIAL PRIMARY KEY,
                claim_id UUID REFERENCES claims(claim_id) ON DELETE CASCADE,
                document_type TEXT NOT NULL CHECK (document_type IN ('hospital_bill', 'pharmacy_bill', 'aadhaar', 'pan', 'birth_certificate')),
                field_name TEXT NOT NULL,
                field_value TEXT NOT NULL,
                confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
                created_at TIMESTAMP DEFAULT NOW(),
                
                UNIQUE (claim_id, document_type, field_name)
            );
            """,
            
            # Create indexes for claim_extracted_fields
            "CREATE INDEX idx_claim_extracted_fields_claim_id ON claim_extracted_fields(claim_id);",
            "CREATE INDEX idx_claim_extracted_fields_document_type ON claim_extracted_fields(document_type);",
            "CREATE INDEX idx_claim_extracted_fields_field_name ON claim_extracted_fields(field_name);"
        ]

        with connection.cursor() as cursor:
            for i, sql in enumerate(sql_commands):
                if sql.strip():
                    try:
                        cursor.execute(sql)
                        # Get a clean description
                        if "ADD CONSTRAINT" in sql:
                            desc = "Added unique constraint to users.supabase_user_id"
                        elif sql.startswith("DROP"):
                            desc = f"Dropped table: {sql.split()[4] if len(sql.split()) > 4 else 'unknown'}"
                        elif sql.startswith("CREATE TABLE"):
                            table_name = sql.split()[2].split()[0] if len(sql.split()) > 2 else 'unknown'
                            desc = f"Created table: {table_name}"
                        elif sql.startswith("CREATE INDEX"):
                            index_name = sql.split()[2] if len(sql.split()) > 2 else 'unknown'
                            desc = f"Created index: {index_name}"
                        else:
                            desc = f"Executed SQL command {i+1}"
                        
                        self.stdout.write(f"✓ {desc}")
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f"✗ Error: {e}"))
                        # Only show first 100 chars of SQL for errors
                        sql_preview = sql.replace('\n', ' ').strip()[:100] + "..." if len(sql) > 100 else sql
                        self.stdout.write(self.style.ERROR(f"   SQL: {sql_preview}"))

        self.stdout.write(self.style.SUCCESS('\n🎉 Successfully created claim tables with UUID schema and proper constraints!'))
