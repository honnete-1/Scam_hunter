from django.test import SimpleTestCase

from checking.requests import normalize_url
from checking.rule_engine import RuleEngine


def indicator_types(indicators):
    return [indicator["type"] for indicator in indicators]


# Differently worded examples of each behaviour. They are not copies of the regex text.
POSITIVE_EXAMPLES = {
    "urgency": [
        "Act now before your account is blocked",
        "You have 10 minutes to verify your account.",
        "Confirm your details now or your account will be suspended.",
        "Please verify within 24 hours.",
        "Your card will be closed tonight.",
        "If you do not respond, your line will be deactivated.",
        "URGENT: call this number.",
        "This offer expires today.",
    ],
    "sensitive_information_request": [
        "Send me your OTP.",
        "Reply with your PIN.",
        "Enter your password to continue.",
        "Provide your card number and CVV.",
        "Confirm your account using the verification code.",
        "Reply with your OTP to restore access.",
        "Please enter your card number and CVV.",
        "Your OTP must be sent to this number.",
        "Send me the verification number you just received.",
        "Give me the code we just sent you.",
    ],
    "payment_request": [
        "Send 20,000 RWF to this number.",
        "Pay the processing fee now.",
        "Transfer the money through MoMo.",
        "Buy a gift card and send me the code.",
        "Deposit 10,000 RWF to release your package.",
        "Send 20,000 RWF through Mobile Money.",
        "Pay the delivery fee before your parcel can be released.",
        "A release fee of 3,000 RWF is required.",
        "We need 50,000 RWF for the operation.",
    ],
    "impersonation": [
        "This is MTN Customer Care.",
        "We are contacting you from your bank.",
        "This message is from the fraud department.",
        "I am calling on behalf of Airtel.",
        "This is the police. Your account is under investigation.",
        "This is MTN Customer Care. We are contacting you about your SIM card.",
        "We are writing from your bank's security team.",
        "Dear MTN subscriber, your line has a problem.",
    ],
    "reward_claim": [
        "Congratulations! You have won a cash prize.",
        "You have been selected to receive 500,000 RWF.",
        "Claim your reward now.",
        "You are the lucky winner of our lottery.",
        "You have been selected to receive a cash prize.",
        "Claim your lottery reward today.",
        "You've been chosen for a free iPhone!",
    ],
    "emotional_pressure": [
        "I'm stranded and this is my new number. Please help me.",
        "Do not tell anyone or legal action will be taken.",
        "I'm in trouble, please don't tell Dad.",
        "I had an accident and need money.",
        "This is an emergency.",
        "Keep this between us.",
        "Do not contact the bank about this.",
        "You will be arrested if you ignore this.",
        "Mum, I lost my phone.",
        "Dad, I'm using another number.",
    ],
}

# Legitimate messages that mention risky words in a safe context.
FALSE_POSITIVE_EXAMPLES = {
    "sensitive_information_request": [
        "Never share your password or OTP with anyone.",
        "Never share your password with anyone.",
        "Banks will never ask for your PIN.",
        "Do not send your OTP to anyone.",
        "Your bank will never ask you to share your PIN.",
        "Remember to change your password every few months.",
    ],
    "payment_request": [
        "I paid for lunch using MTN Mobile Money.",
        "I use Mobile Money every day.",
        "The restaurant accepts MoMo.",
        "Our class discussed Bitcoin.",
        "Do not send money to people you do not know.",
        "Never transfer money to an unknown person.",
        "Thanks for the transfer, I received the 5,000 RWF.",
        "I'll send you the money tomorrow, thanks for lunch.",
    ],
    "impersonation": [
        "MTN has improved its network coverage.",
        "MTN has good coverage.",
        "I use Airtel for internet.",
        "PayPal is an online payment platform.",
        "Scammers may pretend to be MTN Customer Care.",
        "I paid for lunch using MTN Mobile Money.",
        "I'm at the bank now.",
    ],
    "reward_claim": [
        "Congratulations on graduating.",
        "Congratulations on completing your internship!",
        "You won yesterday's football match.",
        "Our team won a trophy at school.",
    ],
    "urgency": [
        "Our cybersecurity class discussed urgent phishing messages.",
        "Your order will arrive within 2 days.",
        "Please reply by Friday if you can come.",
    ],
    "emotional_pressure": [
        "There was an accident on the main road, traffic is slow.",
        "Grandma can leave the hospital tomorrow.",
        "I'm at the hospital visiting my aunt.",
        "The police arrested two suspects yesterday.",
    ],
}


