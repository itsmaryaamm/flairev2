"""Connector tests: honest sandbox wording, discoverable tools, explicit employee choice, SSRF-safe client metadata."""
import json
import os

os.environ["DATABASE_URL"] = "sqlite:///./test_connector.db"
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["AUTH_ENGINE"] = "native"

import pytest
from fastapi.testclient import TestClient

from app.core import safe_http
from app.core.db import Base, engine
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True, scope="module")
def _fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("test_connector.db"):
        os.remove("test_connector.db")


@pytest.fixture(scope="module")
def ctx():
    r = client.post("/api/v1/auth/register", json={"company_name": "ConnCo", "email": "o@conn.sa", "password": "password123", "full_name": "Owner"})
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}
    client.patch("/api/v1/company", json={"trusted_merchants": ["Buffer", "Canva"]}, headers=H)
    dept = client.post("/api/v1/departments", json={"name": "Marketing", "monthly_budget": 1_000_000}, headers=H).json()
    client.post("/api/v1/cards", json={"label": "SNB", "provider": "mock_snb", "last4": "4471", "credit_limit": 2_000_000, "is_default": True}, headers=H)
    ag = client.post("/api/v1/agents", json={"name": "Marketing AI", "role": "marketing", "department_id": dept["id"], "per_transaction_limit": 100_000,
                                            "monthly_limit": 400_000, "approval_threshold": 50_000, "allowed_categories": ["software", "advertising"], "blocked_merchants": ["Casino"]}, headers=H).json()
    return {"H": H, "url": f"/api/v1/mcp/{ag['api_key']}"}


def rpc(ctx, method, params=None, id_=1):
    return client.post(ctx["url"], json={"jsonrpc": "2.0", "id": id_, "method": method, "params": params or {}}).json()["result"]


def call(ctx, name, args=None):
    r = rpc(ctx, "tools/call", {"name": name, "arguments": args or {}})
    return json.loads(r["content"][0]["text"]), r["isError"]


def test_instructions_are_short_and_say_sandbox(ctx):
    ins = rpc(ctx, "initialize")["instructions"]
    assert len(ins) < 900 and "SANDBOX" in ins and "check_budget" in ins and "request_purchase" in ins
    assert "immediately" not in ins and "without asking" not in ins.lower()


def test_tools_are_discoverable_and_annotated(ctx):
    tools = {t["name"]: t for t in rpc(ctx, "tools/list")["tools"]}
    assert {"get_agent_context", "check_budget", "request_purchase", "get_purchase_status", "list_my_requests", "get_usage_guide", "search", "fetch"} <= set(tools)
    for name, t in tools.items():
        assert t["description"] and t["annotations"]["title"]
        if name != "request_purchase":
            assert t["annotations"]["readOnlyHint"] is True
    rp = tools["request_purchase"]
    assert rp["annotations"]["readOnlyHint"] is False  # a write: the host keeps its confirmation
    assert set(rp["inputSchema"]["required"]) == {"amount", "merchant", "category", "description"}
    assert "subscription" in rp["description"] and "check_budget" in rp["description"] and "never tell the user" in rp["description"].lower()
    assert "approve" not in " ".join(tools)


def test_agent_context_and_usage_guide(ctx):
    c, err = call(ctx, "get_agent_context")
    assert not err and c["connected_as"] == "Marketing AI" and c["mode"] == "sandbox" and "simulated" in c["sandbox_notice"].lower()
    assert c["permissions"]["human_approval_at_or_above_sar"] == 500
    g, _ = call(ctx, "get_usage_guide")
    assert "not proof of payment" in g["guide"]


