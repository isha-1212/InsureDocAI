from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Reset migrations and recreate all tables'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Clear django_migrations table to reset migration state
            self.stdout.write("Clearing migration history...")
            cursor.execute("DELETE FROM django_migrations;")
            
            # Create all the core Django tables that are missing
            django_tables = [
                # Auth tables
                """
                CREATE TABLE IF NOT EXISTS auth_permission (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    content_type_id INTEGER,
                    codename VARCHAR(100) NOT NULL,
                    UNIQUE (content_type_id, codename)
                );
                """,
                
                """
                CREATE TABLE IF NOT EXISTS auth_group (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(150) UNIQUE NOT NULL
                );
                """,
                
                """
                CREATE TABLE IF NOT EXISTS auth_group_permissions (
                    id SERIAL PRIMARY KEY,
                    group_id INTEGER,
                    permission_id INTEGER,
                    UNIQUE (group_id, permission_id)
                );
                """,
                
                """
                CREATE TABLE IF NOT EXISTS auth_user (
                    id SERIAL PRIMARY KEY,
                    password VARCHAR(128) NOT NULL,
                    last_login TIMESTAMP,
                    is_superuser BOOLEAN NOT NULL,
                    username VARCHAR(150) UNIQUE NOT NULL,
                    first_name VARCHAR(150) NOT NULL,
                    last_name VARCHAR(150) NOT NULL,
                    email VARCHAR(254) NOT NULL,
                    is_staff BOOLEAN NOT NULL,
                    is_active BOOLEAN NOT NULL,
                    date_joined TIMESTAMP NOT NULL
                );
                """,
                
                """
                CREATE TABLE IF NOT EXISTS auth_user_groups (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    group_id INTEGER,
                    UNIQUE (user_id, group_id)
                );
                """,
                
                """
                CREATE TABLE IF NOT EXISTS auth_user_user_permissions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    permission_id INTEGER,
                    UNIQUE (user_id, permission_id)
                );
                """,
                
                """
                CREATE TABLE IF NOT EXISTS django_admin_log (
                    id SERIAL PRIMARY KEY,
                    action_time TIMESTAMP NOT NULL,
                    object_id TEXT,
                    object_repr VARCHAR(200) NOT NULL,
                    action_flag SMALLINT NOT NULL,
                    change_message TEXT NOT NULL,
                    content_type_id INTEGER,
                    user_id INTEGER NOT NULL
                );
                """,
                
                # API tables that might have been deleted
                """
                CREATE TABLE IF NOT EXISTS family_members (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    name VARCHAR(100) NOT NULL,
                    relationship VARCHAR(50) NOT NULL,
                    age INTEGER,
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE (user_id, name)
                );
                """,
                
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    document_type VARCHAR(50) NOT NULL,
                    file_path VARCHAR(255) NOT NULL,
                    uploaded_at TIMESTAMP DEFAULT NOW()
                );
                """,
                
                """
                CREATE TABLE IF NOT EXISTS policy_documents (
                    id SERIAL PRIMARY KEY,
                    policy_id INTEGER,
                    document_type VARCHAR(50) NOT NULL,
                    file_path VARCHAR(255) NOT NULL,
                    uploaded_at TIMESTAMP DEFAULT NOW()
                );
                """,
                
                """
                CREATE TABLE IF NOT EXISTS user_profiles (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER UNIQUE,
                    profile_data JSONB,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                """
            ]
            
            # Execute all table creation commands
            for sql in django_tables:
                try:
                    cursor.execute(sql)
                    table_name = sql.split('CREATE TABLE IF NOT EXISTS')[1].split()[0].strip()
                    self.stdout.write(f"✓ Created/verified table: {table_name}")
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error creating table: {e}"))
            
            # Add foreign key constraints
            constraints = [
                "ALTER TABLE auth_group_permissions ADD CONSTRAINT fk_group FOREIGN KEY (group_id) REFERENCES auth_group(id);",
                "ALTER TABLE auth_group_permissions ADD CONSTRAINT fk_permission FOREIGN KEY (permission_id) REFERENCES auth_permission(id);",
                "ALTER TABLE auth_user_groups ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth_user(id);",
                "ALTER TABLE auth_user_groups ADD CONSTRAINT fk_group_user FOREIGN KEY (group_id) REFERENCES auth_group(id);",
                "ALTER TABLE auth_user_user_permissions ADD CONSTRAINT fk_user_perm FOREIGN KEY (user_id) REFERENCES auth_user(id);",
                "ALTER TABLE auth_user_user_permissions ADD CONSTRAINT fk_permission_user FOREIGN KEY (permission_id) REFERENCES auth_permission(id);",
                "ALTER TABLE django_admin_log ADD CONSTRAINT fk_admin_user FOREIGN KEY (user_id) REFERENCES auth_user(id);",
                "ALTER TABLE auth_permission ADD CONSTRAINT fk_content_type FOREIGN KEY (content_type_id) REFERENCES django_content_type(id);",
                "ALTER TABLE django_admin_log ADD CONSTRAINT fk_admin_content_type FOREIGN KEY (content_type_id) REFERENCES django_content_type(id);"
            ]
            
            for constraint in constraints:
                try:
                    cursor.execute(constraint)
                except Exception as e:
                    # Ignore if constraint already exists
                    if "already exists" not in str(e):
                        self.stdout.write(self.style.WARNING(f"Warning adding constraint: {e}"))
            
            self.stdout.write(self.style.SUCCESS("\n🎉 All tables have been restored!"))