class MessageRuleTests(SimpleTestCase):
    def setUp(self):
        self.engine = RuleEngine()

    def types_for(self, message):
        return indicator_types(self.engine.detect_scam_like_signs(message))

    def test_positive_examples_for_each_category(self):
        for category, messages in POSITIVE_EXAMPLES.items():
            for message in messages:
                with self.subTest(category=category, message=message):
                    self.assertIn(category, self.types_for(message))

    def test_false_positive_examples(self):
        for category, messages in FALSE_POSITIVE_EXAMPLES.items():
            for message in messages:
                with self.subTest(category=category, message=message):
                    self.assertNotIn(category, self.types_for(message))

    def test_safety_advice_messages_have_no_indicators(self):
        for message in [
            "Never share your password or OTP with anyone.",
            "Banks will never ask for your PIN.",
            "Do not send money to people you do not know.",
            "Our cybersecurity class discussed urgent phishing messages.",
            "Congratulations on completing your internship!",
            "MTN has improved its network coverage.",
        ]:
            with self.subTest(message=message):
                self.assertEqual(self.types_for(message), [])

    def test_real_request_after_advice_is_still_found(self):
        # The advice part is skipped, but the later request in the same message still counts.
        message = "Never share your PIN with strangers. But for this update, send me your PIN."
        self.assertIn("sensitive_information_request", self.types_for(message))

    def test_matching_ignores_case(self):
        for message in ["SEND ME YOUR OTP", "send me your otp", "Send Me Your Otp"]:
            with self.subTest(message=message):
                self.assertEqual(self.types_for(message), ["sensitive_information_request"])

    def test_indicator_has_short_evidence_and_explanation(self):
        indicators = self.engine.detect_scam_like_signs("Please respond URGENTLY, thank you very much for your time.")
        self.assertEqual(len(indicators), 1)
        self.assertEqual(indicators[0]["type"], "urgency")
        # Evidence is the matched phrase, not the whole message.
        self.assertEqual(indicators[0]["evidence"], "respond URGENTLY")
        self.assertTrue(indicators[0]["explanation"])

    def test_evidence_for_time_limit(self):
        indicators = self.engine.detect_scam_like_signs("Verify your account within 30 minutes.")
        self.assertEqual(indicators[0]["evidence"], "Verify your account within 30 minutes")

    def test_repeated_category_counts_once(self):
        message = "URGENT! Act now! Respond immediately! This is your last chance!"
        self.assertEqual(self.types_for(message), ["urgency"])

    def test_normal_message_has_no_indicators(self):
        message = "Hi, are we still meeting for lunch tomorrow at noon?"
        self.assertEqual(self.engine.detect_scam_like_signs(message), [])

    def test_whole_words_only(self):
        # "spinach" contains "pin" but should not count as a PIN request.
        self.assertEqual(self.engine.detect_scam_like_signs("Send me spinach and apples"), [])

    def test_homepage_example_matches_the_mockup(self):
        # The web homepage mockup shows this message as CAUTION with exactly these two signs.
        message = "Your account will be blocked today. Send your PIN immediately."
        self.assertEqual(self.types_for(message), ["urgency", "sensitive_information_request"])


