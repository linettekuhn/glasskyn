import os
import sys
from logging.config import fileConfig
from app.db.base_class import Base
from app.models import User, Product, ScanResult, Alert, DeviceToken, RefreshToken, PasswordResetToken, SkinProfile, Routine, RoutineStep, RoutineTemplate, RoutineTemplateStep, ChatMessage, ChatSession, RoutineStepCompletion, UserPreference, WaterIntake, SkinSession, SkinConcern
from sqlalchemy import engine_from_config, pool
from alembic import context

# --- 1: Add the project root to sys.path ---
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# --- 2: Import your Base metadata ---
try:
    from app.db.base import Base
except ImportError as e:
    print(f"\n[ERROR] Could not import Base from app.db.base. {e}")
    print("Ensure you have created app/__init__.py and app/db/__init__.py\n")
    sys.exit(1)

# --- 3: Alembic Config object ---
config = context.config

# --- 4: Dynamic Database URL ---
db_url = os.environ.get("DATABASE_URL")
if db_url:
    config.set_main_option("sqlalchemy.url", db_url)

# --- 5: Set up logging ---
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- 6: Set metadata for autogenerate ---
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
