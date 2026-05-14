import uuid
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from app.core.config import (
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    S3_BUCKET_NAME,
)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

DEFAULT_UPLOAD_EXPIRATION = 900
DEFAULT_DOWNLOAD_EXPIRATION = 3600

s3_client = None


def _get_s3_client():
    global s3_client
    if s3_client is None:
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION,
            config=Config(signature_version="s3v4"),
        )
    return s3_client


def validate_content_type(content_type: str) -> bool:
    return content_type.lower() in ALLOWED_CONTENT_TYPES


def generate_presigned_upload_url(
    file_name: str,
    content_type: str,
    expiration: int = DEFAULT_UPLOAD_EXPIRATION,
) -> dict:
    if not validate_content_type(content_type):
        raise ValueError(
            f"Invalid content type: {content_type}. Allowed: {ALLOWED_CONTENT_TYPES}"
        )

    ext = file_name.split(".")[-1] if "." in file_name else "jpg"
    file_key = f"products/{uuid.uuid4()}.{ext}"

    client = _get_s3_client()
    upload_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": S3_BUCKET_NAME,
            "Key": file_key,
            "ContentType": content_type,
        },
        ExpiresIn=expiration,
    )

    public_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{file_key}"

    return {
        "upload_url": upload_url,
        "file_key": file_key,
        "public_url": public_url,
    }


def generate_presigned_download_url(
    file_key: str,
    expiration: int = DEFAULT_DOWNLOAD_EXPIRATION,
) -> dict:
    client = _get_s3_client()
    download_url = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": S3_BUCKET_NAME,
            "Key": file_key,
        },
        ExpiresIn=expiration,
    )

    return {"download_url": download_url}


def delete_file(file_key: str) -> bool:
    client = _get_s3_client()
    try:
        client.delete_object(Bucket=S3_BUCKET_NAME, Key=file_key)
        return True
    except ClientError:
        return False