# Messages that the Stage 2.5 rules missed, with the categories they must produce now.
BLIND_SPOT_REGRESSIONS = [
    ("I am from MTN support. Send the SMS code to me so I can fix your account.",
     {"impersonation", "sensitive_information_request"}),
    ("Bank security here. Tell us the six digit number from the text message to stop the transfer.",
     {"impersonation", "sensitive_information_request"}),
    ("Send 10k to this number so your parcel can be released.",
     {"payment_request"}),
    ("Winner alert! Your number won a Toyota RAV4 in our Mega Draw. Contact this number to collect it.",
     {"reward_claim"}),
    ("This is John from Bank of Kigali. Confirm the code from your SMS.",
     {"impersonation", "sensitive_information_request"}),
    ("Your SIM has been locked. Enter your PIN to unlock it.",
     {"urgency", "sensitive_information_request"}),
    ("Winner alert: your phone number has won a Toyota RAV4 in the Airtel Mega Draw. Contact our agent to claim it.",
     {"reward_claim"}),
]

# Variations of the same behaviours, so the fixes are not tied to the exact sentences above.
BLIND_SPOT_VARIATIONS = {
    "impersonation": [
        "I'm with Airtel support and I need to check your line.",
        "I'm from Airtel customer care.",
        "BK security here, we noticed a login.",
        "MTN support here. Your SIM needs an update.",
        "Hi, Bank of Kigali security team here.",
        "This is Eric from MTN Customer Care.",
        "My name is Alice from Equity Bank.",
    ],
    "sensitive_information_request": [
        "Read me the 6-digit number you received.",
        "read me the six-digit code please",
        "Forward the text message code to this number.",
        "Give us the number from the SMS.",
    ],
    "payment_request": [
        "send 25k on this number",
        "Transfer 20000 to 0788123456.",
        "Pay 5k to activate the service.",
        "Settle 3500 today.",
        "Please settle the customs charge to receive your parcel.",
        "Pay the shipping charge of 2,000 RWF.",
        "Settle the outstanding balance today.",
    ],
    "reward_claim": [
        "Your SIM number won a motorbike!",
        "Your email address has been selected in our annual promotion.",
        "You are a lucky draw winner this month.",
        "Congratulations, promotion winner!",
    ],
    "urgency": [
        "Your account has been restricted. Click here to restore access.",
        "Your account is locked, verify your identity.",
        "Verify your details to avoid suspension.",
        "Your line will be cut unless you confirm your ID.",
        "Deposit the money before 5pm.",
        "Confirm the transfer before 18:00.",
        "Update your details to avoid return to sender.",
    ],
}

# Legitimate messages close to the new patterns.
BLIND_SPOT_FALSE_POSITIVES = {
    "reward_claim": [
        "Our class won the robotics competition.",
        "The Toyota RAV4 won car of the year.",
        "Our football team won yesterday.",
        "The MTN Mega Draw happens on Friday.",
    ],
    "impersonation": [
        "I am from Kigali and I use MTN.",
        "John from Bank of Kigali spoke at our university event yesterday.",
        "This is my friend from MTN, he will visit us.",
        "We have security here at the gate.",
        "I'm at the bank with my mum.",
    ],
    "sensitive_information_request": [
        "The SMS code feature was explained in today's cybersecurity lesson.",
        "Never share your SMS code.",
        "Do not give anyone the six-digit code you receive.",
    ],
    "payment_request": [
        "My rent is 20000 per month.",
        "The bus number is 20000.",
        "I scored 3500 points.",
        "My class starts at 10.",
        "Send 3 photos please.",
        "Call me on 0788123456.",
        "I ran a 5k this morning.",
    ],
    "urgency": [
        "The workshop begins before 4 PM.",
        "Please submit your assignment before 4 PM.",
        "The account was locked during our cybersecurity demo.",
    ],
}


