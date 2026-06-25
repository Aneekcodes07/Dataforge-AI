"""SSRF guard tests (pure stdlib; deterministic, no real DNS required)."""

import pytest

from src.ingestion import security
from src.ingestion.security import SsrfError, assert_safe_url


def test_rejects_non_http_scheme():
    with pytest.raises(SsrfError):
        assert_safe_url("file:///etc/passwd")
    with pytest.raises(SsrfError):
        assert_safe_url("ftp://example.com/x")


def test_rejects_missing_host():
    with pytest.raises(SsrfError):
        assert_safe_url("http://")


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/admin",
        "http://10.0.0.5/internal",
        "http://192.168.1.1/",
        "http://169.254.169.254/latest/meta-data/",  # cloud metadata
        "http://[::1]/",
        "http://0.0.0.0/",
    ],
)
def test_rejects_private_and_loopback_ip_literals(url):
    with pytest.raises(SsrfError):
        assert_safe_url(url)


def test_accepts_public_ip_literal():
    # Public IP literal: validated without any DNS lookup.
    assert_safe_url("http://93.184.216.34/")  # documentation/example range


def test_rejects_hostname_resolving_to_private(monkeypatch):
    monkeypatch.setattr(
        security, "resolve_host_addresses", lambda host, port: ["10.1.2.3"]
    )
    with pytest.raises(SsrfError):
        assert_safe_url("https://intranet.example.com/data")


def test_accepts_hostname_resolving_to_public(monkeypatch):
    monkeypatch.setattr(
        security, "resolve_host_addresses", lambda host, port: ["93.184.216.34"]
    )
    assert_safe_url("https://example.com/data")
