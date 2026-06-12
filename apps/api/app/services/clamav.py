"""
ClamAV malware scanning service.
Sends file bytes to the ClamAV daemon via TCP INSTREAM protocol.
The ClamAV daemon runs as a Docker sidecar (service: clamav, port 3310).

Protocol:
  Send:  zINSTREAM\0 + chunks of <4-byte big-endian length><data> + <4-byte 0>
  Recv:  "stream: OK\n" or "stream: <malware-name> FOUND\n"
"""

import asyncio
import struct

from app.core.config import settings


class ClamAVScanError(Exception):
    """Raised when ClamAV returns an unexpected response or connection fails."""


async def scan_bytes(data: bytes) -> tuple[bool, str]:
    """
    Scan raw bytes with ClamAV daemon.

    Returns:
        (is_clean, result_string)
        is_clean=True means no threat detected.

    Raises:
        ClamAVScanError on connection failure.
    """
    if not settings.clamav_enabled:
        return True, "scan_disabled"

    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(settings.clamav_host, settings.clamav_port),
            timeout=10.0,
        )
    except (OSError, asyncio.TimeoutError) as exc:
        raise ClamAVScanError(f"Cannot connect to ClamAV: {exc}") from exc

    try:
        # INSTREAM command
        writer.write(b"zINSTREAM\0")

        # Send file in 4096-byte chunks
        chunk_size = 4096
        for offset in range(0, len(data), chunk_size):
            chunk = data[offset : offset + chunk_size]
            writer.write(struct.pack("!I", len(chunk)) + chunk)

        # Terminate stream
        writer.write(struct.pack("!I", 0))
        await writer.drain()

        raw = await asyncio.wait_for(reader.read(1024), timeout=30.0)
        result = raw.decode().strip()
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass

    is_clean = result.endswith("OK")
    return is_clean, result
