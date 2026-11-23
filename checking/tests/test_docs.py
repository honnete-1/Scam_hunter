from django.test import TestCase


class APIDocumentationTests(TestCase):
    def test_reference_is_served_at_the_root(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "redoc")

    def test_swagger_ui_is_available(self):
        self.assertEqual(self.client.get("/api/docs/").status_code, 200)

    def test_schema_documents_every_endpoint_with_a_tag_and_summary(self):
        schema = self.client.get("/api/schema/", HTTP_ACCEPT="application/json").json()
        self.assertEqual(schema["info"]["title"], "Scam Hunter API")
        self.assertEqual({tag["name"] for tag in schema["tags"]}, {"Checks", "Community reports", "Moderation", "Accounts", "App"})
        for path, operations in schema["paths"].items():
            for method, operation in operations.items():
                with self.subTest(path=path, method=method):
                    self.assertTrue(operation.get("tags"))
                    self.assertTrue(operation.get("summary"))

    def test_check_endpoints_document_the_unavailable_response(self):
        schema = self.client.get("/api/schema/", HTTP_ACCEPT="application/json").json()
        for path in ["/api/check/message/", "/api/check/url/", "/api/check/phone/"]:
            with self.subTest(path=path):
                responses = schema["paths"][path]["post"]["responses"]
                self.assertEqual(set(responses), {"200", "400", "503"})
