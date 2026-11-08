"""Flaire as an MCP connector: let anyone's Claude become an AI employee of a company.

Share a link like   https://<api>/api/v1/mcp/<agent_key>
The recipient adds it in Claude (Settings → Connectors → Add custom connector) or ChatGPT (custom connector). Their
assistant then has the Flaire tools: check_budget, request_purchase, get_purchase_status, list_my_requests, plus the
read-only search and fetch pair ChatGPT requires of every connector. It gets Flaire's decision on every purchase and
has no tool to approve, raise limits or touch cards. Every request is attributed to that agent key.

Transport: MCP Streamable HTTP, JSON responses (POST JSON-RPC in, JSON-RPC out). Stateless, so it works behind
Render/Vercel without sticky sessions. Protocol reference: https://modelcontextprotocol.io/specification
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.serializers import purchase_out
from app.core.db import get_db
from app.core.security import resolve_agent_key
from app.models import Agent, Company, Department, PurchaseRequest
from app.services import submit_purchase_request

import contextvars

router = APIRouter()
PROTOCOL_VERSION = "2025-06-18"
CURRENT_IP: contextvars.ContextVar[str] = contextvars.ContextVar("flaire_mcp_ip", default="unknown")

# Sent to the AI when the connector starts (MCP "instructions"). Kept short on purpose: hosts cut long text, and
# the tool descriptions below carry the detail. These are hints that make the AI likely to use Flaire, not a guarantee.
SERVER_INSTRUCTIONS = (
    "Flaire is this AI employee's company finance tool. Use it whenever a task involves spending company money: buying or "
    "renewing a subscription, software, ads, services or supplies. First call check_budget, then request_purchase with the "
    "real merchant, exact amount, currency and business purpose. Do not invent details, split purchases or relabel "
    "categories. Flaire decides: allowed, needs a human, or blocked. This is a SANDBOX: results are simulated and no "
    "real money moves. Never say a purchase was paid."
)

# Optional longer guide for advanced users (project instructions) and for the get_usage_guide tool. Never required.
AGENT_INSTRUCTIONS = (
    "You are connected to Flaire as a specific company AI employee. Use Flaire when a task requires company spending authorization, "
    "budget information or purchase history. Before submitting a purchase request, establish the merchant, exact amount, currency and "
    "business purpose; do not invent purchase details. Flaire determines whether spending is allowed, needs human approval, or is denied. "
    "Never bypass restrictions, split purchases to avoid limits, or misrepresent a merchant or category. A Flaire authorization is not proof of "
    "payment: in the sandbox every result is simulated and no real money moves. Respect your app's own confirmation prompts for tool use. "
    "You cannot approve purchases or change limits; a human does that in the Flaire dashboard."
)

_RO = {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False}

TOOLS = [
    {"name": "get_agent_context", "title": "Who am I in Flaire",
     "description": ("Shows which company and AI employee you are connected as, your sandbox spending permissions, and what the possible outcomes mean. "
                     "Use it when you are unsure whether you can spend company money, or at the start of a purchasing conversation. Read only."),
     "annotations": {**_RO, "title": "Who am I in Flaire"}, "inputSchema": {"type": "object", "properties": {}}},
    {"name": "check_budget", "title": "Check spending authority",
     "description": ("Use this BEFORE any purchase or subscription: it returns your remaining budget, per purchase limit, the amount above which a human must approve, "
                     "allowed categories and the company's trusted suppliers. Read only and instant. Call it whenever a task involves spending company money, "
                     "or when the user asks how much you can spend."),
     "annotations": {**_RO, "title": "Check spending authority"}, "inputSchema": {"type": "object", "properties": {}}},
    {"name": "request_purchase", "title": "Request a purchase",
     "description": ("Ask Flaire to authorize a purchase on behalf of the company, for example a software subscription, ads, a service or supplies. "
                     "Only call it once you know the real merchant, the exact amount, the currency and the business purpose; ask the user for anything missing, "
                     "and call check_budget first. Do not split a purchase, relabel a category or retry a held request. "
                     "Flaire answers with an outcome: simulated_authorization (allowed within your limits), pending_approval (a human must approve in the Flaire dashboard; tell the user and do not retry), "
                     "denied (read the reasons and offer a compliant alternative) or failed. This is a sandbox: every outcome is simulated and no real money moves. "
                     "Never tell the user a purchase was paid."),
     "annotations": {"title": "Request a purchase", "readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False},
     "inputSchema": {"type": "object", "required": ["amount", "merchant", "category", "description"],
                     "properties": {"amount": {"type": "number", "description": "The exact amount to spend, in the given currency, e.g. 49 for a 49 dollar plan"},
                                    "currency": {"type": "string", "enum": ["SAR", "USD"], "default": "SAR", "description": "Currency of amount. USD is converted to SAR at 3.75."},
                                    "amount_sar": {"type": "number", "description": "Deprecated. Use amount with currency SAR."},
                                    "merchant": {"type": "string", "description": "The real company being paid, e.g. Buffer or Google Ads. Never invent one."},
                                    "category": {"type": "string", "description": "advertising, software, equipment, services, travel, logistics, utilities, office or other"},
                                    "description": {"type": "string", "description": "One line: the business purpose of the purchase"}}}},
    {"name": "get_purchase_status", "title": "Check a purchase request",
     "description": "Current outcome and reasons for one of your purchase requests, for example to see whether a human has approved a pending request. Read only.",
     "annotations": {**_RO, "title": "Check a purchase request"},
     "inputSchema": {"type": "object", "required": ["request_id"], "properties": {"request_id": {"type": "integer", "description": "The request_id returned by request_purchase"}}}},
    {"name": "list_my_requests", "title": "List my purchase requests",
     "description": "Your recent purchase requests with outcome, amount and reasons. Use it before buying something that may already have been requested, and to report spending. Read only.",
     "annotations": {**_RO, "title": "List my purchase requests"},
     "inputSchema": {"type": "object", "properties": {"limit": {"type": "integer", "default": 10, "description": "How many to return, up to 50"}}}},
    {"name": "get_usage_guide", "title": "Flaire usage guide",
     "description": "Optional. Returns the full guidance for using Flaire correctly, including what each outcome means. Read only.",
     "annotations": {**_RO, "title": "Flaire usage guide"}, "inputSchema": {"type": "object", "properties": {}}},
    # ChatGPT connector requirements: a read-only search/fetch pair over this employee's own requests.
    {"name": "search", "title": "Search my purchase requests",
     "description": "Search this AI employee's purchase requests by merchant, category, description, status or request id. Read only. Returns results with id, title and url; use fetch for the full record.",
     "annotations": {**_RO, "title": "Search my purchase requests"},
     "inputSchema": {"type": "object", "required": ["query"], "properties": {"query": {"type": "string", "description": "Free text, for example 'Google Ads', 'pending' or '42'"}}}},
    {"name": "fetch", "title": "Fetch a purchase request",
     "description": "Fetch the full record of one purchase request by id (from search or list_my_requests). Read only.",
     "annotations": {**_RO, "title": "Fetch a purchase request"},
     "inputSchema": {"type": "object", "required": ["id"], "properties": {"id": {"type": "string", "description": "The request id"}}}},
]

USD_TO_SAR = 3.75

# What the AI is told for each internal status. Nothing here ever says "paid": the sandbox moves no real money.
OUTCOMES = {
    "completed": ("simulated_authorization", "Simulated authorization", "Allowed within your limits. This is a sandbox: the payment is simulated and no real money moved. Do not describe it as a completed payment."),
    "settled": ("simulated_authorization", "Simulated authorization", "Allowed within your limits. This is a sandbox: the payment is simulated and no real money moved. Do not describe it as a completed payment."),
    "approved": ("simulated_authorization", "Approved, simulated", "Approved. Payment is simulated in the sandbox and no real money moved."),
    "pending_approval": ("pending_approval", "Pending approval", "A human must approve this in the Flaire dashboard. Do not retry. Tell the user it is pending."),
    "denied": ("denied", "Blocked", "Flaire blocked this request. Read the reasons and offer a compliant alternative or report back."),
    "rejected": ("denied", "Declined by a person", "A person declined this request. Do not retry."),
    "failed": ("failed", "Failed", "The simulated payment failed. Report the payment_error."),
}


def _request_url(pr: PurchaseRequest) -> str:
    from app.core.config import get_settings
    return f"{get_settings().dashboard_url.rstrip('/')}/?request={pr.id}"


def _search(db: Session, agent: Agent, query: str) -> dict:
    q = (query or "").strip().lower()
    rows = db.query(PurchaseRequest).filter(PurchaseRequest.agent_id == agent.id).order_by(PurchaseRequest.id.desc()).limit(200).all()
    terms = [t for t in q.replace("#", " ").split() if t]
    def hits(pr: PurchaseRequest) -> bool:
        if not terms:
            return True
        hay = f"{pr.id} {pr.merchant} {pr.category} {pr.description or ''} {pr.status} {' '.join((pr.decision or {}).get('reasons', []))}".lower()
        return all(t in hay for t in terms)
    found = [pr for pr in rows if hits(pr)][:20]
    return {"results": [{"id": str(pr.id), "title": f"#{pr.id} {pr.merchant} SAR {pr.amount / 100:,.2f} ({pr.status})", "url": _request_url(pr)} for pr in found]}


def _fetch(db: Session, agent: Agent, id_: str) -> dict | None:
    try:
        pr = db.get(PurchaseRequest, int(str(id_).lstrip("#")))
    except (TypeError, ValueError):
        return None
    if not pr or pr.agent_id != agent.id:
        return None
    view = _pr_view(pr)
    text = (f"Request #{pr.id}: {pr.merchant}, SAR {pr.amount / 100:,.2f}, category {pr.category}, status {pr.status}. "
            f"Reason: {pr.description or '(none)'}. Decision: {'; '.join(view['reasons']) or 'none'}.")
    return {"id": str(pr.id), "title": f"#{pr.id} {pr.merchant} SAR {pr.amount / 100:,.2f} ({pr.status})", "text": text, "url": _request_url(pr), "metadata": view}


def _rpc_result(id_: Any, result: Any) -> dict:
    return {"jsonrpc": "2.0", "id": id_, "result": result}


def _rpc_error(id_: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": id_, "error": {"code": code, "message": message}}


def _text(payload: Any, is_error: bool = False) -> dict:
    return {"content": [{"type": "text", "text": json.dumps(payload, indent=2, default=str)}], "isError": is_error}


def _budget(db: Session, agent: Agent) -> dict:
    dept = db.get(Department, agent.department_id)
    company = db.get(Company, agent.company_id)
    return {"company": company.name, "agent": agent.name, "role": agent.role, "status": agent.status, "currency": "SAR",
            "per_transaction_limit_sar": agent.per_transaction_limit / 100, "monthly_limit_sar": agent.monthly_limit / 100,
            "spent_this_month_sar": agent.spent_this_period / 100, "needs_human_approval_at_or_above_sar": agent.approval_threshold / 100,
            "allowed_categories": agent.allowed_categories or "any", "blocked_merchants": agent.blocked_merchants,
            "department": dept.name, "department_remaining_sar": dept.remaining / 100,
            "trusted_suppliers": list(company.trusted_merchants or []), "new_supplier_review_from_sar": company.new_merchant_review_from / 100,
            "policy": "Trusted suppliers pay within limits. The first payment to a new supplier at or above the review amount waits for a human. Never split purchases or relabel categories.",
            "kill_switch_on": company.kill_switch}


def _pr_view(pr: PurchaseRequest) -> dict:
    out = purchase_out(pr).model_dump()
    outcome, label, message = OUTCOMES.get(out["status"], (out["status"], out["status"].replace("_", " ").capitalize(), ""))
    return {"request_id": out["id"], "status": outcome, "outcome": label, "simulated": True, "payment_mode": "sandbox_simulated", "message": message, "internal_status": out["status"], "verdict": out["decision"].get("verdict"), "reasons": out["decision"].get("reasons", []), "flags": out.get("flags", []),
            "payment_error": out["decision"].get("payment_error"), "amount_sar": out["amount"] / 100, "merchant": out["merchant"],
            "category": out["category"], "created_at": out["created_at"], "approved_by": (out["approved_by"] or {}).get("full_name")}


def _call_tool(db: Session, agent: Agent, name: str, args: dict) -> dict:
    if name == "check_budget":
        return _text(_budget(db, agent))
    if name == "request_purchase":
        try:
            raw = args["amount"] if args.get("amount") is not None else args["amount_sar"]
            currency = str(args.get("currency") or "SAR").upper()
            if currency not in ("SAR", "USD"):
                return _text({"error": "currency must be SAR or USD"}, True)
            amount = int(round(float(raw) * (USD_TO_SAR if currency == "USD" else 1.0) * 100))
        except (KeyError, TypeError, ValueError):
            return _text({"error": "amount must be a number"}, True)
        if amount <= 0:
            return _text({"error": "amount must be greater than zero"}, True)
        from app.schemas import MAX_PURCHASE_HALALAS
        if amount > MAX_PURCHASE_HALALAS:
            return _text({"error": f"amount_sar must be at most {MAX_PURCHASE_HALALAS // 100:,}"}, True)
        company = db.get(Company, agent.company_id)
        pr = submit_purchase_request(db, company, agent, amount=amount, merchant=(str(args.get("merchant") or "").strip() or "Unknown")[:200],
                                     category=str(args.get("category") or "other")[:60], description=str(args.get("description") or "")[:2000], card_id=None,
                                     source="mcp", client_ip=CURRENT_IP.get())
        view = _pr_view(pr)
        if currency == "USD":
            view["requested"] = f"USD {float(raw):,.2f} converted to SAR {amount / 100:,.2f} at {USD_TO_SAR}"
        view["what_to_do"] = view["message"]
        return _text(view, is_error=pr.status in ("denied", "failed"))
    if name == "get_agent_context":
        b = _budget(db, agent)
        return _text({"connected_as": b["agent"], "company": b["company"], "role": b["role"], "mode": "sandbox",
                      "sandbox_notice": "Every purchase here is simulated. No real money moves.",
                      "permissions": {"per_purchase_limit_sar": b["per_transaction_limit_sar"], "monthly_limit_sar": b["monthly_limit_sar"],
                                      "spent_this_month_sar": b["spent_this_month_sar"], "human_approval_at_or_above_sar": b["needs_human_approval_at_or_above_sar"],
                                      "allowed_categories": b["allowed_categories"]},
                      "outcomes": {"simulated_authorization": "Allowed within your limits (simulated, not paid)", "pending_approval": "A human must approve in the Flaire dashboard",
                                   "denied": "Blocked by company rules; read the reasons", "failed": "The simulated payment failed"},
                      "next_step": "Call check_budget before any purchase."})
    if name == "get_usage_guide":
        return _text({"guide": AGENT_INSTRUCTIONS})
    if name == "get_purchase_status":
        pr = db.get(PurchaseRequest, int(args.get("request_id", 0)))
        if not pr or pr.agent_id != agent.id:
            return _text({"error": "Request not found"}, True)
        return _text(_pr_view(pr))
    if name == "list_my_requests":
        limit = max(1, min(int(args.get("limit", 10)), 50))
        rows = db.query(PurchaseRequest).filter(PurchaseRequest.agent_id == agent.id).order_by(PurchaseRequest.id.desc()).limit(limit).all()
        return _text([_pr_view(p) for p in rows])
    if name == "search":
        return _text(_search(db, agent, str(args.get("query") or "")))
    if name == "fetch":
        doc = _fetch(db, agent, args.get("id", ""))
        if doc is None:
            return _text({"error": "Request not found"}, True)
        return _text(doc)
    return _text({"error": f"Unknown tool {name}"}, True)


def _handle(db: Session, agent: Agent, msg: dict) -> dict | None:
    method, id_, params = msg.get("method"), msg.get("id"), msg.get("params") or {}
    if method == "initialize":
        company = db.get(Company, agent.company_id)
        return _rpc_result(id_, {"protocolVersion": params.get("protocolVersion") or PROTOCOL_VERSION, "capabilities": {"tools": {"listChanged": False}},
                                 "serverInfo": {"name": "flaire", "title": f"Flaire · {company.name}", "version": "0.4.0"},
                                 "instructions": f"You are '{agent.name}', an AI employee of {company.name}. " + SERVER_INSTRUCTIONS})
    if method in ("notifications/initialized", "notifications/cancelled"):
        return None
    if method == "ping":
        return _rpc_result(id_, {})
    if method == "tools/list":
        return _rpc_result(id_, {"tools": TOOLS})
    if method == "tools/call":
        try:
            from app.models import utcnow
            agent.last_active_at = utcnow()  # any connector call counts as "connected" for onboarding
            out = _call_tool(db, agent, params.get("name", ""), params.get("arguments") or {})
            db.commit()
            return _rpc_result(id_, out)
        except Exception as exc:  # fail closed, but keep the session alive
            return _rpc_result(id_, _text({"error": str(exc)}, True))
    if method in ("resources/list", "prompts/list"):
        return _rpc_result(id_, {"resources": [], "prompts": []})
    if id_ is None:
        return None
    return _rpc_error(id_, -32601, f"Method not found: {method}")


def _agent_from_key(db: Session, key: str, request: Request) -> tuple[Agent | None, str, int]:
    """Returns (agent, error_message, http_status). Lockout, expiry and rate limits come from resolve_agent_key."""
    try:
        return resolve_agent_key(db, key, request), "", 200
    except HTTPException as exc:
        return None, str(exc.detail), exc.status_code


def _www_auth(request: Request) -> dict:
    from app.api.oauth import base_url
    return {"WWW-Authenticate": f'Bearer resource_metadata="{base_url(request)}/.well-known/oauth-protected-resource/api/v1/mcp"'}


def _agent_from_bearer(db: Session, request: Request) -> tuple[Agent | None, str, int]:
    from app.api.oauth import agent_from_bearer
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None, "Sign in required", 401
    token = auth.split(" ", 1)[1].strip()
    if token.startswith("flk_"):  # raw agent key also accepted as a bearer
        return _agent_from_key(db, token, request)
    from app.core import guard
    ip = guard.client_ip(request)
    guard.check_ip_locked(ip)
    agent = agent_from_bearer(db, token)
    if not agent:
        guard.record_bad_key(ip)
        return None, "Token is invalid, expired or revoked. Reconnect Flaire in Claude.", 401
    try:
        guard.check_rate(f"agent:{agent.id}")
    except HTTPException as exc:
        return None, str(exc.detail), exc.status_code
    db.commit()
    return agent, "", 200


async def _serve(agent: Agent, request: Request, db: Session):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(_rpc_error(None, -32700, "Parse error"), status_code=400)
    from app.core.guard import client_ip
    CURRENT_IP.set(client_ip(request))
    messages = body if isinstance(body, list) else [body]
    responses = [r for r in (_handle(db, agent, m) for m in messages if isinstance(m, dict)) if r is not None]
    if not responses:
        return Response(status_code=202)
    return JSONResponse(responses[0] if not isinstance(body, list) else responses)


@router.post("/mcp", tags=["mcp"], include_in_schema=False)
async def mcp_post_bearer(request: Request, db: Session = Depends(get_db)):
    """The connector everyone uses: one URL, sign in with your Flaire account."""
    agent, err, code = _agent_from_bearer(db, request)
    if not agent:
        return JSONResponse(_rpc_error(None, -32001, err), status_code=code, headers=_www_auth(request) if code == 401 else None)
    return await _serve(agent, request, db)


@router.get("/mcp", tags=["mcp"], include_in_schema=False)
async def mcp_get_bearer(request: Request, db: Session = Depends(get_db)):
    agent, err, code = _agent_from_bearer(db, request)
    if not agent:
        return JSONResponse({"name": "flaire", "message": "Add this URL as a custom connector in Claude and choose Sign in. You will log in with your Flaire account."},
                            status_code=401, headers=_www_auth(request))
    company = db.get(Company, agent.company_id)
    return {"ok": True, "name": "flaire", "company": company.name, "agent": agent.name}


@router.delete("/mcp", include_in_schema=False)
async def mcp_delete_bearer():
    return Response(status_code=204)


@router.post("/mcp/{agent_key}", tags=["mcp"], include_in_schema=False)
async def mcp_post(agent_key: str, request: Request, db: Session = Depends(get_db)):
    agent, err, code = _agent_from_key(db, agent_key, request)
    if not agent:
        return JSONResponse(_rpc_error(None, -32001, err), status_code=code)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(_rpc_error(None, -32700, "Parse error"), status_code=400)
    from app.core.guard import client_ip
    CURRENT_IP.set(client_ip(request))
    messages = body if isinstance(body, list) else [body]
    responses = [r for r in (_handle(db, agent, m) for m in messages if isinstance(m, dict)) if r is not None]
    if not responses:
        return Response(status_code=202)
    return JSONResponse(responses[0] if not isinstance(body, list) else responses)


@router.get("/mcp/{agent_key}", tags=["mcp"], include_in_schema=False)
async def mcp_get(agent_key: str, request: Request, db: Session = Depends(get_db)):
    # Server-initiated streams are not used; clients that probe GET get a friendly answer.
    agent, err, code = _agent_from_key(db, agent_key, request)
    if not agent:
        return JSONResponse({"detail": err}, status_code=code)
    company = db.get(Company, agent.company_id)
    return JSONResponse({"ok": True, "name": "flaire", "company": company.name, "agent": agent.name,
                         "message": "This link works. Add it in Claude: Settings, Connectors, Add custom connector."})


@router.delete("/mcp/{agent_key}", include_in_schema=False)
async def mcp_delete(agent_key: str):
    return Response(status_code=204)
