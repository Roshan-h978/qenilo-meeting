from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase
from django.test import override_settings
from unittest.mock import patch

User = get_user_model()


class AuthenticationApiTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.csrf_token = self.client.get("/api/auth/csrf/").json()["csrfToken"]

    def post(self, path, data):
        return self.client.post(path, data, content_type="application/json", HTTP_X_CSRFTOKEN=self.csrf_token)

    def test_register_creates_user_and_starts_session(self):
        response = self.post("/api/auth/register/", {
            "username": "test-user",
            "email": "user@example.com",
            "password": "use-a-unique-strong-password-482!",
        })

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="test-user")
        self.assertTrue(user.check_password("use-a-unique-strong-password-482!"))
        self.assertTrue(user.password.startswith("argon2$"))
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)

    def test_login_rejects_non_string_identifier_without_server_error(self):
        response = self.post("/api/auth/login/", {
            "identifier": ["unexpected", "list"],
            "password": "example-password",
        })
        self.assertEqual(response.status_code, 400)

    def test_login_is_rate_limited(self):
        cache.clear()
        credentials = {"identifier": "missing-user", "password": "wrong-password"}
        for _ in range(5):
            self.assertEqual(self.post("/api/auth/login/", credentials).status_code, 401)
        self.assertEqual(self.post("/api/auth/login/", credentials).status_code, 429)
        cache.clear()

    def test_registration_rejects_missing_csrf_token(self):
        response = self.client.post(
            "/api/auth/register/",
            {"username": "test-user", "email": "user@example.com", "password": "use-a-unique-strong-password-482!"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_login_rejects_missing_csrf_token(self):
        response = self.client.post(
            "/api/auth/login/",
            {"identifier": "test-user", "password": "use-a-unique-strong-password-482!"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_user_endpoint_requires_authentication(self):
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 403)

    def test_login_accepts_email_and_logout_clears_session(self):
        User.objects.create_user(username="test-user", email="user@example.com", password="use-a-unique-strong-password-482!")

        response = self.post("/api/auth/login/", {"identifier": "user@example.com", "password": "use-a-unique-strong-password-482!"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)
        self.csrf_token = self.client.get("/api/auth/csrf/").json()["csrfToken"]
        self.assertEqual(self.post("/api/auth/logout/", {}).status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 403)


@override_settings(GOOGLE_OAUTH_CLIENT_ID="qenilo-google-client-id.apps.googleusercontent.com")
class GoogleSignInApiTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.csrf_token = self.client.get("/api/auth/csrf/").json()["csrfToken"]

    def sign_in(self, credential="test-google-id-token"):
        return self.client.post(
            "/api/auth/google/",
            {"credential": credential},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

    @patch("accounts.views.id_token.verify_oauth2_token")
    def test_google_sign_in_creates_and_reuses_verified_identity(self, verify_token):
        verify_token.return_value = {
            "sub": "google-subject-123456789",
            "email": "person@example.com",
            "email_verified": True,
        }

        first_response = self.sign_in()
        self.csrf_token = self.client.get("/api/auth/csrf/").json()["csrfToken"]
        second_response = self.sign_in()

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(first_response.json()["user"]["id"], second_response.json()["user"]["id"])
        self.assertEqual(User.objects.filter(email="person@example.com").count(), 1)
        self.assertFalse(User.objects.get(email="person@example.com").has_usable_password())
        self.assertEqual(verify_token.call_args.args[0], "test-google-id-token")
        self.assertEqual(verify_token.call_args.kwargs["audience"], "qenilo-google-client-id.apps.googleusercontent.com")

    @patch("accounts.views.id_token.verify_oauth2_token")
    def test_google_sign_in_rejects_unverified_email(self, verify_token):
        verify_token.return_value = {
            "sub": "google-subject-unverified",
            "email": "person@example.com",
            "email_verified": False,
        }
        response = self.sign_in()
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="person@example.com").exists())

    @patch("accounts.views.id_token.verify_oauth2_token")
    def test_google_sign_in_rejects_invalid_credential(self, verify_token):
        verify_token.side_effect = ValueError("Invalid token")
        self.assertEqual(self.sign_in().status_code, 401)

    @patch("accounts.views.id_token.verify_oauth2_token")
    def test_google_sign_in_does_not_silently_link_existing_email(self, verify_token):
        User.objects.create_user(username="existing", email="person@example.com", password="local-password")
        verify_token.return_value = {
            "sub": "google-subject-existing-email",
            "email": "person@example.com",
            "email_verified": True,
        }
        response = self.sign_in()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(User.objects.count(), 1)

    def test_google_sign_in_requires_csrf(self):
        response = self.client.post(
            "/api/auth/google/",
            {"credential": "test-google-id-token"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)