def test_results_never_claim_real_payment(ctx):
    ok, err = call(ctx, "request_purchase", {"amount": 50, "currency": "SAR", "merchant": "Buffer", "category": "software", "description": "Social scheduling plan"})
    assert not err and ok["status"] == "simulated_authorization" and ok["outcome"] == "Simulated authorization" and ok["simulated"] is True
    assert ok["payment_mode"] == "sandbox_simulated" and "no real money" in ok["message"].lower()
    blob = json.dumps(ok).lower()
    assert "paid" not in blob and "settled" not in blob
    held, err = call(ctx, "request_purchase", {"amount": 900, "merchant": "Canva", "category": "software", "description": "Annual team plan"})
    assert held["status"] == "pending_approval" and held["outcome"] == "Pending approval" and "do not retry" in held["message"].lower()
    blocked, err = call(ctx, "request_purchase", {"amount": 20, "merchant": "Casino Royale", "category": "software", "description": "x"})
    assert err is True and blocked["status"] == "denied" and blocked["outcome"] == "Blocked"
    status, _ = call(ctx, "get_purchase_status", {"request_id": held["request_id"]})
    assert status["status"] == "pending_approval"


def test_usd_is_converted_and_legacy_amount_sar_still_works(ctx):
    usd, _ = call(ctx, "request_purchase", {"amount": 20, "currency": "USD", "merchant": "Buffer", "category": "software", "description": "Plan"})
    assert usd["amount_sar"] == 75.0 and "USD 20.00" in usd["requested"]
    legacy, err = call(ctx, "request_purchase", {"amount_sar": 30, "merchant": "Buffer", "category": "software", "description": "Legacy client"})
    assert not err and legacy["amount_sar"] == 30
    bad, err = call(ctx, "request_purchase", {"amount": 5, "currency": "EUR", "merchant": "Buffer", "category": "software", "description": "x"})
    assert err is True


def test_ssrf_guard_rejects_private_and_unsafe_urls(monkeypatch):
    for ip in ("127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.0.5", "172.16.0.1", "::1", "0.0.0.0"):
        monkeypatch.setattr(safe_http.socket, "getaddrinfo", lambda *a, _ip=ip, **k: [(2, 1, 6, "", (_ip, 443))])
        with pytest.raises(safe_http.UnsafeURL):
            safe_http.fetch_json("https://evil.example/client.json")
    # a name that resolves to one public and one private address is refused as a whole
    monkeypatch.setattr(safe_http.socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("93.184.216.34", 443)), (2, 1, 6, "", ("10.0.0.1", 443))])
    with pytest.raises(safe_http.UnsafeURL):
        safe_http.fetch_json("https://evil.example/client.json")
    for bad in ("http://evil.example/x", "https://user:pw@evil.example/x", "https://evil.example:8443/x", "file:///etc/passwd", "https:///x"):
        with pytest.raises(safe_http.UnsafeURL):
            safe_http.fetch_json(bad)


def test_unknown_url_client_cannot_use_an_attacker_redirect(monkeypatch):
    monkeypatch.setattr(safe_http.socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("127.0.0.1", 443))])
    q = {"response_type": "code", "client_id": "https://evil.example/client.json", "redirect_uri": "https://evil.example/cb", "code_challenge": "x" * 43, "code_challenge_method": "S256"}
    assert client.get("/api/v1/oauth/authorize", params=q).status_code == 400
    q["redirect_uri"] = "https://claude.ai/api/mcp/auth_callback"
    assert client.get("/api/v1/oauth/authorize", params=q).status_code == 200  # the known Claude callback is still accepted
    q["redirect_uri"] = "https://claude.ai.evil.example/api/mcp/auth_callback"
    assert client.get("/api/v1/oauth/authorize", params=q).status_code == 400


