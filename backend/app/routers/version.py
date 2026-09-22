import os
from fastapi import APIRouter, Request

router = APIRouter()

APP_VERSION: str = os.environ.get("APP_VERSION", "1.0.0")
APP_MIN_VERSION: str = os.environ.get("APP_MIN_VERSION", "1.0.0")
APP_STORE_URL: str = os.environ.get(
    "APP_STORE_URL",
    "https://apps.apple.com/app/glasskyn/id6752230698",
)
PLAY_STORE_URL: str = os.environ.get(
    "PLAY_STORE_URL",
    "https://play.google.com/store/apps/details?id=com.linettekuhn.glasskyn",
)


@router.get("/version-check")
def version_check(request: Request):
    user_agent = request.headers.get("user-agent", "")
    is_ios = "iOS" in user_agent or "iPhone" in user_agent
    store_url = APP_STORE_URL if is_ios else PLAY_STORE_URL

    return {
        "current_version": APP_VERSION,
        "minimum_version": APP_MIN_VERSION,
        "store_url": store_url,
    }
