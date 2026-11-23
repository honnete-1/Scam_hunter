# Gives the explanation in the language the scam message was written in (e.g. Kinyarwanda or French).
# Only our own explanation text is sent for translation, never the user's message.

import json

from django.conf import settings

from .external import ExternalServiceError, request_json

LANGUAGE_NAMES = {
    "en": "English",
    "rw": "Kinyarwanda",
    "fr": "French",
    "sw": "Swahili",
    "rn": "Kirundi",
    "lg": "Luganda",
    "ln": "Lingala",
    "es": "Spanish",
    "pt": "Portuguese",
    "ar": "Arabic",
    "de": "German",
    "zh": "Chinese",
    "hi": "Hindi",
}

PROMPT = (
    "Translate every value of the JSON object you receive into {name}. Write simply and calmly for an ordinary "
    "phone user. Keep brand names (MTN, MoMo, Airtel, BK), amounts, links and placeholders like [number] unchanged. "
    "Reply with JSON only, using exactly the same keys."
)


def language_name(code):
    return LANGUAGE_NAMES.get(code, code)


class Translator:
    def translate(self, texts, language):
        # texts maps keys to English sentences. Returns the same keys translated, or None if it failed;
        # the caller then simply keeps the English text.
        if not (settings.ONLINE_CHECKS_ENABLED and settings.AI_API_KEY):
            return None
        body = {
            "model": settings.AI_MODEL,
            "temperature": 0,
            "max_tokens": 1500,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": PROMPT.format(name=language_name(language))},
                {"role": "user", "content": json.dumps(texts, ensure_ascii=False)},
            ],
        }
        try:
            data = request_json(
                settings.AI_BASE_URL.rstrip("/") + "/chat/completions",
                method="POST",
                json_body=body,
                headers={"Authorization": f"Bearer {settings.AI_API_KEY}"},
            )
            answer = json.loads(data["choices"][0]["message"]["content"])
        except (ExternalServiceError, KeyError, IndexError, TypeError, ValueError):
            return None

        # Every key must come back as non-empty text, otherwise the whole translation is ignored.
        if not isinstance(answer, dict):
            return None
        translated = {}
        for key in texts:
            value = answer.get(key)
            if not isinstance(value, str) or not value.strip():
                return None
            translated[key] = value.strip()[:800]
        return translated
