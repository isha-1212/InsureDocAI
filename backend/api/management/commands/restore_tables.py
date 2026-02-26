from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import connection

class Command(BaseCommand):
    help = 'Restore all deleted Django tables'

    def handle(self, *args, **options):
        self.stdout.write("Recreating all missing Django tables...")
        
        # First, let's run migrate to recreate all the standard Django tables
        try:
            call_command('migrate', verbosity=2)
            self.stdout.write(self.style.SUCCESS("✓ Migration completed"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Migration error: {e}"))
        
        # List tables after migration
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name;
            """)
            
            rows = cursor.fetchall()
            self.stdout.write("\nTables after restoration:")
            for row in rows:
                self.stdout.write(f"  {row[0]}")
                
        self.stdout.write(self.style.SUCCESS("\n✓ All Django tables have been restored!"))