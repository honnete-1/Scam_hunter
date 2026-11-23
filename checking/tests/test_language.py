import json
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase, override_settings

from checking.ai_analyzer import AIAnalyzer, AIAssessment, CheckStatus
from checking.requests import MessageCheck
from checking.services import AnalysisService
from checking.translator import Translator, language_name

ONLINE = {"ONLINE_CHECKS_ENABLED": True, "AI_API_KEY": "test-key"}
KINYARWANDA_SCAM = "Muraho! Mwatsindiye 50,000 Frw. Ohereza PIN yawe vuba kugira ngo uyakire."


def reply(content):
    return {"choices": [{"message": {"content": json.dumps(content)}}]}


class FakeAI:
    def __init__(self, language):
        self.language = language

    def analyze(self, message):
        return AIAssessment(CheckStatus.COMPLETED, True, 0.9, "Asks for a PIN.", self.language)


class FakeTranslator:
    # Marks every text so the test can see what was translated; None simulates a failure.
    def __init__(self, works=True):
        self.works = works
        self.received = None

    def translate(self, texts, language):
        self.received = texts
        if not self.works:
            return None
        return {key: f"[{language}] {value}" for key, value in texts.items()}


def analyze(message, language, translator):
    service = AnalysisService(ai_analyzer=FakeAI(language), link_checker=lambda url, domain: [], translator=translator)
    return service.analyze(MessageCheck(message))


class LanguageDetectionTests(SimpleTestCase):
    @override_settings(**ONLINE)
    def test_ai_reports_the_message_language(self):
        answer = {"scam_likely": True, "confidence": 0.9, "reason": "Asks for a PIN.", "language": "RW"}
        with patch("checking.ai_analyzer.request_json", return_value=reply(answer)):
            self.assertEqual(AIAnalyzer().analyze(KINYARWANDA_SCAM).language, "rw")

    @override_settings(**ONLINE)
    def test_an_unreadable_language_is_ignored(self):
        answer = {"scam_likely": True, "confidence": 0.9, "reason": "x", "language": "Kinyarwanda!"}
        with patch("checking.ai_analyzer.request_json", return_value=reply(answer)):
            self.assertEqual(AIAnalyzer().analyze(KINYARWANDA_SCAM).language, "")


class TranslatedResultTests(TestCase):
    def test_result_is_explained_in_the_message_language(self):
        translator = FakeTranslator()
        result = analyze(KINYARWANDA_SCAM, "rw", translator).to_dict()

        self.assertEqual(result["language"], "rw")
        self.assertTrue(result["headline"].startswith("[rw] "))
        self.assertTrue(result["explanation"].startswith("[rw] "))
        self.assertTrue(result["safer_action"].startswith("[rw] "))
        self.assertTrue(all(i["explanation"].startswith("[rw] ") for i in result["indicators"]))
        # The English stays available, and the concern level is not changed by translating.
        self.assertFalse(result["english"]["explanation"].startswith("[rw]"))
        self.assertIn(result["concern_level"], ("CAUTION", "HIGH_CONCERN"))

    def test_the_users_message_is_never_sent_for_translation(self):
        translator = FakeTranslator()
        analyze(KINYARWANDA_SCAM, "rw", translator)
        sent = " ".join(translator.received.values())
        self.assertNotIn("Ohereza PIN yawe", sent)
        self.assertNotIn("Muraho", sent)

    def test_english_messages_are_not_translated(self):
        translator = FakeTranslator()
        result = analyze("Send your PIN now to claim your prize", "en", translator).to_dict()
        self.assertIsNone(translator.received)
        self.assertIsNone(result["english"])
        self.assertEqual(result["headline"], "Be careful: warning signs found" if result["concern_level"] == "CAUTION"
                         else "Warning: this looks like a scam")

    def test_failed_translation_keeps_the_english_text(self):
        result = analyze(KINYARWANDA_SCAM, "fr", FakeTranslator(works=False)).to_dict()
        self.assertEqual(result["language"], "fr")
        self.assertIsNone(result["english"])
        self.assertFalse(result["explanation"].startswith("[fr]"))


class TranslatorTests(SimpleTestCase):
    @override_settings(**ONLINE)
    def test_translation_needs_every_key(self):
        texts = {"headline": "Be careful", "explanation": "It asks for a PIN."}
        with patch("checking.translator.request_json", return_value=reply({"headline": "Witondere"})):
            self.assertIsNone(Translator().translate(texts, "rw"))
        full = {"headline": "Witondere", "explanation": "Irasaba PIN."}
        with patch("checking.translator.request_json", return_value=reply(full)) as mock:
            self.assertEqual(Translator().translate(texts, "rw"), full)
        self.assertIn("Kinyarwanda", mock.call_args.kwargs["json_body"]["messages"][0]["content"])

    def test_nothing_is_sent_when_the_ai_is_not_set_up(self):
        with override_settings(ONLINE_CHECKS_ENABLED=True, AI_API_KEY=""):
            self.assertIsNone(Translator().translate({"headline": "x"}, "fr"))

    def test_language_names(self):
        self.assertEqual(language_name("rw"), "Kinyarwanda")
        self.assertEqual(language_name("xx"), "xx")
