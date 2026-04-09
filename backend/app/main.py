from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.middleware.auth import get_db

app = FastAPI()


@app.get("/items")
def read_items(db: Session = Depends(get_db)):
    return {"status": "connected"}
