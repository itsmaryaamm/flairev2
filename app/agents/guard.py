"""Keeps Gemini for Flaire questions only. Off-topic messages (math homework, essays, code, trivia) get a polite
canned reply and never reach the model, so they cost nothing."""
from __future__ import annotations

import re

ON_TOPIC = re.compile(
    r"flaire|أموال|فلوس|حقيقي|وهمي|تجريب|ذكاء|ميزانية|بطاقة|موافق|\bai\b|agent|assistant|chatgpt|claude|gemini|openai|sandbox|simulat|pretend|\bmcp\b|connector|connect|plugin|"
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


# Direct answers used when Gemini is not configured or fails, so the reply still answers the actual question.
_FAQ = [
    (r"real money|real\b.*(charge|pay)|charged|actually (pay|spend)|sandbox|pretend|simulat|فلوس|أموال حقيقية|حقيقي|وهمي|تجريب",
     "No. Flaire is a sandbox right now: the money and cards are simulated, so nothing real is ever charged or moved. You can test every rule safely. Real payments are not switched on yet.",
     "لا. Flaire حاليًا بيئة تجريبية: الأموال والبطاقات محاكاة، فلا يُخصم أو يُحوَّل أي مبلغ حقيقي. تستطيع اختبار كل القواعد بأمان. المدفوعات الحقيقية لم تُفعَّل بعد."),
    (r"overspend|spend more|exceed|go over|too much|stop(s)? (it|my)|limit|control|يتجاوز|أكثر مما|حد|يتحكم",
     "No. You set a limit per purchase and a monthly budget. Flaire checks every purchase against them, not the AI. Anything over your limit stops and waits for your yes or no, and a blocked supplier is stopped outright.",
     "لا. تحدد حدًّا لكل عملية شراء وميزانية شهرية، ويتحقق Flaire من كل عملية، وليس الذكاء الاصطناعي. أي مبلغ فوق حدك يتوقف وينتظر قرارك بنعم أو لا، والمورّد المحظور يُوقَف مباشرة."),
    (r"chatgpt|claude|gemini|which (ai|tools)|work with|connect|integrat|plugin|ربط|يعمل مع",
     "Flaire works with ChatGPT and Claude. After you sign up, a short guide shows you how to add Flaire to either one in about two minutes, and you choose which AI helper it is.",
     "يعمل Flaire مع ChatGPT و Claude. بعد التسجيل يوضح لك دليل قصير كيف تضيفه إلى أي منهما خلال دقيقتين تقريبًا، وتختار أي مساعد ذكي يمثله."),
    (r"price|pricing|cost|how much|fee|plan|subscription|سعر|أسعار|كم يكلف|تكلفة|اشتراك",
     "Pricing is not final yet because Flaire is in the sandbox. Trying it is free. If you want to talk about pricing, use the contact link at the bottom of the page.",
     "الأسعار لم تُحدد نهائيًا لأن Flaire في مرحلة البيئة التجريبية. التجربة مجانية. للحديث عن الأسعار استخدم رابط التواصل أسفل الصفحة."),
    (r"start|sign ?up|register|begin|get started|try|free|set ?up|how do i|أبدأ|ابدأ|تسجيل|جرب|مجان|إعداد",
     "Tap Try the sandbox free, create your account, add your first AI helper with its limits, then connect ChatGPT or Claude. It takes a few minutes and costs nothing.",
     "اضغط جرّب البيئة التجريبية مجانًا، وأنشئ حسابك، وأضف أول مساعد ذكي بحدوده، ثم اربط ChatGPT أو Claude. يستغرق دقائق ولا يكلف شيئًا."),
    (r"approv|ok\b|permission|ask me|wait|موافق|يسألني|ينتظر",
     "When your AI wants more than its limit, the request waits on your Approvals screen. You see what it wants, how much and why, then you tap Approve or Decline. Small purchases under your limit go straight through.",
     "عندما يريد الذكاء الاصطناعي أكثر من حده، ينتظر الطلب في شاشة الموافقات. ترى ما يريده وكم ولماذا، ثم تضغط موافقة أو رفض. المشتريات الصغيرة ضمن حدك تمر مباشرة."),
    (r"safe|secure|security|trust|hack|steal|kill|أمان|آمن|حماية",
     "Your rules are enforced by Flaire on every purchase and the AI cannot change or skip them. You can pause one helper or switch off all AI spending instantly with the kill switch, and every request and decision is recorded.",
     "قواعدك يفرضها Flaire في كل عملية شراء ولا يستطيع الذكاء الاصطناعي تغييرها أو تجاوزها. تستطيع إيقاف مساعد واحد أو كل الإنفاق فورًا بمفتاح الإيقاف، وكل طلب وقرار يُسجَّل."),
    (r"account(ant)?|export|csv|report|history|record|download|محاسب|سجل|تقرير|تنزيل",
     "Every request, decision and approval is saved. You can download the full history as a file for your accountant.",
     "كل طلب وقرار وموافقة محفوظ. تستطيع تنزيل السجل الكامل كملف لمحاسبك."),
    (r"arabic|language|عربي|لغة",
     "Yes. Flaire is available in English and Arabic. Use the EN / ع switch at the top of the page.",
     "نعم. Flaire متوفر بالعربية والإنجليزية. استخدم مفتاح EN / ع أعلى الصفحة."),
    (r"how (does|do|it)|what is|what does|works?|explain|about|كيف|ما هو|ما هي|يعمل|شرح",
     "Flaire gives your AI assistant its own company card with limits you set. Under your limit it goes through, over your limit it waits for your OK, and blocked suppliers are stopped. You see every purchase in one place. Right now it is a sandbox, so nothing real is charged.",
     "يمنح Flaire مساعدك الذكي بطاقة شركة خاصة بحدود تحددها. ما كان ضمن حدك يمر، وما تجاوزه ينتظر موافقتك، والموردون المحظورون يُوقَفون. وترى كل عملية في مكان واحد. حاليًا هو بيئة تجريبية فلا يُخصم أي مبلغ حقيقي."),
]


def faq_answer(message: str) -> str | None:
    ar = bool(re.search(r"[؀-ۿ]", message or ""))
    for pat, en, arabic in _FAQ:
        if re.search(pat, message or "", re.I):
            return arabic if ar else en
    return None
