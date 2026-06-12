"""SSRF + payload guards used by user-facing fetch + upload endpoints.

The backend exposes a few endpoints that take user-controlled URLs or
opaque payloads (``/api/jobs/from-url``, ``/api/vision/ask``). Without
guards these are obvious vectors:

* SSRF: a user (or a chained model) could point the URL ingest at the
  AWS metadata service, an internal admin panel, or another local
  service on the host.
* Resource exhaustion: a base64 string can be arbitrarily large; we
  must reject anything beyond a sane upper bound before the JSON
  parser tries to materialise it.

This module gives endpoint handlers two small, dependency-free helpers.
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


class UnsafeURLError(ValueError):
    """Raised when a user-supplied URL resolves to a forbidden address."""


def ensure_public_url(url: str) -> None:
    """Reject URLs whose host resolves to a private / loopback / link-local /
    reserved IP, or whose scheme is not HTTP(S). Always resolves with
    ``getaddrinfo`` rather than ``gethostbyname`` so IPv6 doesn't slip past.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeURLError("only http/https URLs are allowed")
    host = parsed.hostname
    if not host:
        raise UnsafeURLError("URL has no host")

    # Block textual forms of localhost up front; some hosts respond
    # before getaddrinfo would translate them.
    if host.lower() in ("localhost", "ip6-localhost", "ip6-loopback"):
        raise UnsafeURLError("localhost is not allowed")

    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise UnsafeURLError(f"could not resolve host {host}: {exc}") from exc

    for info in infos:
        sockaddr = info[4]
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise UnsafeURLError(
                f"host {host} resolves to a non-public address ({ip})",
            )


# Max byte length of a base64-encoded payload accepted by the vision
# endpoint. 8 MB of base64 -> ~6 MB of raw image, comfortably above
# typical phone screenshots but well below abuse range.
MAX_VISION_BASE64_BYTES = 8 * 1024 * 1024


def ensure_payload_size(b64: str, *, max_bytes: int = MAX_VISION_BASE64_BYTES) -> None:
    """Raise ``ValueError`` if the base64 string would parse to a too-large
    binary. We use the encoded length as a quick upper bound, with the
    matching constant tuned so the decoded value still fits the expected
    image budget."""
    if len(b64) > max_bytes:
        raise ValueError(f"payload too large ({len(b64)} > {max_bytes} bytes)")
