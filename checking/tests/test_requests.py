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

    def test_local_number_kept_as_digits(self):
        self.assertEqual(normalize_phone_number("0788 123 456"), "0788123456")
