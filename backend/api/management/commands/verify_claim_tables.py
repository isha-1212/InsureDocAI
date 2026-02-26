from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Check all claim-related table structures'

    def handle(self, *args, **options):
        tables_to_check = ['claims', 'claim_documents', 'claim_extracted_fields']
        
        with connection.cursor() as cursor:
            for table in tables_to_check:
                cursor.execute("""
                    SELECT column_name, data_type, is_nullable 
                    FROM information_schema.columns 
                    WHERE table_name = %s
                    ORDER BY ordinal_position;
                """, [table])
                
                rows = cursor.fetchall()
                if rows:
                    self.stdout.write(f"\n{table.upper()} table structure:")
                    for row in rows:
                        self.stdout.write(f"  {row[0]:<20} | {row[1]:<25} | nullable: {row[2]}")
                else:
                    self.stdout.write(f"{table.upper()} table not found")
            
            # Check constraints
            cursor.execute("""
                SELECT 
                    tc.table_name,
                    tc.constraint_name, 
                    tc.constraint_type,
                    kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                WHERE tc.table_name IN ('claims', 'claim_documents', 'claim_extracted_fields')
                ORDER BY tc.table_name, tc.constraint_type, kcu.column_name;
            """)
            
            rows = cursor.fetchall()
            self.stdout.write(f"\n\nCONSTRAINTS:")
            current_table = None
            for row in rows:
                if current_table != row[0]:
                    current_table = row[0]
                    self.stdout.write(f"\n{current_table.upper()}:")
                self.stdout.write(f"  {row[1]} | {row[2]} | {row[3]}")