"""Keeps Flaire's ledger in step with PayPal.

A PayPal payout is accepted first and clears afterwards, so a new transaction starts as "authorized" and moves to
"settled" when PayPal says SUCCESS, or to "reversed" (budget and card balance given back) if PayPal fails, returns or
blocks it. PayPal is always asked directly (GET /v1/payments/payouts/{id}); a webhook body is never trusted on its own.
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core import audit
from app.integrations.payments.paypal import PayPalAdapter
from app.models import Agent, Card, Department, PurchaseRequest, Transaction

log = logging.getLogger("flaire.paypal")


def batch_id_of(tx: Transaction) -> str:
    return tx.provider_ref.removeprefix("paypal_")


def sync_transaction(db: Session, tx: Transaction, actor: str = "paypal-sync") -> str:
    """Pull the payout's state from PayPal and apply it. Returns the transaction's status afterwards. Never raises."""
    if tx.provider != "paypal" or tx.status not in ("authorized",):
        return tx.status
    try:
        new, detail = PayPalAdapter().payout_state(batch_id_of(tx))
    except Exception as exc:
        log.warning("paypal sync failed for tx %s: %s", tx.id, str(exc)[:160])
        return tx.status
    if new == tx.status:
        return tx.status
    old = tx.status
    tx.status = new
    if new == "reversed":
        card = db.get(Card, tx.card_id)
        if card:
            card.available_balance += tx.amount
        pr = db.get(PurchaseRequest, tx.purchase_request_id)
        if pr:
            pr.status = "failed"
            dept = db.get(Department, pr.department_id)
            agent = db.get(Agent, pr.agent_id)
            if dept:
                dept.spent_this_period = max(0, dept.spent_this_period - tx.amount)
            if agent:
                agent.spent_this_period = max(0, agent.spent_this_period - tx.amount)
        tx.fee = 0
        tx.decline_reason = detail[:300]
    audit.record(db, tx.company_id, actor_type="system", actor_id=None, actor_name=actor,
                 event="payment.settled" if new == "settled" else "payment.reversed",
                 details={"transaction_id": tx.id, "from": old, "to": new, "detail": detail, "provider_ref": tx.provider_ref})
    db.commit()
    return new


def sync_pending(db: Session, company_id: int, limit: int = 5) -> int:
    """Called when the dashboard reads transactions, so a payout that cleared shows as settled without any manual step."""
    rows = db.query(Transaction).filter(Transaction.company_id == company_id, Transaction.provider == "paypal", Transaction.status == "authorized") \
        .order_by(Transaction.id.desc()).limit(limit).all()
    return sum(1 for t in rows if sync_transaction(db, t) != "authorized")
