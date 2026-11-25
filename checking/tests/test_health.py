from rest_framework.test import APITestCase


class HealthTests(APITestCase):
    def test_answers_without_touching_the_database(self):
        # It must stay fast: its only job is to wake the server up.
        with self.assertNumQueries(0):
            response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"status": "ok"})

    def test_an_old_saved_token_does_not_block_it(self):
        # The app sends its saved token with every call; an expired one must not cause a 401 here.
        self.client.credentials(HTTP_AUTHORIZATION="Token not-a-real-token")
        self.assertEqual(self.client.get("/api/health/").status_code, 200)

    def test_only_reading_is_allowed(self):
        self.assertEqual(self.client.post("/api/health/").status_code, 405)
