import logging

logging.basicConfig(level=logging.INFO)

from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.middleware.auth import get_db
from app.routers import auth as auth_router
from app.routers import products as products_router
from app.routers import uploads as uploads_router
from app.routers import classify as classify_router
from app.routers import routines as routines_router
from app.routers import ingredients as ingredients_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# TODO: change cors rules in prod
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(products_router.router)
app.include_router(uploads_router.router)
app.include_router(classify_router.router)
app.include_router(routines_router.router)
app.include_router(ingredients_router.router)


@app.get("/items")
def read_items(db: Session = Depends(get_db)):
    return {"status": "connected"}
