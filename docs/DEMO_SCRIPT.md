# Demo video script (target 2:40, hard limit 3:00)

Rules from the hackathon: under 3 minutes, public on YouTube, shows the project working, no third party logos, no copyrighted music. No music at all is the safest choice.

What judges said wins (JetBrains judging notes and the Devpost criteria): state the problem in one breath, show one flow working end to end within about 90 seconds, contrast the old way with the new way, be honest about what is sandbox, and never stall on forms or slow pages.

Criteria this script hits: Technological Implementation (the "under the hood" beat), Design (clean screens, no clutter), Potential Impact (the money and the problem), Innovation (a rule layer for AI spending), Presentation (end to end, no dead air).

Prize categories to name on the Devpost text: Best Use of Agentic Commerce, Best Use of PayPal + AI, Best Use of Render (the API runs on Render), Most Impactful, Best Demo Delivery.

## Before you record (30 minutes, do all of it)

1. Wake the API: open https://flaire-api-cmrs.onrender.com/health in a tab. The free Render instance sleeps and takes about 50 seconds to wake. Do this 2 minutes before recording.
2. Raise Marketing AI's monthly limit to SAR 10,000 (AI workforce, Marketing AI, Edit) so you do not run out during takes.
3. Keep the approval threshold at SAR 500 and the per transaction limit at SAR 1,000.
4. Use different merchants so the split purchase rule does not interfere: Notion (SAR 375), Figma (SAR 800), Canva (SAR 1,200, will be blocked). If a new merchant asks for review, add it under Controls, trusted merchants.
5. Do one full rehearsal of all three requests with the same merchants. The recording is take two.
6. Windows: browser at 1920x1080, zoom 110 percent, dark mode off (light reads better on video), close every other tab, hide the bookmarks bar, turn on Do Not Disturb.
7. Tabs in this order: ChatGPT, Flaire Spending, Flaire Approvals, PayPal sandbox merchant Activity (log in as merchant@flaire.com in a normal window), and an incognito window for approver@flaire.com.
8. Put the three prompts in a notes file so you paste them, you do not type them:
   - Use Flaire to request a purchase of SAR 375 from Notion for a team workspace.
   - Use Flaire to request a purchase of SAR 800 from Figma for a design seat.
   - Use Flaire to request a purchase of SAR 1,200 from Canva for a team plan.

## Script (voice over, about 330 words)

**0:00 to 0:14 Hook.** Screen: ChatGPT with the Notion prompt already pasted, press send as you start talking.
"AI can now buy things for your business. Today that means handing it a company card and hoping for the best. This is Flaire, the finance department for AI employees, and it pays through PayPal."

**0:14 to 0:50 Flow 1, under the limit.** Screen: ChatGPT answers, switch to Flaire Spending, open the Notion row, show the green PayPal panel, then switch to the PayPal merchant Activity and refresh.
"My Marketing AI lives inside ChatGPT. I ask it for a Notion workspace, 375 riyals. Flaire checks the employee's budget, per purchase limit and the merchant. Everything is inside the rules, so Flaire pays through the PayPal Payouts API. 375 riyals becomes exactly 100 dollars. And here it is in PayPal, received and completed."

**0:50 to 1:40 Flow 2, a human approves.** Screen: ChatGPT with the Figma prompt, Flaire Approvals, click Approve, type password, PayPal popup, Pay, return page, merchant Activity.
"Now a bigger purchase, 800 riyals for Figma. It is above this employee's approval threshold, so Flaire stops and asks a person. The AI cannot approve its own spending. I approve in Flaire with my password. Then Flaire sends me to PayPal, where I approve again with my own PayPal login. Two approvals. PayPal Orders moves the money. Approved by me in Flaire and in PayPal, and the merchant is paid."

**1:40 to 2:05 Flow 3, blocked.** Screen: ChatGPT with the Canva 1,200 prompt, the denial, the Spending list showing a blocked row, then the kill switch toggled on and off.
"Now a request that breaks the rules. 1,200 riyals is over the limit, so it is denied before PayPal is ever called. Blocked categories like gift cards never get through. And one kill switch freezes every AI employee at once."

**2:05 to 2:25 Under the hood.** Screen: Connections page, press Test PayPal connection, show the green message, then the Spending row's PayPal panel.
"Under the hood: PayPal OAuth, Payouts with idempotency keys, Orders for approval, and webhooks that Flaire never trusts without asking PayPal again. If PayPal returns a payout, the budget is given back automatically. Any ChatGPT or Claude agent connects through MCP, and Gemini powers the assistant inside the app."

**2:25 to 2:42 Impact and honesty.** Screen: Flaire Overview page.
"Every company that lets agents spend has this problem, and Flaire earns 0.15 percent of what it governs. Today everything runs in the PayPal sandbox. Next is live PayPal accounts. Flaire: let AI spend, with a human in charge."

End card (2 seconds, text only): flaire-nine.vercel.app

## Recording technique

- Voice: record the voice over separately after the screen recording, reading from this script. Use your phone's voice memo app 15 cm from your mouth, in a small quiet room (a wardrobe or a car works). Do not use the laptop microphone. A clean voice matters more than anything else on this list.
- Screen: record with OBS (free) at 1920x1080, 30 fps, or the Windows Game Bar (Win+G) per browser window. Record each flow as its own clip so you can retake one without redoing everything.
- Edit in Clipchamp (free, built into Windows) or CapCut: cut dead air, speed waiting moments to 2x (PayPal page loads, the Render wake up), zoom in 120 percent on the amount, the PayPal panel and the Completed badge.
- Add burned in captions. Many judges watch muted.
- Pace: pause for a half second after each key number (375 riyals, 100 dollars, two approvals).
- Do not say "um", "so basically" or "as you can see". Say the numbers.
- Export 1080p MP4. Upload to YouTube as Public (not Unlisted), title: "Flaire: the finance department for AI employees, built on PayPal". Add the repo link and the live URL in the description.
- Watch the uploaded video once on your phone, with sound off, to check that it makes sense with captions only.

## If you run out of time

Cut the "Under the hood" beat to one sentence. Never cut Flow 2, it is the strongest moment in the whole video.
