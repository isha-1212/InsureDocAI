from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Check users table constraints'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Check constraints on users table
            cursor.execute("""
                SELECT 
                    tc.constraint_name, 
                    tc.constraint_type,
                    kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                WHERE tc.table_name = 'users'
                ORDER BY tc.constraint_type, kcu.column_name;
            """)
            
            rows = cursor.fetchall()
            self.stdout.write("Users table constraints:")
            for row in rows:
                self.stdout.write(f"  {row[0]} | {row[1]} | {row[2]}")
            
            # Check if supabase_user_id has unique values
            cursor.execute("""
                SELECT supabase_user_id, COUNT(*) 
                FROM users 
                GROUP BY supabase_user_id 
                HAVING COUNT(*) > 1;
            """)
            
            duplicates = cursor.fetchall()
            if duplicates:
                self.stdout.write("\nDuplicate supabase_user_id values found:")
                for row in duplicates:
                    self.stdout.write(f"  {row[0]} appears {row[1]} times")
            else:
                self.stdout.write("\nNo duplicate supabase_user_id values found")
            
            # Check for null values
            cursor.execute("""
                SELECT COUNT(*) FROM users WHERE supabase_user_id IS NULL;
            """)
            
            null_count = cursor.fetchone()[0]
            self.stdout.write(f"NULL supabase_user_id values: {null_count}")