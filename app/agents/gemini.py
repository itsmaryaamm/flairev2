"""Gemini client for the Flaire assistants. The API key lives only on the server (GEMINI_API_KEY)."""
from __future__ import annotations

import json
import logging

import httpx

from app.core.config import get_settings

settings = get_settings()

log = logging.getLogger("flaire.gemini")
BASE = "https://generativelanguage.googleapis.com/v1beta/models"
FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]
MAX_ROUNDS = 5


def _clean_schema(node):
    """Gemini accepts a subset of JSON schema: drop keys it rejects."""
    if isinstance(node, dict):
        return {k: _clean_schema(v) for k, v in node.items() if k not in ("default", "additionalProperties", "$schema")}
    if isinstance(node, list):
        return [_clean_schema(v) for v in node]
    return node


def to_declarations(tools: list[dict]) -> list[dict]:
    out = []
    for t in tools:
        d = {"name": t["name"], "description": t["description"]}
        schema = _clean_schema(t["input_schema"])
        if schema.get("properties"):
            d["parameters"] = schema
        out.append(d)
    return [{"functionDeclarations": out}] if out else []


def _post(model: str, body: dict) -> dict:
    r = httpx.post(f"{BASE}/{model}:generateContent", params={"key": settings.gemini_api_key}, json=body, timeout=40)
    if r.status_code == 404:
        raise LookupError(model)
    r.raise_for_status()
    return r.json()


def generate(body: dict) -> dict:
    models = [settings.gemini_model] + [m for m in FALLBACK_MODELS if m != settings.gemini_model]
    last: Exception | None = None
    for m in models:
        try:
            return _post(m, body)
        except LookupError as exc:
            last = exc
            continue
    raise RuntimeError(f"no Gemini model available: {last}")


def _text_of(resp: dict) -> tuple[str, list[dict]]:
    cands = resp.get("candidates") or []
    if not cands:
        return "", []
    parts = (cands[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts if "text" in p).strip()
    calls = [p["functionCall"] for p in parts if "functionCall" in p]
    return text, calls


def chat(system: str, history: list[dict], message: str, tools: list[dict] | None = None, tool_fn=None, max_tokens: int = 700) -> str:
    """history: [{role: user|assistant, content: str}]. Runs the tool loop. Returns the reply text."""
    contents = [{"role": "model" if h["role"] == "assistant" else "user", "parts": [{"text": h["content"]}]} for h in history if h.get("content")]
    contents.append({"role": "user", "parts": [{"text": message}]})
    body = {"systemInstruction": {"parts": [{"text": system}]}, "contents": contents,
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": max_tokens}}
    decl = to_declarations(tools or [])
    if decl:
        body["tools"] = decl
    for _ in range(MAX_ROUNDS):
        resp = generate(body)
        text, calls = _text_of(resp)
        if not calls:
            return text or "Sorry, I could not answer that. Try asking another way."
        parts = ((resp.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
        body["contents"].append({"role": "model", "parts": parts})
        results = []
        for c in calls:
            out = tool_fn(c["name"], dict(c.get("args") or {})) if tool_fn else {"error": "no tools"}
            results.append({"functionResponse": {"name": c["name"], "response": {"result": json.loads(json.dumps(out, default=str))}}})
        body["contents"].append({"role": "user", "parts": results})
    return text or "Done."
