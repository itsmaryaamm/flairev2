# Judge access

Live app: https://flaire-nine.vercel.app (sandbox only, free, no real money)

Test account (read and try everything): fill in before submitting
- Email: JUDGE_EMAIL
- Password: JUDGE_PASSWORD

Try this in two minutes
1. Open "AI workforce". The AI employee "Marketing AI" has a PayPal Sandbox card with a monthly limit.
2. Open Connections, press "Test PayPal connection".
3. Use the ChatGPT or Claude connector (Setup guide in the app), or the REST API, to request a purchase:
   `POST /api/v1/agent/purchase-requests` with the employee's agent key.
4. Under the limit: it is paid through PayPal and shows in Spending. Over the limit: it waits in Approvals.
5. A blocked supplier, such as "Gift card", is stopped and never reaches PayPal.
