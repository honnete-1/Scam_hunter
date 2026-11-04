from django.contrib.auth.models import User
from rest_framework.test import APITestCase


class AccountAPITests(APITestCase):
    def test_register_login_logout(self):
        response = self.client.post(
            "/api/accounts/register/",
            {"username": "alice", "email": "alice@example.com", "password": "S4fe-enough-pass"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("password", response.data)
        self.assertTrue(User.objects.get(username="alice").check_password("S4fe-enough-pass"))

        response = self.client.post("/api/accounts/login/", {"username": "alice", "password": "S4fe-enough-pass"}, format="json")
        self.assertEqual(response.status_code, 200)
        token = response.data["token"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        self.assertEqual(self.client.get("/api/accounts/me/").data["username"], "alice")

        self.assertEqual(self.client.post("/api/accounts/logout/").status_code, 204)
        # The old token no longer works after logout.
        self.assertEqual(self.client.get("/api/accounts/me/").status_code, 401)

    def test_wrong_password_rejected(self):
        User.objects.create_user("bob", password="S4fe-enough-pass")
        response = self.client.post("/api/accounts/login/", {"username": "bob", "password": "wrong"}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_weak_password_rejected(self):
        response = self.client.post("/api/accounts/register/", {"username": "carol", "password": "123"}, format="json")
        self.assertEqual(response.status_code, 400)
