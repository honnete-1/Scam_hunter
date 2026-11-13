from django.test import SimpleTestCase

from checking.requests import (
    CheckRequest,
    CheckValidationError,
    MessageCheck,
    PhoneCheck,
    URLCheck,
    extract_domain,
    normalize_phone_number,
    normalize_url,
)


class MessageCheckValidationTests(SimpleTestCase):
    def test_empty_message_rejected(self):
        with self.assertRaises(CheckValidationError):
            MessageCheck("").validate()

    def test_whitespace_only_message_rejected(self):
        with self.assertRaises(CheckValidationError):
            MessageCheck("   \n\t ").validate()

    def test_too_long_message_rejected(self):
        with self.assertRaises(CheckValidationError):
            MessageCheck("a" * 5001).validate()

    def test_non_string_rejected(self):
        with self.assertRaises(CheckValidationError):
            MessageCheck(None).validate()

    def test_message_normalization_collapses_whitespace(self):
        check = MessageCheck("  Hello \n\n  there  ")
        check.validate()
        self.assertEqual(check.normalize(), "Hello there")

    def test_specialised_checks_inherit_from_check_request(self):
        for check_class in (MessageCheck, URLCheck, PhoneCheck):
            self.assertTrue(issubclass(check_class, CheckRequest))


class URLCheckValidationTests(SimpleTestCase):
    def test_invalid_urls_rejected(self):
        for bad in ["", "   ", "not a url", "hello", "ftp://example.com", "http://", "http://exa mple.com",
                    "javascript:alert(1)", "http://example.com:abc"]:
            with self.subTest(url=bad):
                with self.assertRaises(CheckValidationError):
                    URLCheck(bad).validate()

    def test_url_without_scheme_gets_http(self):
        self.assertEqual(normalize_url("example.com/login"), "http://example.com/login")

    def test_url_normalization(self):
        self.assertEqual(
            normalize_url("  HTTPS://WWW.Example.COM:443/Path/?a=1#section "),
            "https://www.example.com/Path?a=1",
        )

    def test_non_default_port_kept(self):
        self.assertEqual(normalize_url("http://example.com:8080/"), "http://example.com:8080")

    def test_ip_address_url_is_valid(self):
        self.assertEqual(normalize_url("http://192.168.1.10/login"), "http://192.168.1.10/login")

    def test_international_domain_converted_to_punycode(self):
        # The first "а" is a Cyrillic letter that looks like a Latin "a".
        self.assertIn("xn--", normalize_url("http://аpple.com"))

    def test_extract_domain_removes_www(self):
        self.assertEqual(extract_domain("https://www.example.com/login"), "example.com")
        self.assertEqual(extract_domain("mail.example.com"), "mail.example.com")

    def test_url_check_sets_domain(self):
        check = URLCheck("https://www.Bank-Example.com/x")
        check.validate()
        check.normalize()
        self.assertEqual(check.domain, "bank-example.com")


class PhoneCheckValidationTests(SimpleTestCase):
    def test_invalid_phone_numbers_rejected(self):
        for bad in ["", "   ", "abc123", "12345", "+1234567890123456", "07a8 123 456", "++250788123456"]:
            with self.subTest(phone=bad):
                with self.assertRaises(CheckValidationError):
                    PhoneCheck(bad).validate()

    def test_formatting_differences_normalize_to_same_value(self):
        expected = "+250788123456"
        for raw in ["+250 788 123 456", "+250-788-123-456", "(+250) 788.123.456", "00250788123456"]:
            with self.subTest(phone=raw):
                self.assertEqual(normalize_phone_number(raw), expected)

    def test_rwanda_formats_normalize_to_one_canonical_value(self):
        for raw in ["0788 123 456", "0788123456", "+250 788 123 456", "+250788123456", "250788123456",
                    "0788-123-456", "00250 788 123 456"]:
            with self.subTest(phone=raw):
                self.assertEqual(normalize_phone_number(raw), "+250788123456")

    def test_all_rwanda_mobile_prefixes(self):
        for local, canonical in [("0722123456", "+250722123456"), ("0731234567", "+250731234567"),
                                 ("0781234567", "+250781234567"), ("0791234567", "+250791234567")]:
            with self.subTest(phone=local):
                self.assertEqual(normalize_phone_number(local), canonical)

    def test_other_numbers_are_not_turned_into_rwanda_numbers(self):
        for raw, expected in [
            ("+254712345678", "+254712345678"),  # Kenya stays Kenya
            ("+14155552671", "+14155552671"),
            ("0712345678", "0712345678"),  # 071 is not a Rwanda mobile prefix, so it is left alone
            ("250712345678", "250712345678"),
            ("2507881234567", "2507881234567"),  # one digit too many to be a Rwanda mobile number
        ]:
            with self.subTest(phone=raw):
                self.assertEqual(normalize_phone_number(raw), expected)
