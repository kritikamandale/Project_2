"""
One-time backfill: resolve a product photo for every catalog row.

For each product, fetches ITS OWN product_url (the brand/retailer page we
already link to as the "Buy" button) and reads the page's `og:image` /
`twitter:image` meta tag — the same metadata a link-preview (Slack, iMessage,
Twitter) would read. This is a single, one-time request per product, not a
recurring or bulk-catalog scrape.

Some retailers actively block non-browser requests (e.g. Nykaa returns 403,
some brand sites redirect to a JS-only landing page for bots). Those rows are
left with image_url = NULL and the frontend falls back to a category icon —
this script does not fabricate placeholder images.

Run from apps/api with the venv active:
    python scripts/backfill_product_images.py
"""

import asyncio
import re
import sys
from pathlib import Path

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import migration_engine  # noqa: E402
from app.models.product import Product  # noqa: E402

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
}

_META_IMAGE_RE = re.compile(r'og:image|twitter:image', re.I)


def _extract_image(html: str, base_url: str) -> str | None:
    soup = BeautifulSoup(html, "lxml")
    for prop in ("og:image:secure_url", "og:image", "twitter:image"):
        tag = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            url = tag["content"].strip()
            if url.startswith("//"):
                url = "https:" + url
            if url.startswith("http"):
                return url
    return None


async def _fetch_image(client: httpx.AsyncClient, url: str) -> tuple[str | None, str]:
    try:
        resp = await client.get(url, headers=HEADERS, timeout=15, follow_redirects=True)
    except Exception as exc:  # noqa: BLE001 — best-effort backfill, log and move on
        return None, f"error: {exc!r}"
    if resp.status_code != 200:
        return None, f"http {resp.status_code}"
    if len(resp.text) < 2000:
        # Suspiciously small body — usually a bot-block JS redirect shell, not
        # the real page (seen from Dermaco/Bioderma during a dry run).
        return None, "blocked (redirect shell)"
    image = _extract_image(resp.text, url)
    return (image, "ok") if image else (None, "no og:image found")


async def main() -> None:
    Session = async_sessionmaker(bind=migration_engine, expire_on_commit=False)
    async with Session() as session:
        result = await session.execute(
            select(Product).where(Product.is_active.is_(True))
        )
        products = list(result.scalars().all())

    print(f"Found {len(products)} active products.\n")

    ok, failed = 0, []
    async with httpx.AsyncClient(http2=False) as client:
        for p in products:
            if not p.product_url:
                failed.append((p.product_name, "no product_url"))
                continue
            image, status = await _fetch_image(client, p.product_url)
            label = f"{p.brand_display or p.brand} — {p.product_name}"
            if image:
                async with Session() as session:
                    row = await session.get(Product, p.id)
                    row.image_url = image
                    await session.commit()
                ok += 1
                print(f"[OK]     {label}\n         -> {image}")
            else:
                failed.append((label, status))
                print(f"[SKIP]   {label} ({status})")
            await asyncio.sleep(0.5)  # polite delay between requests

    print(f"\n{'-'*60}")
    print(f"Backfilled {ok}/{len(products)} product images.")
    if failed:
        print(f"\n{len(failed)} left without an image (frontend falls back to an icon):")
        for label, reason in failed:
            print(f"  - {label}: {reason}")


if __name__ == "__main__":
    asyncio.run(main())
