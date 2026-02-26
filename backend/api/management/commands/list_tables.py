from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'List all tables'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name;
            """)
            
            rows = cursor.fetchall()
            self.stdout.write("All tables in database:")
            for row in rows:
                self.stdout.write(f"  {row[0]}")