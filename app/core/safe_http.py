"""Fetch a small JSON document from a URL a stranger gave us, without letting them reach our own network (SSRF).

Used for OAuth client metadata documents. Rules: https on port 443 only, no credentials in the URL, every address
the name resolves to must be public, the request goes to the validated address (so DNS cannot change between the
check and the connection) with the real host name for TLS, no redirects, a short timeout, a small size cap.
"""
from __future__ import annotations

import ipaddress
import json
import socket
from urllib.parse import urlparse

import httpx

MAX_BYTES = 64 * 1024


class UnsafeURL(ValueError):
    pass


def public_addresses(host: str, port: int = 443) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise UnsafeURL(f"cannot resolve {host}") from exc
    ips: list[str] = []
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if not ip.is_global or ip.is_multicast:
            raise UnsafeURL("address is not public")
        ips.append(str(ip))
    if not ips:
        raise UnsafeURL("no address")
    return ips


def fetch_json(url: str, timeout: float = 3.0) -> dict:
    u = urlparse(url)
    if u.scheme != "https" or not u.hostname or u.username or u.password or (u.port not in (None, 443)):
        raise UnsafeURL("only plain https URLs on port 443 are allowed")
    host = u.hostname
    ip = public_addresses(host)[0]
    netloc = f"[{ip}]" if ":" in ip else ip
    target = f"https://{netloc}{u.path or '/'}" + (f"?{u.query}" if u.query else "")
    with httpx.stream("GET", target, headers={"Host": host, "Accept": "application/json"}, extensions={"sni_hostname": host},
                      timeout=timeout, follow_redirects=False) as r:
        if r.status_code != 200:
            raise UnsafeURL(f"status {r.status_code}")
        body = b""
        for chunk in r.iter_bytes():
            body += chunk
            if len(body) > MAX_BYTES:
                raise UnsafeURL("document too large")
    data = json.loads(body.decode("utf-8", "replace"))
    if not isinstance(data, dict):
        raise UnsafeURL("not a JSON object")
    return data
