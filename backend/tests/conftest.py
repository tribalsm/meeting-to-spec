import pytest
import requests
import httpx


@pytest.fixture(autouse=True)
def block_external_network(monkeypatch):
    """Unit tests must never consume real API credits."""
    def blocked(*args, **kwargs):
        raise AssertionError("External network is disabled in tests")
    monkeypatch.setattr(requests.sessions.Session, "request", blocked)
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", blocked)
