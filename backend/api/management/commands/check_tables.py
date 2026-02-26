from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Check table structure'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Check if claims table exists and its structure
            cursor.execute("""
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'claims'
                ORDER BY ordinal_position;
            """)
            
            rows = cursor.fetchall()
            if rows:
                self.stdout.write("Claims table structure:")
                for row in rows:
                    self.stdout.write(f"  {row[0]} | {row[1]} | nullable: {row[2]}")
            else:
                self.stdout.write("Claims table not found")
            
            # Check users table for reference
            cursor.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'users'
                ORDER BY ordinal_position;
            """)
            
            rows = cursor.fetchall()
            if rows:
                self.stdout.write("\nUsers table structure:")
                for row in rows:
                    self.stdout.write(f"  {row[0]} | {row[1]}")
            else:
                self.stdout.write("Users table not found")
            
            # Check policies table for reference
            cursor.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'policies' OR table_name = 'api_policy'
                ORDER BY table_name, ordinal_position;
            """)
            
            rows = cursor.fetchall()
            if rows:
                self.stdout.write("\nPolicies table structure:")
                for row in rows:
                    self.stdout.write(f"  {row[0]} | {row[1]}")
            else:
                self.stdout.write("Policies table not found")