class BlindSpotTests(SimpleTestCase):
    def setUp(self):
        self.engine = RuleEngine()

    def types_for(self, message):
        return set(indicator_types(self.engine.detect_scam_like_signs(message)))

    def test_previously_missed_messages(self):
        for message, expected in BLIND_SPOT_REGRESSIONS:
            with self.subTest(message=message):
                self.assertTrue(expected <= self.types_for(message), self.types_for(message))

    def test_variations(self):
        for category, messages in BLIND_SPOT_VARIATIONS.items():
            for message in messages:
                with self.subTest(category=category, message=message):
                    self.assertIn(category, self.types_for(message))

    def test_new_false_positive_guards(self):
        for category, messages in BLIND_SPOT_FALSE_POSITIVES.items():
            for message in messages:
                with self.subTest(category=category, message=message):
                    self.assertNotIn(category, self.types_for(message))

    def test_evidence_stays_short(self):
        indicators = self.engine.detect_scam_like_signs("Your SIM has been locked. Enter your PIN to unlock it.")
        evidence = {indicator["type"]: indicator["evidence"] for indicator in indicators}
        self.assertEqual(evidence["urgency"], "SIM has been locked")
        self.assertEqual(evidence["sensitive_information_request"], "Enter your PIN")


class CombinationTests(SimpleTestCase):
    def setUp(self):
        self.engine = RuleEngine()

    def test_fake_mtn_support_with_otp_and_payment(self):
        message = (
            "This is MTN Customer Care. Your account will be suspended within 30 minutes. "
            "Reply with your OTP and send 5,000 RWF through MoMo to restore access."
        )
        types = indicator_types(self.engine.detect_scam_like_signs(message))
        for category in ["impersonation", "urgency", "sensitive_information_request", "payment_request"]:
            self.assertIn(category, types)

    def test_fake_prize_with_processing_fee(self):
        message = (
            "Congratulations! You have been selected to receive 500,000 RWF. "
            "Pay a 10,000 RWF processing fee now to claim your reward."
        )
        types = indicator_types(self.engine.detect_scam_like_signs(message))
        for category in ["reward_claim", "payment_request", "urgency"]:
            self.assertIn(category, types)

    def test_family_emergency_with_secrecy_and_money(self):
        message = "Mum, this is my new number. I had an accident, send 30,000 RWF urgently and don't tell Dad."
        types = indicator_types(self.engine.detect_scam_like_signs(message))
        for category in ["emotional_pressure", "payment_request", "urgency"]:
            self.assertIn(category, types)

    def test_each_category_appears_only_once(self):
        message = (
            "This is MTN Customer Care. This is the fraud department. Send your PIN, send your OTP, "
            "send your password. Act now! Respond immediately!"
        )
        types = indicator_types(self.engine.detect_scam_like_signs(message))
        self.assertEqual(len(types), len(set(types)))


class URLStructureTests(SimpleTestCase):
    def setUp(self):
        self.engine = RuleEngine()

    def inspect(self, url):
        return indicator_types(self.engine.inspect_url_structure(normalize_url(url)))

    def test_ip_address_host(self):
        self.assertIn("ip_address_host", self.inspect("http://192.168.0.1/login"))

    def test_at_symbol(self):
        self.assertIn("credentials_in_url", self.inspect("http://mybank.com@evil.example/"))

    def test_punycode(self):
        self.assertIn("punycode_domain", self.inspect("http://xn--pple-43d.com"))

    def test_shortener(self):
        self.assertIn("url_shortener", self.inspect("https://bit.ly/abc123"))

    def test_excessive_subdomains(self):
        self.assertIn("excessive_subdomains", self.inspect("http://a.b.c.d.example.com"))

    def test_suspicious_domain_word(self):
        self.assertIn("suspicious_domain_word", self.inspect("http://secure-login-bank.com"))

    def test_long_url(self):
        self.assertIn("very_long_url", self.inspect("http://example.com/" + "a" * 120))

    def test_ordinary_url_has_no_indicators(self):
        self.assertEqual(self.inspect("https://www.example.com/news/today"), [])
