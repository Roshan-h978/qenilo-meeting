from django.urls import path

from accounts.views import current_user, csrf_token, google_sign_in, register, sign_in, sign_out

urlpatterns = [
    path("csrf/", csrf_token, name="auth-csrf"),
    path("register/", register, name="auth-register"),
    path("login/", sign_in, name="auth-login"),
    path("google/", google_sign_in, name="auth-google"),
    path("logout/", sign_out, name="auth-logout"),
    path("me/", current_user, name="auth-current-user"),
]
