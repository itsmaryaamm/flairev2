"""Keeps Gemini for Flaire questions only. Off-topic messages (math homework, essays, code, trivia) get a polite
canned reply and never reach the model, so they cost nothing."""
from __future__ import annotations

import re

ON_TOPIC = re.compile(
    r"flaire|\bai\b|agent|assistant|chatgpt|claude|gemini|openai|sandbox|simulat|pretend|\bmcp\b|connector|connect|plugin|"
    r"spend|spent|spending|budget|limit|card|purchase|buy|bought|pay|paid|payment|invoice|receipt|expense|cost|price|pricing|fee|"
    r"approv|reject|declin|decision|pending|waiting|blocked|stopped|allow|supplier|merchant|vendor|categor|rule|policy|threshold|kill|"
    r"employee|helper|team|department|company|account|sign ?up|register|log ?in|password|2fa|security|safe|secure|trust|"
    r"money|sar|riyal|saudi|gcc|vat|accountant|export|csv|history|audit|report|dashboard|overview|setup|set up|start|"
    r"how (does|do|can|it)|what is|what does|why|help|support|contact|demo|trial|free|works?|feature|"
    r"need|left|remain|latest|recent|status|request|bought|total|month|week|today|yesterday|held|\bhold|denied|reason|#\d+|ads\b|subscription|software|"
    r"hi\b|hello|hey|thanks|thank you|salam|marhaba|"
    r"فلير|ذكاء|مساعد|بطاقة|ميزانية|حد|إنفاق|انفاق|صرف|دفع|شراء|موافقة|رفض|مورد|قاعدة|موظف|شركة|حساب|أمان|امان|ريال|محاسب|تجربة|مجان|كيف|ماذا|لماذا|ما هو|مرحبا|السلام|شكرا|مساعدة|تواصل|اشتراك|سعر|أسعار",
    re.I,
)
OFF_TOPIC = re.compile(
    r"homework|assignment|essay|poem|story|joke|recipe|lyrics|translate|weather|football|score|horoscope|"
    r"solve|equation|integral|derivative|calculus|algebra|geometry|physics|chemistry|biology|"
    r"python|javascript|java\b|c\+\+|sql|write (me )?(a )?(code|script|function|program)|debug|"
    r"capital of|who (is|was) the (president|king|prime)|"
    r"[0-9]+\s*[\+\-\*/x×÷\^]\s*[0-9]+|what is [0-9]+|ignore (all |previous )?instructions|system prompt|"
    r"واجب|حل المعادلة|معادلة|قصيدة|نكتة|وصفة|ترجم|الطقس|برمجة|كود",
    re.I,
)

REFUSAL_EN = "I can only help with Flaire: how it works, your AI helpers, budgets, limits, approvals and the sandbox. What would you like to know about those?"
REFUSAL_AR = "أستطيع المساعدة فقط في أمور Flaire: كيف يعمل، ومساعدوك الأذكياء، والميزانيات والحدود والموافقات والبيئة التجريبية. ماذا تريد أن تعرف عنها؟"


def is_on_topic(message: str, has_history: bool = False) -> bool:
    m = (message or "").strip()
    if not m:
        return False
    # An obvious off-topic request is blocked even if it mentions a keyword ("solve 12*7 for my budget homework").
    if OFF_TOPIC.search(m) and not re.search(r"flaire|فلير", m, re.I):
        return False
    if ON_TOPIC.search(m):
        return True
    # Short follow-ups inside a Flaire conversation ("and the second one?") stay allowed.
    return has_history and len(m) <= 40


def refusal(message: str) -> str:
    return REFUSAL_AR if re.search(r"[؀-ۿ]", message or "") else REFUSAL_EN
