"""
Image processing service — EXIF stripping, S3 presign, scheduled deletion.
Privacy-critical: no image persists beyond 60 seconds.
"""

import uuid
from datetime import timedelta

import boto3
from botocore.config import Config

from app.core.config import settings


class ImageProcessorService:
    def __init__(self):
        self._s3 = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            config=Config(signature_version="s3v4"),
        )

    def generate_presigned_put(self, user_id: str) -> dict:
        """
        Generates a presigned S3 PUT URL.
        Key format: temp/{user_id}/{uuid}.jpg
        URL expires in S3_PRESIGNED_URL_EXPIRY seconds.
        """
        key = f"temp/{user_id}/{uuid.uuid4()}.jpg"
        url = self._s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.s3_bucket_name,
                "Key": key,
                "ContentType": "image/jpeg",
            },
            ExpiresIn=settings.s3_presigned_url_expiry,
        )
        return {"upload_url": url, "s3_key": key}

    def generate_presigned_get(self, s3_key: str) -> str:
        """Returns short-lived GET URL for server-side download during analysis."""
        return self._s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket_name, "Key": s3_key},
            ExpiresIn=settings.s3_presigned_url_expiry,
        )

    async def delete_image(self, s3_key: str) -> None:
        """Hard-deletes image from S3. Called immediately after analysis."""
        self._s3.delete_object(Bucket=settings.s3_bucket_name, Key=s3_key)
