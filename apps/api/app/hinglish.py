"""Hinglish words for the voice: Roman-letter Hindi words are sent to TTS in Hindi script, so "main" (मैं) isn't
read as the English word "main". Only what the voice hears changes; the reply text on screen stays as written.
"""

import asyncio
import re

from app import llm
from app.errors import ProviderFailed, ProviderUnavailable

# Roman spelling (lowercase) -> Hindi script. Add words here when the voice says one wrong.
# Left out on purpose because they are also common English words: to, me, the, do, so, are, use, ham, hi, bat, door.
# The AI step in for_speech handles those from context.
WORDS = {
    # I / you / we, this / that
    "main": "मैं", "mai": "मैं", "mein": "में", "mujhe": "मुझे", "mujhse": "मुझसे", "mera": "मेरा", "meri": "मेरी", "mere": "मेरे",
    "aap": "आप", "aapka": "आपका", "aapki": "आपकी", "aapke": "आपके", "aapko": "आपको", "tum": "तुम", "tumhara": "तुम्हारा",
    "tumhari": "तुम्हारी", "tumhe": "तुम्हें", "tumhein": "तुम्हें", "hum": "हम", "hamara": "हमारा", "hamari": "हमारी",
    "apna": "अपना", "apni": "अपनी", "apne": "अपने", "yeh": "यह", "ye": "ये", "woh": "वह", "wo": "वो", "vo": "वो",
    "isko": "इसको", "isse": "इससे", "uska": "उसका", "uski": "उसकी", "unka": "उनका", "inka": "इनका",
    # is / was / will be
    "hai": "है", "hain": "हैं", "hoon": "हूँ", "hun": "हूँ", "hu": "हूँ", "ho": "हो", "tha": "था", "thi": "थी",
    "hoga": "होगा", "hogi": "होगी", "honge": "होंगे", "hua": "हुआ", "hui": "हुई", "hue": "हुए",
    "raha": "रहा", "rahi": "रही", "rahe": "रहे", "sakte": "सकते", "sakta": "सकता", "sakti": "सकती", "chahiye": "चाहिए",
    # little words
    "ka": "का", "ki": "की", "ke": "के", "ko": "को", "se": "से", "par": "पर", "aur": "और", "ya": "या", "bhi": "भी",
    "nahi": "नहीं", "nahin": "नहीं", "na": "ना", "haan": "हाँ", "toh": "तो", "lekin": "लेकिन", "magar": "मगर",
    "kyunki": "क्योंकि", "agar": "अगर", "phir": "फिर", "fir": "फिर", "jab": "जब", "tab": "तब", "jaise": "जैसे",
    "waise": "वैसे", "sirf": "सिर्फ", "bas": "बस", "abhi": "अभी", "aaj": "आज", "kal": "कल", "yahan": "यहाँ", "wahan": "वहाँ",
    # questions
    "kya": "क्या", "kyun": "क्यों", "kyon": "क्यों", "kaise": "कैसे", "kaisa": "कैसा", "kaisi": "कैसी", "kab": "कब",
    "kahan": "कहाँ", "kaun": "कौन", "kitna": "कितना", "kitne": "कितने", "kitni": "कितनी",
    # amounts and describing
    "bahut": "बहुत", "thoda": "थोड़ा", "thodi": "थोड़ी", "thode": "थोड़े", "zyada": "ज़्यादा", "jyada": "ज़्यादा", "kam": "कम",
    "sab": "सब", "kuch": "कुछ", "koi": "कोई", "ek": "एक", "accha": "अच्छा", "acha": "अच्छा", "achha": "अच्छा",
    "acchi": "अच्छी", "achhi": "अच्छी", "theek": "ठीक", "thik": "ठीक", "sahi": "सही", "galat": "गलत", "galti": "गलती",
    "galtiyan": "गलतियाँ", "aasan": "आसान", "mushkil": "मुश्किल", "naya": "नया", "nayi": "नई", "naye": "नए",
    # doing and saying
    "karo": "करो", "karna": "करना", "karte": "करते", "karta": "करता", "karti": "करती", "kar": "कर", "kiya": "किया",
    "kijiye": "कीजिए", "bolo": "बोलो", "bolna": "बोलना", "bolte": "बोलते", "bol": "बोल", "kaho": "कहो", "kehte": "कहते",
    "dekho": "देखो", "suno": "सुनो", "samjho": "समझो", "samajh": "समझ", "samjha": "समझा", "socho": "सोचो", "chalo": "चलो",
    "likho": "लिखो", "padho": "पढ़ो", "seekho": "सीखो", "seekhna": "सीखना", "batao": "बताओ", "bataiye": "बताइए",
    "jao": "जाओ", "aao": "आओ", "lagta": "लगता", "lagti": "लगती", "matlab": "मतलब", "baat": "बात", "baar": "बार",
    "dost": "दोस्त", "shabd": "शब्द", "vakya": "वाक्य", "jawab": "जवाब", "sawal": "सवाल", "din": "दिन", "roz": "रोज़",
    # who did it, and past / future forms
    "maine": "मैंने", "aapne": "आपने", "tumne": "तुमने", "humne": "हमने", "usne": "उसने", "unhone": "उन्होंने", "ab": "अब",
    "gaya": "गया", "gayi": "गई", "gaye": "गए", "bola": "बोला", "boli": "बोली", "bole": "बोले", "kaha": "कहा",
    "diya": "दिया", "liya": "लिया", "dena": "देना", "lena": "लेना", "karoge": "करोगे", "karenge": "करेंगे",
    "karunga": "करूँगा", "karungi": "करूँगी", "karein": "करें", "jayega": "जाएगा", "jayegi": "जाएगी", "milega": "मिलेगा",
    "chahte": "चाहते", "chahta": "चाहता", "chahti": "चाहती", "aata": "आता", "aati": "आती", "jaata": "जाता", "jaati": "जाती",
    # places and directions
    "aage": "आगे", "peeche": "पीछे", "upar": "ऊपर", "neeche": "नीचे", "andar": "अंदर", "bahar": "बाहर", "saath": "साथ",
    "paas": "पास", "baad": "बाद", "pehle": "पहले", "liye": "लिए", "wala": "वाला", "wali": "वाली", "wale": "वाले",
    "dhyan": "ध्यान", "rakhna": "रखना", "rakho": "रखो", "padhenge": "पढ़ेंगे", "chalte": "चलते", "paani": "पानी", "khana": "खाना",
}
_WORD = re.compile(r"[A-Za-z]+")
PROMPT = (
    "You prepare text for a Hindi-English text-to-speech voice. The text is Hinglish: Hindi written in English letters, "
    "mixed with English. Write every Hindi word in Devanagari script and leave every English word exactly as written, in "
    "English letters. Use the sentence to decide words that could be either language: 'do' is दो when it is Hindi (give, "
    "two: 'mujhe paani do', 'do baar') and stays 'do' when it is the English verb ('I do yoga'); 'main' is मैं when it "
    "means I; 'to' is तो when it is Hindi. Do not translate, add, remove or reorder words, and keep the punctuation. "
    "Reply with the rewritten text only."
)


