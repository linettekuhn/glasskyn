from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.middleware.auth import get_db
from app.routers import auth as auth_router
from app.routers import products as products_router

app = FastAPI()

app.include_router(auth_router.router)
app.include_router(products_router.router)


@app.get("/items")
def read_items(db: Session = Depends(get_db)):
    return {"status": "connected"}
