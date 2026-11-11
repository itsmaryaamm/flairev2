# Judge access

Live app: https://flaire-nine.vercel.app (sandbox only, free, no real money)

Test account (read and try everything): fill in before submitting
- Email: JUDGE_EMAIL
- Password: JUDGE_PASSWORD

Try this in two minutes
1. Open "AI workforce". The AI employee "Marketing AI" has a PayPal Sandbox card with a monthly limit.
2. Open Connections, press "Test PayPal connection".
3. Easiest: in AI workforce, open Marketing AI and use "Talk to Marketing AI". Type, for example, "Buy a Notion workspace for SAR 375". (The same requests can come from a ChatGPT or Claude connector, or the REST API: `POST /api/v1/agent/purchase-requests` with the employee's agent key.)
4. Under the limit: it is paid through PayPal and shows in Spending. Over the limit: it waits in Approvals.
5. A blocked supplier, such as "Gift card", is stopped and never reaches PayPal.

Over the approval threshold (SAR 500), approve it in Approvals with the account password. Flaire then sends you to PayPal's sandbox page. Any PayPal sandbox buyer login works there (create one free at developer.paypal.com under Sandbox accounts, or use the test buyer listed below).

The first load after a quiet period can take up to a minute while the free server wakes up.

Test PayPal buyer (sandbox only, for the approval step)
- Email: APPROVER_EMAIL
- Password: APPROVER_PASSWORD