def test_profile_edit_name_and_photo():
    from fastapi.testclient import TestClient
    from app.main import app
    import uuid
    c = TestClient(app)
    email = f"p{uuid.uuid4().hex[:8]}@example.com"
    r = c.post("/api/v1/auth/register", json={"email": email, "password": "Password123!", "full_name": "Old Name", "company_name": "Co"})
    assert r.status_code in (200, 201), r.text
    h = {"Authorization": "Bearer " + r.json()["access_token"]}
    r = c.patch("/api/v1/auth/me", json={"full_name": "  New   Name "}, headers=h)
    assert r.status_code == 200 and r.json()["user"]["full_name"] == "New Name"
    r = c.patch("/api/v1/auth/me", json={"avatar": "data:image/png;base64,iVBORw0KGgo="}, headers=h)
    assert r.json()["user"]["avatar"].startswith("data:image/png")
    assert c.patch("/api/v1/auth/me", json={"avatar": "data:text/html;base64,PGI+"}, headers=h).status_code == 422
    r = c.patch("/api/v1/auth/me", json={"remove_avatar": True}, headers=h)
    assert r.json()["user"]["avatar"] is None
    assert c.get("/api/v1/auth/me", headers=h).json()["user"]["full_name"] == "New Name"


def test_public_chat_static_without_key_and_gemini_tools_schema(monkeypatch):
    from app.api.routes import settings
    from app.agents import gemini
    monkeypatch.setattr(settings, "gemini_api_key", None)
    r = client.post("/api/v1/public/chat", json={"message": "what is flaire?"})
    assert r.status_code == 200 and r.json()["mode"] == "static"
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(gemini, "generate", lambda body: {"candidates": [{"content": {"parts": [{"text": "It is a sandbox."}]}}]})
    r = client.post("/api/v1/public/chat", json={"message": "is it real money?", "history": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]})
    assert r.json() == {"reply": "It is a sandbox.", "mode": "gemini"}
    from app.agents.chat import ASSISTANT_TOOLS
    d = gemini.to_declarations(ASSISTANT_TOOLS)[0]["functionDeclarations"]
    assert all("default" not in str(x) for x in d) and d[0]["name"] == "pending_approvals" and "parameters" not in d[0]


def test_chatgpt_redirect_trusted_host_fallback(monkeypatch):
    from app.api import oauth
    monkeypatch.setattr(oauth.safe_http, "fetch_json", lambda u: {"client_id": u, "redirect_uris": ["https://chatgpt.com/other"]})
    cid = "https://chatgpt.com/oauth/h-abc/client.json"
    assert oauth._trusted_host_redirect(cid, "https://chatgpt.com/connector/oauth/xyz123")
    assert not oauth._trusted_host_redirect(cid, "https://evil.example/cb")
    assert not oauth._trusted_host_redirect("https://evil.example/c.json", "https://chatgpt.com/connector/oauth/x")
    assert not oauth._trusted_host_redirect(cid, "http://chatgpt.com/x")


def test_guard_blocks_off_topic_but_keeps_flaire_questions():
    from app.agents.guard import is_on_topic
    for q in ["what is 12*7", "solve this equation for my homework", "write me a python script", "tell me a joke", "write an essay about dogs"]:
        assert not is_on_topic(q), q
    for q in ["How does Flaire work?", "can my AI overspend?", "is it real money", "how do I set a budget", "approve the AWS request", "hi", "ما هي ميزانية الذكاء الاصطناعي؟", "how much is left for Marketing AI"]:
        assert is_on_topic(q), q
    assert is_on_topic("and the second one?", True) and not is_on_topic("and the second one?", False)


def test_static_faq_answers_the_actual_question(monkeypatch):
    from app.api.routes import settings
    monkeypatch.setattr(settings, "gemini_api_key", None)
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)
    r = c.post("/api/v1/public/chat", json={"message": "Is it real money?"}).json()
    assert r["reply"].startswith("No. Flaire is a sandbox") and r["mode"] == "static"
    r = c.post("/api/v1/public/chat", json={"message": "Can my AI overspend?"}).json()
    assert "limit" in r["reply"] and "sandbox" not in r["reply"].split(".")[0].lower()
    r = c.post("/api/v1/public/chat", json={"message": "هل هي أموال حقيقية؟"}).json()
    assert "بيئة تجريبية" in r["reply"]
