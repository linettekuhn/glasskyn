import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# get URL from environment 
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://cosmetics_user:password@db:5432/cosmetics")

# engine = connection to DB
engine = create_engine(DATABASE_URL)

# SessionLocal is a factory for 'database sessions'
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)