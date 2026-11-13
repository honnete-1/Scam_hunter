from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import DatabaseError
from django.test import TestCase

from checking.models import PhoneReferenceRecord, URLReferenceRecord
from checking.reference_repository import LookupStatus, ReferenceRepository
from reporting.models import CommunityReport, ReportStatus


class ReferenceRepositoryTests(TestCase):
    def setUp(self):
        self.repository = ReferenceRepository()

    def test_approved_url_match_found(self):
        record = URLReferenceRecord.objects.create(url="http://fake-bank.example/login")
        result = self.repository.find_url_match("FAKE-BANK.example/login")
        self.assertEqual(result.status, LookupStatus.MATCH)
        self.assertEqual(result.match, record)

    def test_url_matches_on_domain(self):
        URLReferenceRecord.objects.create(url="http://fake-bank.example/login")
        result = self.repository.find_url_match("https://www.fake-bank.example/other-page")
        self.assertEqual(result.status, LookupStatus.MATCH)

    def test_rwanda_number_matches_in_every_common_format(self):
        # The mobile app and website may send the number in any of these forms.
        record = PhoneReferenceRecord.objects.create(phone_number="0788 123 456")
        self.assertEqual(record.phone_number, "+250788123456")
        for raw in ["0788123456", "+250 788 123 456", "+250788123456", "250788123456"]:
            with self.subTest(phone=raw):
                result = self.repository.find_phone_match(raw)
                self.assertEqual(result.status, LookupStatus.MATCH)
                self.assertEqual(result.match, record)

    def test_approved_phone_match_found(self):
        record = PhoneReferenceRecord.objects.create(phone_number="+250 788 000 111")
        result = self.repository.find_phone_match("00250-788-000-111")
        self.assertEqual(result.status, LookupStatus.MATCH)
        self.assertEqual(result.match, record)

    def test_successful_no_match(self):
        URLReferenceRecord.objects.create(url="http://fake-bank.example")
        url_result = self.repository.find_url_match("https://example.org")
        phone_result = self.repository.find_phone_match("+250788999999")

        for result in (url_result, phone_result):
            self.assertEqual(result.status, LookupStatus.NO_MATCH)
            self.assertIsNone(result.match)
            self.assertTrue(result.completed)

    def test_inactive_record_not_matched(self):
        PhoneReferenceRecord.objects.create(phone_number="+250788000111", active=False)
        self.assertEqual(self.repository.find_phone_match("+250788000111").status, LookupStatus.NO_MATCH)

    def test_record_linked_to_unapproved_report_not_matched(self):
        # Even if a record somehow points at a pending report, it must be ignored.
        user = User.objects.create_user("reporter", password="x")
        report = CommunityReport.objects.create(
            submitted_by=user, report_type="PHONE", content="+250788000111", status=ReportStatus.PENDING
        )
        PhoneReferenceRecord.objects.create(phone_number="+250788000111", source_report=report)
        self.assertEqual(self.repository.find_phone_match("+250788000111").status, LookupStatus.NO_MATCH)

    def test_lookup_failure_is_unavailable_not_no_match(self):
        with patch("checking.reference_repository.approved_only", side_effect=DatabaseError("database is locked")):
            url_result = self.repository.find_url_match("http://example.com")
            phone_result = self.repository.find_phone_match("+250788123456")

        for result in (url_result, phone_result):
            self.assertEqual(result.status, LookupStatus.UNAVAILABLE)
            self.assertNotEqual(result.status, LookupStatus.NO_MATCH)
            self.assertFalse(result.completed)
            self.assertIn("database is locked", result.error)
