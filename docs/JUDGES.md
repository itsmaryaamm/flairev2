# Judge access

Live app: https://flaire-paypal.vercel.app (PayPal sandbox only, free, no real money)

Test login (use it to try everything):
- Email: judge@flaire.com
- Password: Judge@Paypal2026

The first load after a quiet period can take up to a minute while the free server wakes up. The app shows US dollars; Flaire stores amounts in SAR and converts at 3.75 (so $100 is exactly SAR 375).

## Try it in two minutes (no ChatGPT account needed)

1. Sign in, open **AI workforce**, open the AI employee, and press **Talk to** (the built in chat).
2. Type: `Buy a team workspace for $100 from Acme Design`. It is inside the limits, so Flaire pays it through the PayPal Payouts API. Open **Spending** to see the PayPal panel.
3. Type: `Buy a design license for $200 from Northwind Software`. It is above the approval limit, so it waits in **Approvals**. Approve it with the account password. Flaire then sends you to PayPal's sandbox page. Log in with any PayPal sandbox buyer (create one free at developer.paypal.com, Sandbox accounts, type Personal) and press Pay.
4. Type: `Buy an ad package for $320 from Blueline Media`. It is over the per purchase limit, so it is denied and PayPal is never called.
5. Try the **kill switch** on the Overview page: it freezes every AI employee at once.
6. **Connections**, then **Test PayPal connection** proves the sandbox keys work without moving money.

## Use your own ChatGPT or Claude (optional)

Add a custom connector with this address and choose OAuth: `https://flaire-api-cmrs.onrender.com/api/v1/mcp`. Sign in on the Flaire page with the test login above and pick the AI employee. This needs a ChatGPT plan with developer mode, or Claude with custom connectors. The built in chat above uses the same rules and the same PayPal flows.

## What is real and what is not

Payments run through the real PayPal sandbox (Payouts and Orders). In the sandbox every payout goes to one sandbox merchant account, so the supplier name on a request is recorded in Flaire but is not a real supplier. It demonstrates the payment flow. No real money moves.