def is_hinglish(text: str) -> bool:
    """At least two different Hindi words from the list, so English like "the main idea" is left alone."""
    return len({w.lower() for w in _WORD.findall(text) if w.lower() in WORDS}) >= 2


def by_list(text: str) -> str:
    """Word-list rewrite: fast and offline, but can't tell Hindi "do" (दो) from English "do"."""
    return _WORD.sub(lambda m: WORDS.get(m.group().lower(), m.group()), text) if is_hinglish(text) else text


def _plausible(text: str, out: str) -> bool:
    """The AI only moved Hindi words to Devanagari: no new English words, about the same length."""
    before = {w.lower() for w in _WORD.findall(text)}
    return bool(out) and {w.lower() for w in _WORD.findall(out)} <= before and 0.5 < len(out) / len(text) < 2


async def for_speech(text: str) -> str:
    """Text for the voice: Hinglish gets its Hindi words in Hindi script, so they are pronounced as Hindi.
    The AI picks per word from context ("do" = दो or English do); the word list is the fallback."""
    if not is_hinglish(text):
        return text
    try:
        out = await asyncio.wait_for(llm.chat(PROMPT, [{"role": "user", "content": text}]), timeout=4)
    except (ProviderFailed, ProviderUnavailable, TimeoutError):
        return by_list(text)
    if not _plausible(text, out):
        return by_list(text)
    # The AI sometimes leaves a Hindi word in English letters; the list fills those gaps (it has no English look-alikes).
    return _WORD.sub(lambda m: WORDS.get(m.group().lower(), m.group()), out)
