# Devpost text (paste into the submission form)

## Tagline
The finance department for AI employees. Flaire lets AI agents spend, inside rules a human sets, and pays through PayPal.

## Inspiration
AI agents can now buy things: software seats, ads, tools. Companies handle that by handing the agent a card and hoping. There is no budget per agent, no approval, no audit trail and no off switch. We wanted the missing finance layer.

## What it does
Each AI employee gets a monthly budget, a per purchase limit, an approval threshold and trusted merchants. When an agent in ChatGPT, Claude or any MCP client asks to buy something, Flaire decides first:
- Inside the rules: Flaire pays the merchant through the PayPal Payouts API (SAR converted to USD).
- Above the threshold: it waits for a person. The person approves in Flaire with their password, then confirms again in PayPal through PayPal Orders. The AI can never approve its own spending.
- Outside the rules (over the limit, blocked category, kill switch on): denied, and PayPal is never called.
Every decision is signed, audited and visible in Spending and Approvals.

## How we built it with PayPal
- PayPal Payouts API for approved purchases, with idempotency keys and unique batch ids.
- PayPal Orders v2 for the second, human approval step (approver logs in to PayPal).
- Payout lifecycle sync and PayPal webhooks. Webhooks are never trusted on their own: Flaire re-fetches the state from PayPal before changing anything.
- Automatic budget refund when PayPal returns, holds or fails a payout.
- PayPal sandbox only. No real money moves.

## How we use AI
- The AI employees are real agents in ChatGPT and Claude, connected to Flaire through MCP and a REST API.
- Gemini powers the in app assistant and the employee chat, behind a topic guard, with a static FAQ fallback.
- The code was written with Claude Code and reviewed by us.

## Challenges
Making money movement safe by default: replay protection on receipts, row locks so two agents cannot spend the same budget, and treating every asynchronous PayPal state (pending, on hold, returned) honestly instead of marking a purchase paid too early.

## Accomplishments
A complete loop that works today: ask, decide, approve, pay, reconcile, with real PayPal sandbox payments.

## What we learned
PayPal has no payouts tool in its agent toolkit, so we went straight to the REST API. The hard part of agentic commerce is not paying, it is deciding whether the agent should.

## What is next
Live PayPal accounts, PayPal's agentic commerce services, and per merchant policies by team.

## What is new since Oct 1 (existing project)
Flaire existed as a simulated card product. During the hackathon we added the whole PayPal rail: Payouts, Orders approval, webhooks, lifecycle sync, refunds, the PayPal settings and approval screens, tests (113 passing), and judge documentation.

## Built with
PayPal Payouts API, PayPal Orders v2, FastAPI, SQLAlchemy, PostgreSQL, React, Vite, Tailwind, Gemini, MCP, ChatGPT, Claude, Render (API and database), Vercel (web app).

## Prize categories to mention
Best Use of Agentic Commerce, Best Use of PayPal + AI, Best Use of Render, Most Impactful, Best Demo Delivery.

## Links
- Repo: https://github.com/itsmaryaamm/flaire-paypal
- Live demo: https://flaire-nine.vercel.app
- Judge access: docs/JUDGES.md in the repo
