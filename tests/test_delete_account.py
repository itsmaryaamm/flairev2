"""Deleting a company must work on Postgres, which enforces foreign keys. SQLite is switched to enforce them here."""
import os

os.environ["DATABASE_URL"] = "sqlite:///./test_delete.db"
os.environ["AUTH_ENGINE"] = "native"
os.environ["ANTHROPIC_API_KEY"] = ""

from fastapi.testclient import TestClient
from sqlalchemy import event, text

from app.core.db import Base, SessionLocal, engine
from app.main import app


def test_delete_company_with_all_related_rows():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    @event.listens_for(engine, "connect")
    def _fk(conn, _):
        conn.execute("PRAGMA foreign_keys=ON")

    engine.dispose()
    c = TestClient(app)
    r = c.post("/api/v1/auth/register", json={"company_name": "DelCo", "email": "del@test.sa", "password": "password123", "full_name": "Del"})
    assert r.status_code == 201, r.text
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}
    dept = c.post("/api/v1/departments", json={"name": "Marketing", "monthly_budget": 500_000}, headers=H).json()
    c.post("/api/v1/agents", json={"name": "AI", "role": "marketing", "department_id": dept["id"], "per_transaction_limit": 100_000, "monthly_limit": 500_000,
                                   "approval_threshold": 50_000, "allowed_categories": ["software"], "blocked_merchants": [], "max_requests_per_hour": 10}, headers=H)
    # touch the tables the old delete missed
    c.post("/api/v1/team/invites", json={"email": "x@test.sa", "role": "viewer"}, headers=H)
    c.post("/api/v1/cost-centers", json={"name": "CC", "code": "1"}, headers=H)
    with SessionLocal() as db:
        n = db.execute(text("select count(*) from users")).scalar()
        assert n == 1
    d = c.request("DELETE", "/api/v1/account", json={"confirm": "DELETE", "password": "password123"}, headers=H)
    assert d.status_code == 200 and d.json()["removed"] == "company", d.text
    with SessionLocal() as db:
        assert db.execute(text("select count(*) from companies")).scalar() == 0
    event.remove(engine, "connect", _fk)
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("test_delete.db"):
        os.remove("test_delete.db")
