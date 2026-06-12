"""End-to-end smoke tests for the FastAPI server.

These tests use ``TestClient`` to exercise the HTTP surface. They do not
spin up Ollama, so any test that would otherwise hit a model is either
patched or skipped.
"""
from __future__ import annotations

import os
import unittest.mock as mock

import pytest


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    # Isolate the upload dir so this test run doesn't see real user data.
    upload_root = tmp_path_factory.mktemp("mneme_uploads")
    os.environ["MNEME_UPLOAD_DIR"] = str(upload_root)
    # Avoid configuring real logging on import.
    os.environ.setdefault("MNEME_LOG_LEVEL", "ERROR")
    # The module is imported once per process; re-import to pick up env vars.
    import importlib

    from fastapi.testclient import TestClient
    # mneme.server.__init__ shadows the .app submodule name with the FastAPI
    # instance, so use importlib to fetch the actual module object.
    app_module = importlib.import_module("mneme.server.app")
    # The upload dir is captured at module import time; rebuild the registry
    # so it picks up our isolated path.
    from mneme.server.jobs import JobRegistry
    app_module._UPLOAD_DIR = upload_root
    app_module._REGISTRY = JobRegistry(upload_root)
    return TestClient(app_module.app)


class TestHealth:
    def test_health_responds(self, client) -> None:
        resp = client.get("/api/health")
        assert resp.status_code == 200
        body = resp.json()
        assert "version" in body


class TestJobsCRUD:
    def test_list_starts_empty_then_grows(self, client) -> None:
        before = client.get("/api/jobs").json()
        # Import a tiny pre-built deck so we don't need the LLM pipeline.
        resp = client.post(
            "/api/jobs/import",
            json={
                "filename": "smoke.csv",
                "cards": [
                    {"question": "What is 2+2?", "answer": "4"},
                    {"question": "What is the capital of France?", "answer": "Paris"},
                ],
            },
        )
        assert resp.status_code == 200, resp.text
        job = resp.json()
        assert job["n_cards"] == 2

        after = client.get("/api/jobs").json()
        assert len(after) == len(before) + 1

    def test_detail_then_delete_then_404(self, client) -> None:
        created = client.post(
            "/api/jobs/import",
            json={
                "filename": "del.csv",
                "cards": [{"question": "Q", "answer": "A"}],
            },
        ).json()
        job_id = created["id"]

        detail = client.get(f"/api/jobs/{job_id}")
        assert detail.status_code == 200
        assert detail.json()["filename"] == "del.csv"

        deleted = client.delete(f"/api/jobs/{job_id}")
        assert deleted.status_code == 200
        assert deleted.json()["status"] == "deleted"

        # Subsequent access is 404.
        assert client.get(f"/api/jobs/{job_id}").status_code == 404
        # And deleting again is also 404.
        assert client.delete(f"/api/jobs/{job_id}").status_code == 404


class TestFromURLRejectsSSRF:
    @pytest.mark.parametrize(
        "url",
        [
            "http://127.0.0.1/x",
            "http://localhost/",
            "http://10.0.0.5/",
            "http://192.168.1.1/",
            "http://169.254.169.254/latest/meta-data/",
            "file:///etc/passwd",
        ],
    )
    def test_url_ingest_rejects_private_targets(self, client, url) -> None:
        resp = client.post("/api/jobs/from-url", json={"url": url})
        assert resp.status_code == 400
        assert "refus" in resp.text.lower() or "must start" in resp.text.lower()


class TestVisionCheck:
    def test_vision_check_returns_shape(self, client) -> None:
        # Ollama is not running in CI - the endpoint should still respond
        # rather than 500. Patch the requests.get used inside the handler.
        with mock.patch("mneme.server.app.requests.get") as g:
            g.side_effect = Exception("connection refused")
            resp = client.get("/api/vision/check")
        assert resp.status_code == 200
        body = resp.json()
        assert body["available"] is False
        assert body["model"] is None


class TestVisionAskPayloadGuard:
    def test_rejects_oversized_payload(self, client) -> None:
        from mneme.server.safety import MAX_VISION_BASE64_BYTES
        resp = client.post(
            "/api/vision/ask",
            json={
                "image_base64": "a" * (MAX_VISION_BASE64_BYTES + 10),
                "prompt": "describe",
            },
        )
        assert resp.status_code == 413
