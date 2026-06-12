"""Unit tests for the SSRF + payload guards used by user-facing endpoints."""
from __future__ import annotations

import pytest

from mneme.server.safety import (
    MAX_VISION_BASE64_BYTES,
    UnsafeURLError,
    ensure_payload_size,
    ensure_public_url,
)


class TestEnsurePublicURL:
    def test_rejects_non_http(self) -> None:
        with pytest.raises(UnsafeURLError):
            ensure_public_url("file:///etc/passwd")
        with pytest.raises(UnsafeURLError):
            ensure_public_url("ftp://example.com/x")

    def test_rejects_localhost_literal(self) -> None:
        with pytest.raises(UnsafeURLError):
            ensure_public_url("http://localhost/")
        with pytest.raises(UnsafeURLError):
            ensure_public_url("http://Localhost:8000/x")

    def test_rejects_loopback_ipv4(self) -> None:
        with pytest.raises(UnsafeURLError):
            ensure_public_url("http://127.0.0.1/x")
        with pytest.raises(UnsafeURLError):
            ensure_public_url("http://127.255.0.1/x")

    def test_rejects_loopback_ipv6(self) -> None:
        with pytest.raises(UnsafeURLError):
            ensure_public_url("http://[::1]/")

    def test_rejects_private_rfc1918(self) -> None:
        with pytest.raises(UnsafeURLError):
            ensure_public_url("http://10.0.0.5/")
        with pytest.raises(UnsafeURLError):
            ensure_public_url("http://192.168.1.1/")
        with pytest.raises(UnsafeURLError):
            ensure_public_url("http://172.16.5.5/")

    def test_rejects_link_local_metadata(self) -> None:
        # AWS / GCP / Azure metadata service
        with pytest.raises(UnsafeURLError):
            ensure_public_url("http://169.254.169.254/latest/meta-data/")

    def test_accepts_public_address(self) -> None:
        # 8.8.8.8 is reserved-public DNS; ensure_public_url should not raise.
        ensure_public_url("http://8.8.8.8/")

    def test_rejects_unresolvable_host(self) -> None:
        with pytest.raises(UnsafeURLError):
            ensure_public_url("http://this-host-must-not-exist-mneme-xyz/")


class TestEnsurePayloadSize:
    def test_accepts_small_payload(self) -> None:
        ensure_payload_size("a" * 1000)

    def test_rejects_over_cap(self) -> None:
        with pytest.raises(ValueError):
            ensure_payload_size("a" * (MAX_VISION_BASE64_BYTES + 1))

    def test_honors_custom_max(self) -> None:
        ensure_payload_size("a" * 50, max_bytes=100)
        with pytest.raises(ValueError):
            ensure_payload_size("a" * 200, max_bytes=100)
