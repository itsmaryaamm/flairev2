"""PayPal sandbox adapter (PayPal + AI hackathon build).

Flaire decides first (limits, categories, approvals, fraud checks). Only an approved purchase reaches this adapter,
and the adapter then moves simulated money through the PayPal Payouts API in the PayPal SANDBOX. Nothing here can
touch real money: the base URL is the sandbox host and the receiver is a sandbox account.

Flaire amounts are SAR halalas. PayPal does not support SAR, so every call is converted to USD at FX_SAR_USD
(default 3.75) and the converted amount, currency and rate are recorded on the Transaction.

Needs PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_RECEIVER_EMAIL (a sandbox Personal account email).
Without them every call declines with a clear reason, so the rest of Flaire keeps working.

Endpoints used (https://developer.paypal.com/docs/api/payments.payouts-batch/v1/):
  POST /v1/oauth2/token             client-credentials access token
  POST /v1/payments/payouts         send the approved amount to the merchant (sandbox receiver)
  GET  /v1/payments/payouts/{id}    read the batch status
"""
from __future__ import annotations

import secrets
import time
import uuid

import httpx

from app.core.config import get_settings
from app.integrations.payments.base import PaymentResult
from app.models import Card

_token: dict = {"value": None, "exp": 0.0}


class PayPalAdapter:
    provider = "paypal"

    def __init__(self) -> None:
        self.settings = get_settings()
        self.enabled = self.settings.paypal_enabled
        self.base = self.settings.paypal_base_url.rstrip("/")
        self.fx_rate = float(self.settings.fx_sar_usd or 3.75)

    # ---- helpers
    def to_usd_cents(self, halalas: int) -> int:
        """SAR halalas to USD cents. Never below 1 cent for a positive amount."""
        return max(1, round(halalas / self.fx_rate)) if halalas > 0 else 0

    def _access_token(self) -> str:
        if _token["value"] and _token["exp"] > time.time() + 30:
            return _token["value"]
        r = httpx.post(f"{self.base}/v1/oauth2/token", data={"grant_type": "client_credentials"},
                       auth=(self.settings.paypal_client_id, self.settings.paypal_client_secret), headers={"Accept": "application/json"}, timeout=20)
        if r.status_code != 200:
            raise RuntimeError(f"PayPal sign-in failed ({r.status_code}). Check the sandbox client ID and secret.")
        data = r.json()
        _token["value"] = data["access_token"]
        _token["exp"] = time.time() + int(data.get("expires_in", 300))
        return _token["value"]

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._access_token()}", "Content-Type": "application/json"}

    # ---- adapter interface
    def create_card(self, label: str, credit_limit: int, currency: str) -> dict:
        """A PayPal-funded virtual card: a Flaire spending envelope. No PayPal call is needed until a purchase is approved."""
        return {"last4": f"{secrets.randbelow(10_000):04d}", "provider_token": f"paypal_wallet_{secrets.token_hex(6)}", "available_balance": credit_limit}

    def authorize(self, card: Card, amount: int, merchant: str, descriptor: str) -> PaymentResult:
        ref = f"paypal_{secrets.token_hex(6)}"
        if card.status != "active":
            return PaymentResult(False, "declined", ref, f"Card is {card.status}")
        if card.currency != "SAR":
            return PaymentResult(False, "declined", ref, "Currency mismatch")
        if amount > card.available_balance:
            return PaymentResult(False, "declined", ref, f"Insufficient funds (available SAR {card.available_balance / 100:,.2f})")
        if not self.enabled or not self.settings.paypal_receiver_email:
            return PaymentResult(False, "declined", ref, "PayPal sandbox is not configured (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_RECEIVER_EMAIL)")
        cents = self.to_usd_cents(amount)
        batch_id = f"flaire-{uuid.uuid4().hex[:20]}"  # PayPal rejects a repeated sender_batch_id, so a retry cannot pay twice
        body = {
            "sender_batch_header": {"sender_batch_id": batch_id, "email_subject": f"Flaire sandbox payment to {merchant}"[:120],
                                    "email_message": "Approved by Flaire. Sandbox payment, no real money."},
            "items": [{"recipient_type": "EMAIL", "receiver": self.settings.paypal_receiver_email,
                       "amount": {"value": f"{cents / 100:.2f}", "currency": "USD"},
                       "note": f"{descriptor}"[:160], "sender_item_id": batch_id}],
        }
        try:
            r = httpx.post(f"{self.base}/v1/payments/payouts", json=body, headers={**self._headers(), "PayPal-Request-Id": batch_id}, timeout=30)
        except Exception as exc:
            return PaymentResult(False, "declined", ref, f"PayPal could not be reached: {str(exc)[:120]}")
        if r.status_code not in (200, 201):
            try:
                err = r.json()
                reason = err.get("message") or err.get("name") or r.text[:160]
            except Exception:
                reason = r.text[:160]
            return PaymentResult(False, "declined", ref, f"PayPal declined: {reason}"[:240], raw={"status_code": r.status_code})
        head = r.json().get("batch_header", {})
        paypal_id = head.get("payout_batch_id") or batch_id
        card.available_balance -= amount
        status = "settled" if head.get("batch_status") == "SUCCESS" else "authorized"  # PayPal clears payouts asynchronously
        return PaymentResult(True, status, f"paypal_{paypal_id}", raw={"payout_batch_id": paypal_id, "batch_status": head.get("batch_status"), "merchant": merchant,
                                                                          "usd": f"{cents / 100:.2f}", "sandbox": True},
                             issuer_amount=cents, issuer_currency="USD", fx_rate=self.fx_rate)

    def settle(self, card: Card, provider_ref: str, amount: int) -> PaymentResult:
        # PayPal payouts settle only when PayPal says so (see app/paypal_sync.py); this never claims success itself.
        return PaymentResult(False, "pending", provider_ref, decline_reason="Waiting for PayPal to confirm", issuer_amount=self.to_usd_cents(amount), issuer_currency="USD", fx_rate=self.fx_rate)

    def balance(self, card: Card) -> int:
        return card.available_balance

    def create_order(self, halalas: int, merchant: str, request_id: int, descriptor: str) -> dict:
        """PayPal Orders v2: a CAPTURE order for the approved amount. The merchant (sandbox receiver) is the payee; the approver is the payer."""
        cents = self.to_usd_cents(halalas)
        body = {"intent": "CAPTURE",
                "purchase_units": [{"reference_id": f"flaire-{request_id}", "description": descriptor[:127],
                                    "amount": {"currency_code": "USD", "value": f"{cents / 100:.2f}"},
                                    **({"payee": {"email_address": self.settings.paypal_receiver_email}} if self.settings.paypal_receiver_email else {})}],
                "payment_source": {"paypal": {"experience_context": {
                    "brand_name": "Flaire", "user_action": "PAY_NOW", "shipping_preference": "NO_SHIPPING",
                    "return_url": f"{self.settings.frontend_url.rstrip('/')}/paypal/return", "cancel_url": f"{self.settings.frontend_url.rstrip('/')}/paypal/return?cancelled=1"}}}}
        r = httpx.post(f"{self.base}/v2/checkout/orders", json=body, headers={**self._headers(), "PayPal-Request-Id": f"flaire-order-{request_id}-{uuid.uuid4().hex[:8]}"}, timeout=30)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"{r.status_code} {r.text[:160]}")
        data = r.json()
        link = next((l["href"] for l in data.get("links", []) if l.get("rel") in ("payer-action", "approve")), None)
        if not link:
            raise RuntimeError("PayPal did not return an approval link")
        return {"id": data["id"], "approve_url": link, "usd": f"{cents / 100:.2f}", "status": data.get("status")}

    def capture_order(self, order_id: str) -> dict:
        r = httpx.post(f"{self.base}/v2/checkout/orders/{order_id}/capture", json={}, headers={**self._headers(), "PayPal-Request-Id": f"flaire-capture-{order_id}"}, timeout=30)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"{r.status_code} {r.text[:160]}")
        data = r.json()
        cap = (((data.get("purchase_units") or [{}])[0].get("payments") or {}).get("captures") or [{}])[0]
        status = str(cap.get("status") or data.get("status") or "").upper()
        usd = float((cap.get("amount") or {}).get("value", 0) or 0)
        return {"status": "COMPLETED" if status == "COMPLETED" else status, "capture_id": cap.get("id") or order_id, "usd_cents": round(usd * 100)}

    def payout_state(self, payout_batch_id: str) -> tuple[str, str]:
        """Ask PayPal where a payout stands. Returns (flaire_status, detail): settled | authorized (still moving) | reversed (failed, returned or blocked)."""
        data = self.batch_status(payout_batch_id)
        batch = str(data.get("batch_header", {}).get("batch_status", "")).upper()
        items = [str(i.get("transaction_status", "")).upper() for i in data.get("items", [])]
        bad = {"FAILED", "BLOCKED", "RETURNED", "REFUNDED", "REVERSED", "DENIED"}  # PENDING, ON_HOLD and UNCLAIMED stay "authorized" (still moving)
        if batch in ("DENIED", "CANCELED") or any(i in bad for i in items):
            return "reversed", f"PayPal {', '.join(items) or batch}"
        if batch == "SUCCESS" and items and all(i == "SUCCESS" for i in items):
            return "settled", "PayPal SUCCESS"
        return "authorized", f"PayPal {', '.join(items) or batch or 'PENDING'}"

    def check_connection(self) -> dict:
        """Used by Settings: proves the sandbox keys work without moving money."""
        if not self.enabled:
            return {"ok": False, "message": "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set on the server."}
        try:
            r = httpx.post(f"{self.base}/v1/oauth2/token", data={"grant_type": "client_credentials"},
                           auth=(self.settings.paypal_client_id, self.settings.paypal_client_secret), headers={"Accept": "application/json"}, timeout=20)
        except Exception as exc:
            return {"ok": False, "message": f"PayPal could not be reached: {str(exc)[:120]}"}
        if r.status_code != 200:
            return {"ok": False, "message": f"PayPal rejected the keys ({r.status_code}). Use the Client ID and Secret of a SANDBOX app, not a Live one."}
        scope = str(r.json().get("scope", ""))
        return {"ok": True, "message": "Connected to the PayPal sandbox.", "sandbox": "sandbox" in self.base,
                "payouts_enabled": "payouts" in scope.lower() or None, "receiver_set": bool(self.settings.paypal_receiver_email),
                "receiver": self.settings.paypal_receiver_email}

    def verify_webhook(self, headers: dict[str, str], event: dict) -> bool:
        """PayPal's own signature check (needs PAYPAL_WEBHOOK_ID)."""
        wid = self.settings.paypal_webhook_id
        if not wid:
            return False
        body = {"auth_algo": headers.get("paypal-auth-algo"), "cert_url": headers.get("paypal-cert-url"), "transmission_id": headers.get("paypal-transmission-id"),
                "transmission_sig": headers.get("paypal-transmission-sig"), "transmission_time": headers.get("paypal-transmission-time"), "webhook_id": wid, "webhook_event": event}
        try:
            r = httpx.post(f"{self.base}/v1/notifications/verify-webhook-signature", json=body, headers=self._headers(), timeout=20)
            return r.status_code == 200 and r.json().get("verification_status") == "SUCCESS"
        except Exception:
            return False

    def batch_status(self, payout_batch_id: str) -> dict:
        r = httpx.get(f"{self.base}/v1/payments/payouts/{payout_batch_id}", headers=self._headers(), timeout=20)
        r.raise_for_status()
        return r.json()
