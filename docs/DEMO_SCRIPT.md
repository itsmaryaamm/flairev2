# Demo video script (target 2:50, hard limit 3:00)

Rules: under 3 minutes, public on YouTube, shows the project working, no third party logos or copyrighted music. No music is safest. Made-up merchants only (Acme Design, Northwind Software, Blueline Media).

Criteria this hits: Technological Implementation (PayPal Payouts, Orders, webhooks), Design (clean dashboard), Potential Impact (the problem and the money), Innovation (a rule layer for AI spending with a human approving inside PayPal), Presentation (three flows, no dead air).

Prize categories for Devpost: Best Use of Agentic Commerce, Best Use of PayPal + AI, Best Use of Render, Most Impactful, Most Creative, Best Demo Delivery.

## Before you record (30 minutes)

1. Wake the API 2 minutes before: open https://flaire-api-cmrs.onrender.com/api/v1/health.
2. Controls, trusted merchants: add Acme Design, Northwind Software, Blueline Media (so the new-supplier review does not interfere).
3. Check the AI employee's limits (AI workforce, Edit): per purchase at least $267, approval threshold BELOW $200 (new accounts default to $133), monthly $2,667 or more. If your threshold equals the per purchase limit, the $200 request will not wait for approval.
4. Do one full rehearsal with the same three prompts. The recording is take two.
5. Browser 1920x1080, zoom 110 percent, one window per tab, close everything else, hide bookmarks, Do Not Disturb on, phone notifications off.
6. Tabs in order: ChatGPT, Flaire Spending, Flaire Approvals, PayPal sandbox merchant Activity (merchant@flaire.com), and a PRIVATE window for the approver so the PayPal login shows.
7. Prompts in a notes file (paste, do not type):
   - Use Flaire to request a purchase of $100 from Acme Design for a team workspace.
   - Use Flaire to request a purchase of $200 from Northwind Software for a design license.
   - Use Flaire to request a purchase of $320 from Blueline Media for an ad package.

## Script (about 400 words, target 2:50)

Motif to repeat: "The AI can ask. Only a human can approve. Only PayPal moves the money."

**0:00 to 0:10 Cold open**
[Black screen. White text types in: "Your AI just spent $320." then "You find out next month." Hold 2 seconds, then cut to ChatGPT with prompt 1 pasted.]
"Imagine your AI agent just spent 320 dollars of company money, and you find out next month. That is what a shared card gives you. No limit per agent, no approval, no off switch."

**0:10 to 0:17 Title**
[Flaire logo with the line: "The finance department for AI employees. Every payment through PayPal."]
"This is Flaire. The AI can ask. Only a human can approve. Only PayPal moves the money."

**0:17 to 0:55 Flow 1: within the rules**
[Press send on prompt 1. ChatGPT answers. Cut to Flaire Spending, click the Acme Design $100 row, open the PayPal panel. Cut to PayPal merchant Activity, refresh, "$100.00 Completed". Overlay text: "PayPal Payouts API".]
"My AI employee lives in ChatGPT. I ask for a 100 dollar team workspace. Before any money moves, Flaire checks its budget, its per purchase limit and the supplier. It passes, so Flaire pays through the PayPal Payouts API. And here it is in the PayPal sandbox merchant account. 100 dollars, completed."

**0:55 to 1:45 Flow 2: a human approves, inside PayPal**
[Send prompt 2. ChatGPT says it is waiting for approval. Flaire Approvals: "$200 Northwind Software, waiting". Overlay: "The AI cannot approve itself". Click Approve, type the password. Private window: PayPal login as the approver, PayPal checkout showing $200.00, click Pay. Return page "Paid through PayPal". Cut to merchant Activity $200.00.]
"Now 200 dollars, above this employee's approval limit. On a shared card, this just goes through. Here, Flaire stops. ChatGPT has no approve button, only a person does. I approve in Flaire with my password. Then Flaire sends me into PayPal, where I approve again with my own PayPal login. PayPal Orders moves the money to the sandbox merchant. Two approvals, one payment."

**1:45 to 2:10 Flow 3: blocked, and the kill switch**
[Send prompt 3. ChatGPT says denied. Flaire Spending: red "Blocked" row. Overlay: "Denied before PayPal was called". Toggle the kill switch on (banner: all AI employees frozen), then off.]
"Now an AI that goes too far. 320 dollars is over the limit, so it is denied, and PayPal is never even called. And if an agent misbehaves, one kill switch freezes every AI employee."

**2:10 to 2:30 Under the hood**
[Connections page, press "Test PayPal connection", green message. Then 4 seconds of the architecture diagram on the GitHub README.]
"Under the hood: PayPal OAuth, Payouts with idempotency keys so a retry never pays twice, Orders for approval, and webhooks that Flaire always re-verifies with PayPal. If PayPal returns a payout, the budget is restored. Any ChatGPT or Claude agent connects over MCP, and the API runs on Render."

**2:30 to 2:50 Close**
[Overview dashboard, held still. Optional small face circle bottom right for these lines. End card: Flaire logo, flaire-paypal.vercel.app, github.com/itsmaryaamm/flaire-paypal, "PayPal sandbox. No real money moves."]
"Agentic commerce only works if businesses can trust it. Flaire gives every AI employee a budget, rules and an off switch, and lets PayPal do what it does best, moving money safely. Everything you saw runs in the PayPal sandbox. Next, live PayPal accounts. Flaire. Let AI spend, with a human in charge."

## Recording technique

- Record the voice over separately after the screen, on your phone voice memo 15 cm from your mouth in a small quiet room (wardrobe or car). A clean voice matters more than anything.
- Record each flow as its own clip (OBS or Win+G, 1080p, 30 fps) so you can retake one.
- Edit in Clipchamp or CapCut: cut dead air, speed waiting moments 2x, zoom 120 percent on the amount and the PayPal panel, burned in captions (many judges watch muted).
- Pause half a second after each key number. Do not say "um", "so basically" or "as you can see".
- Export 1080p MP4. YouTube Public, title: "Flaire: the finance department for AI employees, built on PayPal". Put the GitHub and live links in the description.
- Watch it once on your phone with the sound off.

## If you run out of time

Cut "Under the hood" to one sentence. Never cut Flow 2, it is the strongest moment.

## Feature freeze rule

If a feature is not in this script, do not build it before the deadline. Only fixes that keep the three flows working are allowed.
