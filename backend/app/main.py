import logging
from contextlib import asynccontextmanager

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
from app.routers import chat as chat_router
from app.routers import notifications as notifications_router
from app.routers import preferences as preferences_router
from app.routers import water as water_router
from app.routers import version as version_router
from app.services.scheduler import scheduler
from app.core.config import CORS_ORIGINS
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not scheduler.running:
        scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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
app.include_router(chat_router.router)
app.include_router(notifications_router.router)
app.include_router(preferences_router.router)
app.include_router(water_router.router)
app.include_router(version_router.router)


@app.get("/items")
def read_items(db: Session = Depends(get_db)):
    return {"status": "connected"}
