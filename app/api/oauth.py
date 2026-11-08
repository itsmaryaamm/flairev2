"""OAuth 2.1 authorization server for the Flaire MCP connector ("Sign in" flow in Claude).

Flow (what Claude does when a user adds https://<api>/api/v1/mcp as a custom connector):
  1. GET  /.well-known/oauth-protected-resource[/api/v1/mcp]   → points at this authorization server
  2. GET  /.well-known/oauth-authorization-server              → endpoints, PKCE S256, DCR supported
  3. POST /api/v1/oauth/register   (dynamic client registration) or a client_id that is an https URL (CIMD)
  4. GET  /api/v1/oauth/authorize  → Flaire-hosted sign-in + "which AI employee is this Claude?" page
  5. POST /api/v1/oauth/authorize  → verifies password, creates/picks the agent, redirects back with ?code=
  6. POST /api/v1/oauth/token      → exchanges code (+ PKCE verifier) for a bearer token bound to that agent
  7. Claude calls /api/v1/mcp with Authorization: Bearer <token>

Tokens are random, stored hashed, bound to one agent and one company, revocable from the dashboard, 90 days.
Codes are single-use and live 10 minutes. PKCE is required. Redirect URIs must match the registered client, or,
for URL client_ids, the metadata fetched from that URL; Claude's own domains are allowed as a fallback.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import html
import json
import secrets
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import get_settings
from app.core.db import get_db
from app.core import safe_http
from app.core.security import generate_agent_key, hash_api_key, verify_password
from app.models import Agent, Company, Department, OAuthClient, OAuthCode, OAuthToken, User, utcnow

router = APIRouter()
well_known = APIRouter()
settings = get_settings()

TOKEN_TTL_DAYS = 90
CODE_TTL_SECONDS = 600
# Used only when a client's metadata document cannot be fetched: exact callback URLs of the hosts we know.
KNOWN_CALLBACKS = ("https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback",
                   "https://chatgpt.com/connector_platform_oauth_redirect", "https://platform.openai.com/apps-manage/oauth")


def base_url(request: Request) -> str:
    cfg = get_settings().api_base_url.rstrip("/")
    if cfg and "localhost" not in cfg:
        return cfg
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", "localhost:8000"))
    return f"{proto}://{host}"


# ---------------------------------------------------------------- metadata
def _as_metadata(request: Request) -> dict:
    b = base_url(request)
    return {
        "issuer": b,
        "authorization_endpoint": f"{b}/api/v1/oauth/authorize",
        "token_endpoint": f"{b}/api/v1/oauth/token",
        "registration_endpoint": f"{b}/api/v1/oauth/register",
        "revocation_endpoint": f"{b}/api/v1/oauth/revoke",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none", "client_secret_post"],
        "scopes_supported": ["purchases"],
        "client_id_metadata_document_supported": True,
    }


@well_known.get("/.well-known/oauth-authorization-server", include_in_schema=False)
@well_known.get("/.well-known/oauth-authorization-server/api/v1/mcp", include_in_schema=False)
def as_metadata(request: Request):
    return _as_metadata(request)


@well_known.get("/.well-known/oauth-protected-resource", include_in_schema=False)
@well_known.get("/.well-known/oauth-protected-resource/api/v1/mcp", include_in_schema=False)
def prm(request: Request):
    b = base_url(request)
    return {"resource": f"{b}/api/v1/mcp", "authorization_servers": [b], "scopes_supported": ["purchases"], "bearer_methods_supported": ["header"]}


# ---------------------------------------------------------------- client registration
@router.post("/oauth/register", status_code=201, tags=["oauth"], include_in_schema=False)
def register_client(request: Request, body: dict, db: Session = Depends(get_db)):
    from app.core import guard
    guard.check_rate(f"oauth-register:{guard.client_ip(request)}", limit=30, window=3600)
    redirect_uris = body.get("redirect_uris") or []
    if not redirect_uris or not all(isinstance(u, str) and u.startswith(("https://", "http://localhost", "http://127.0.0.1")) for u in redirect_uris):
        raise HTTPException(400, "redirect_uris must be https URLs")
    client = OAuthClient(client_id="fcl_" + secrets.token_urlsafe(16), client_name=str(body.get("client_name") or "MCP client")[:120],
                         redirect_uris=redirect_uris, token_endpoint_auth_method=body.get("token_endpoint_auth_method") or "none")
    db.add(client)
    db.commit()
    return {"client_id": client.client_id, "client_name": client.client_name, "redirect_uris": client.redirect_uris,
            "token_endpoint_auth_method": client.token_endpoint_auth_method, "grant_types": ["authorization_code", "refresh_token"], "response_types": ["code"]}


def _allowed_redirect(db: Session, client_id: str, redirect_uri: str) -> bool:
    client = db.query(OAuthClient).filter(OAuthClient.client_id == client_id).first()
    if client:
        return redirect_uri in (client.redirect_uris or [])
    if client_id.startswith("https://"):
        # Client ID Metadata Document: fetched safely (public addresses only), and it must describe itself.
        try:
            doc = safe_http.fetch_json(client_id)
            if doc.get("client_id") == client_id and redirect_uri in (doc.get("redirect_uris") or []):
                return True
        except Exception:
            pass
        return redirect_uri in KNOWN_CALLBACKS
    return False


# ---------------------------------------------------------------- sign-in ticket (carries the signed-in person to the choose step)
def _sign(payload: dict) -> str:
    raw = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    sig = hmac.new(get_settings().jwt_secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return f"{raw}.{sig}"


def _unsign(ticket: str) -> dict | None:
    try:
        raw, sig = ticket.rsplit(".", 1)
        good = hmac.new(get_settings().jwt_secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, good):
            return None
        data = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
        return data if data.get("exp", 0) > time.time() else None
    except Exception:
        return None


# ---------------------------------------------------------------- authorize: sign in, choose the AI employee, confirm
STYLE = """<style>
:root{--v:#7B2FF2;--ink:#16112B;--body:#443E5C;--mut:#6A6384;--line:#E3DFEE;--bg:#F7F6FA;--lav:#F1E8FF}
*{box-sizing:border-box}body{margin:0;font-family:'Instrument Sans',system-ui,sans-serif;background:var(--bg);color:var(--ink);display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;-webkit-font-smoothing:antialiased}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:28px;width:100%;max-width:460px}
h1{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:26px;line-height:1.1;letter-spacing:-.035em;margin:0 0 6px}p{color:var(--body);margin:0 0 18px;font-size:14px;line-height:1.5}
label.f{display:block;font-size:13px;font-weight:600;margin:14px 0 6px}input[type=text],input[type=email],input[type=password]{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:15px;background:#fff}
button{margin-top:20px;width:100%;padding:14px;border:0;border-radius:10px;background:var(--v);color:#fff;font:inherit;font-weight:600;font-size:15px;cursor:pointer}
.err{background:#FDE6E6;color:#B3202A;border-radius:10px;padding:10px 12px;font-size:13px;margin:14px 0 0}
.logo{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:22px;letter-spacing:-.04em;color:var(--v)}
.sb{font:600 11px 'Instrument Sans',sans-serif;background:#FBBF24;color:#3B2A00;border-radius:4px;padding:3px 8px;letter-spacing:0}
.small{font-size:12px;color:var(--mut);margin-top:10px}.who{background:var(--lav);border-radius:10px;padding:11px 14px;font-size:13px;margin-bottom:6px}
.opt{display:block;border:1px solid var(--line);border-radius:12px;padding:14px;margin-top:10px;cursor:pointer}.opt:has(input:checked){border:2px solid var(--v);background:#FAF6FF;padding:13px}
.opt input{margin-right:8px}.opt b{font-size:15px}.opt .m{display:block;color:var(--body);font-size:13px;margin:6px 0 0 24px;line-height:1.5}
.row{display:flex;justify-content:space-between;font-size:14px;padding:9px 0;border-bottom:1px solid var(--line)}.row:last-child{border:0}
.note{background:var(--lav);border-radius:10px;padding:12px 14px;font-size:13px;color:var(--ink);margin-top:16px;line-height:1.5}
a.btn{display:block;text-align:center;margin-top:20px;padding:14px;border-radius:10px;background:var(--v);color:#fff;text-decoration:none;font-weight:600}
</style>"""
HEAD = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Flaire</title>'
        '<link rel="icon" href="https://flaire-nine.vercel.app/favicon-32.png">'
        '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">'
        + STYLE + '</head><body>')
LOGO = '<div class="logo">Flaire<span class="sb">Sandbox</span></div>'


def _hidden(params: dict) -> str:
    keys = ("client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "resource")
    return "".join(f'<input type="hidden" name="{k}" value="{html.escape(str(params.get(k, "")))}">' for k in keys)


def _render(client_name: str, params: dict, error: str = "", email: str = "") -> HTMLResponse:
    """Step 1: sign in."""
    forgot = f"{get_settings().dashboard_url.rstrip('/')}/forgot"
    err = f'<div class="err">{html.escape(error)}</div>' if error else ""
    return HTMLResponse(HEAD + f"""<form class="card" method="post">{LOGO}
<h1>Connect Flaire to {html.escape(client_name)}</h1>
<p>Sign in to your Flaire company. Next you choose which AI employee this is and see what it can do. Nothing is created until you confirm.</p>
{err}
<label class="f">Email</label><input name="email" type="email" required autocomplete="email" value="{html.escape(email)}">
<label class="f">Password</label><input name="password" type="password" required autocomplete="current-password">
<p class="small"><a href="{html.escape(forgot)}" style="color:#7B2FF2">Forgot password?</a></p>
<label class="f">Authentication code <span style="font-weight:400;color:#6A6384">(only if you use 2FA)</span></label><input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="123 456">
<input type="hidden" name="stage" value="signin">{_hidden(params)}
<button type="submit">Sign in</button></form></body></html>""")


def _sar(halalas: int) -> str:
    v = (halalas or 0) / 100
    return f"SAR {v:,.0f}" if v == int(v) else f"SAR {v:,.2f}"


def _render_choose(client_name: str, params: dict, ticket: str, agents: list[Agent], error: str = "") -> HTMLResponse:
    """Step 2: choose the AI employee, see its sandbox permissions, confirm."""
    err = f'<div class="err">{html.escape(error)}</div>' if error else ""
    opts = ""
    for a in agents:
        dept = a.department.name if a.department else ""
        opts += (f'<label class="opt"><input type="radio" name="choice" value="{a.id}" required><b>{html.escape(a.name)}</b> <span style="color:#6A6384;font-size:13px">{html.escape(dept)}</span>'
                 f'<span class="m">Up to {_sar(a.monthly_limit)} a month, {_sar(a.per_transaction_limit)} per purchase.<br>A person approves anything from {_sar(a.approval_threshold)}.<br>Spent this month: {_sar(a.spent_this_period)}.</span></label>')
    opts += ('<label class="opt"><input type="radio" name="choice" value="__new__" required><b>Create a new AI employee</b>'
             '<span class="m">Sandbox limits: up to SAR 5,000 a month, SAR 1,000 per purchase. A person approves anything from SAR 500. You can change all of this in the dashboard.'
             '<br><input type="text" name="new_name" maxlength="60" placeholder="Name, for example Marketing AI" style="margin-top:8px"></span></label>')
    return HTMLResponse(HEAD + f"""<form class="card" method="post">{LOGO}
<h1>Which AI employee is this {html.escape(client_name)}?</h1>
<p>It will be able to ask Flaire to authorize purchases within the limits below. It can never approve its own requests or change limits.</p>
{err}{opts}
<div class="note"><b>Sandbox.</b> Every purchase is simulated. No real money moves.</div>
<input type="hidden" name="stage" value="confirm"><input type="hidden" name="ticket" value="{html.escape(ticket)}">{_hidden(params)}
<button type="submit">Confirm and connect</button></form></body></html>""")


def _render_done(agent: Agent, company: Company, target: str) -> HTMLResponse:
    """Step 3: the read-only check, then back to the app."""
    t = html.escape(target)
    return HTMLResponse(HEAD.replace("</head>", f'<meta http-equiv="refresh" content="4;url={t}"></head>') + f"""<div class="card">{LOGO}
<h1>Connected</h1>
<p>{html.escape(company.name)} now has this AI employee. Here is what Flaire sees:</p>
<div class="row"><span>Connected as</span><b>{html.escape(agent.name)}</b></div>
<div class="row"><span>Monthly sandbox budget</span><b>{_sar(agent.monthly_limit)}</b></div>
<div class="row"><span>Per purchase</span><b>{_sar(agent.per_transaction_limit)}</b></div>
<div class="row"><span>Needs your approval from</span><b>{_sar(agent.approval_threshold)}</b></div>
<div class="row"><span>Mode</span><b>Sandbox, simulated</b></div>
<div class="note">Ask your AI for something that costs money, like finding a tool and buying a subscription. It may ask your permission to use Flaire the first time.</div>
<a class="btn" href="{t}">Return to the app</a></div></body></html>""")


def _client_name(db: Session, client_id: str) -> str:
    c = db.query(OAuthClient).filter(OAuthClient.client_id == client_id).first()
    if c:
        return c.client_name
    if client_id.startswith("https://"):
        return urlparse(client_id).hostname or "your AI"
    return "your AI"


@router.get("/oauth/authorize", response_class=HTMLResponse, tags=["oauth"], include_in_schema=False)
def authorize_page(request: Request, db: Session = Depends(get_db)):
    q = dict(request.query_params)
    if q.get("response_type") != "code" or not q.get("client_id") or not q.get("redirect_uri") or not q.get("code_challenge"):
        raise HTTPException(400, "response_type=code, client_id, redirect_uri and code_challenge (PKCE) are required")
    if q.get("code_challenge_method", "S256") != "S256":
        raise HTTPException(400, "Only S256 PKCE is supported")
    from app.core import guard
    guard.check_rate(f"oauth-page:{guard.client_ip(request)}", limit=60, window=900)
    if not _allowed_redirect(db, q["client_id"], q["redirect_uri"]):
        raise HTTPException(400, "redirect_uri is not registered for this client")
    return _render(_client_name(db, q["client_id"]), q)


def _active_agents(db: Session, company_id: int) -> list[Agent]:
    return db.query(Agent).filter(Agent.company_id == company_id, Agent.status == "active", Agent.api_key_hash != "revoked").order_by(Agent.id).all()


@router.post("/oauth/authorize", tags=["oauth"], include_in_schema=False)
def authorize_submit(request: Request, db: Session = Depends(get_db), stage: str = Form("signin"), email: str = Form(""), password: str = Form(""), code: str = Form(""),
                     ticket: str = Form(""), choice: str = Form(""), new_name: str = Form(""),
                     client_id: str = Form(...), redirect_uri: str = Form(...), state: str = Form(""), code_challenge: str = Form(...),
                     code_challenge_method: str = Form("S256"), scope: str = Form("purchases"), resource: str = Form("")):
    params = {"client_id": client_id, "redirect_uri": redirect_uri, "state": state, "code_challenge": code_challenge, "code_challenge_method": code_challenge_method, "scope": scope, "resource": resource}
    if code_challenge_method != "S256":
        raise HTTPException(400, "Only S256 PKCE is supported")
    if not _allowed_redirect(db, client_id, redirect_uri):
        raise HTTPException(400, "redirect_uri is not registered for this client")
    from app.core import guard
    guard.check_rate(f"oauth:{guard.client_ip(request)}", limit=15, window=900)
    cname = _client_name(db, client_id)

    # ---- step 1: password (and 2FA), then show the choose page. Never creates anything.
    if stage != "confirm":
        user = db.query(User).filter(User.email == email.lower().strip()).first()
        from app.core import supabase as sb
        if sb.enabled():
            sb_user = sb.password_grant(email.lower().strip(), password)
            if not sb_user:
                return _render(cname, params, "Wrong email or password.", email)
            if not user:
                user = User(company_id=None, email=email.lower().strip(), full_name=(sb_user.get("user_metadata") or {}).get("full_name") or email.split("@")[0], password_hash="", supabase_uid=sb_user["id"], role="owner")
                db.add(user); db.flush()
            elif not user.supabase_uid:
                user.supabase_uid = sb_user["id"]
            if user.company_id is None:
                return _render(cname, params, "Finish setting up your company in the Flaire dashboard first, then connect.", email)
        elif not user or not verify_password(password, user.password_hash):
            return _render(cname, params, "Wrong email or password.", email)
        from app.api.auth_extra import totp_ok
        if user.totp_enabled and not totp_ok(user, code):
            return _render(cname, params, "Enter the 6-digit code from your authenticator app.", email)
        if user.role not in ("owner", "finance"):
            return _render(cname, params, "Only owners and finance users can connect an AI employee.", email)
        db.commit()
        tk = _sign({"u": user.id, "c": client_id, "r": redirect_uri, "cc": code_challenge, "exp": int(time.time()) + 600})
        return _render_choose(cname, params, tk, _active_agents(db, user.company_id))

    # ---- step 2: the signed ticket proves the sign-in; the person must pick an employee or explicitly create one.
    data = _unsign(ticket)
    if not data or data.get("c") != client_id or data.get("r") != redirect_uri or data.get("cc") != code_challenge:
        return _render(cname, params, "That sign-in expired. Please sign in again.")
    user = db.get(User, data["u"])
    if not user or user.status == "disabled" or user.role not in ("owner", "finance") or not user.company_id:
        return _render(cname, params, "That sign-in is no longer valid. Please sign in again.")
    company = db.get(Company, user.company_id)
    agents = _active_agents(db, company.id)
    if not choice:
        return _render_choose(cname, params, ticket, agents, "Choose an AI employee, or create a new one.")
    if choice == "__new__":
        name = " ".join(new_name.split())[:60]
        if not name:
            return _render_choose(cname, params, ticket, agents, "Give the new AI employee a name.")
        dept = db.query(Department).filter(Department.company_id == company.id).order_by(Department.id).first()
        if not dept:
            dept = Department(company_id=company.id, name="General", monthly_budget=500_000)
            db.add(dept)
            db.flush()
        _, h, prefix = generate_agent_key()
        ag = Agent(company_id=company.id, department_id=dept.id, name=name, role="general", api_key_hash=h, key_prefix=prefix,
                   per_transaction_limit=100_000, monthly_limit=500_000, approval_threshold=50_000, allowed_categories=[], blocked_merchants=[])
        db.add(ag)
        db.flush()
        audit.record(db, company.id, actor_type="user", actor_id=user.id, actor_name=user.full_name, event="agent.created", details={"id": ag.id, "name": ag.name, "via": "oauth-connect", "confirmed": True})
    else:
        ag = next((a for a in agents if str(a.id) == choice), None)
        if not ag:
            return _render_choose(cname, params, ticket, agents, "That AI employee is not available.")

    oc = OAuthCode(code=secrets.token_urlsafe(32), client_id=client_id, redirect_uri=redirect_uri, code_challenge=code_challenge, scope=scope,
                   user_id=user.id, agent_id=ag.id, company_id=company.id, expires_at=utcnow() + timedelta(seconds=CODE_TTL_SECONDS))
    db.add(oc)
    audit.record(db, company.id, actor_type="user", actor_id=user.id, actor_name=user.full_name, event="connector.authorized", details={"agent_id": ag.id, "client": cname})
    db.commit()
    sep = "&" if "?" in redirect_uri else "?"
    return _render_done(ag, company, f"{redirect_uri}{sep}{urlencode({'code': oc.code, 'state': state})}")


# ---------------------------------------------------------------- token
def _token_error(err: str, desc: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": err, "error_description": desc}, status_code=status)


def _issue(db: Session, *, client_id: str, user_id: int, agent_id: int, company_id: int, scope: str) -> dict:
    access = "fat_" + secrets.token_urlsafe(32)
    refresh = "frt_" + secrets.token_urlsafe(32)
    tok = OAuthToken(access_hash=hash_api_key(access), refresh_hash=hash_api_key(refresh), client_id=client_id, user_id=user_id, agent_id=agent_id,
                     company_id=company_id, scope=scope, expires_at=utcnow() + timedelta(days=TOKEN_TTL_DAYS))
    db.add(tok)
    db.commit()
    return {"access_token": access, "token_type": "Bearer", "expires_in": TOKEN_TTL_DAYS * 86400, "refresh_token": refresh, "scope": scope}


@router.post("/oauth/token", tags=["oauth"], include_in_schema=False)
async def token(request: Request, db: Session = Depends(get_db)):
    form = dict(await request.form()) if "application/x-www-form-urlencoded" in request.headers.get("content-type", "") else (await request.json())
    grant = form.get("grant_type")
    if grant == "authorization_code":
        code = db.query(OAuthCode).filter(OAuthCode.code == str(form.get("code", ""))).first()
        if not code or code.used or code.expires_at.replace(tzinfo=code.expires_at.tzinfo or timezone.utc) < datetime.now(timezone.utc):
            return _token_error("invalid_grant", "Authorization code is invalid or expired")
        if form.get("client_id") and form.get("client_id") != code.client_id:
            return _token_error("invalid_client", "client_id mismatch", 401)
        if form.get("redirect_uri") and form.get("redirect_uri") != code.redirect_uri:
            return _token_error("invalid_grant", "redirect_uri mismatch")
        verifier = str(form.get("code_verifier", ""))
        expected = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        if not verifier or not secrets.compare_digest(expected, code.code_challenge):
            return _token_error("invalid_grant", "PKCE verification failed")
        code.used = True
        db.flush()
        return _issue(db, client_id=code.client_id, user_id=code.user_id, agent_id=code.agent_id, company_id=code.company_id, scope=code.scope)
    if grant == "refresh_token":
        old = db.query(OAuthToken).filter(OAuthToken.refresh_hash == hash_api_key(str(form.get("refresh_token", "")))).first()
        if not old or old.revoked:
            return _token_error("invalid_grant", "Refresh token is invalid")
        old.revoked = True
        db.flush()
        return _issue(db, client_id=old.client_id, user_id=old.user_id, agent_id=old.agent_id, company_id=old.company_id, scope=old.scope)
    return _token_error("unsupported_grant_type", "Use authorization_code or refresh_token")


@router.post("/oauth/revoke", tags=["oauth"], include_in_schema=False)
async def revoke(request: Request, db: Session = Depends(get_db)):
    form = dict(await request.form())
    h = hash_api_key(str(form.get("token", "")))
    tok = db.query(OAuthToken).filter((OAuthToken.access_hash == h) | (OAuthToken.refresh_hash == h)).first()
    if tok:
        tok.revoked = True
        db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- bearer resolution (used by the MCP endpoint)
def agent_from_bearer(db: Session, token: str) -> Agent | None:
    if not token.startswith("fat_"):
        return None
    tok = db.query(OAuthToken).filter(OAuthToken.access_hash == hash_api_key(token)).first()
    if not tok or tok.revoked or tok.expires_at.replace(tzinfo=tok.expires_at.tzinfo or timezone.utc) < datetime.now(timezone.utc):
        return None
    tok.last_used_at = utcnow()
    agent = db.get(Agent, tok.agent_id)
    if not agent or agent.api_key_hash == "revoked":
        return None
    return agent
