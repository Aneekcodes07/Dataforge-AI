"""Network security guards for ingestion connectors.

The URL/API connectors fetch arbitrary user-supplied endpoints, which is a classic
Server-Side Request Forgery (SSRF) vector. :func:`assert_safe_url` enforces a
scheme allowlist and rejects any host that resolves to a private, loopback,
link-local, reserved, or otherwise non-public address (including the cloud
metadata endpoint ``169.254.169.254``). It is implemented with the standard
library only so it is fully unit-testable without network access.
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

ALLOWED_SCHEMES = ("http", "https")


class SsrfError(ValueError):
    """Raised when a URL is rejected by the SSRF guard."""


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Return True if an IP must not be contacted from a server-side fetcher."""
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def resolve_host_addresses(host: str, port: int) -> list[str]:
    """Resolve a hostname to all of its IP addresses (DNS).

    Separated out so tests can patch it; raises :class:`SsrfError` on failure.
    """
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise SsrfError(f"Unable to resolve host '{host}': {exc}") from exc
    return [info[4][0] for info in infos]


def assert_safe_url(url: str) -> None:
    """Validate that ``url`` is a safe, public HTTP(S) target.

    Raises :class:`SsrfError` if the scheme is not allowed, the host is missing,
    cannot be resolved, or resolves to any non-public address. Every resolved
    address is checked (defends against round-robin / partial DNS rebinding).
    """
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise SsrfError(
            f"URL scheme '{parsed.scheme}' is not allowed; use http or https"
        )

    host = parsed.hostname
    if not host:
        raise SsrfError("URL is missing a host")

    default_port = 443 if parsed.scheme == "https" else 80
    port = parsed.port or default_port

    # A bare IP literal must itself be public; do not allow private targets.
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        if _is_blocked_ip(literal):
            raise SsrfError(f"Refusing to fetch non-public address {host}")
        return

    for addr in resolve_host_addresses(host, port):
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            raise SsrfError(f"Host '{host}' resolved to an invalid address {addr}")
        if _is_blocked_ip(ip):
            raise SsrfError(
                f"Host '{host}' resolves to non-public address {addr}; refusing"
            )
