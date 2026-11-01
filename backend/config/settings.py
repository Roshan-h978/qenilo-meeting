import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DEBUG = os.getenv("DJANGO_DEBUG", "false").strip().lower() in {"1", "true", "yes"}
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "development-only-change-before-deploy")
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "").strip()
STUN_SERVER_URLS = [url.strip() for url in os.getenv("STUN_SERVER_URLS", "stun:stun.l.google.com:19302,stun:stun.cloudflare.com:3478").split(",") if url.strip()]
TURN_URLS = [url.strip() for url in os.getenv("TURN_URLS", "").split(",") if url.strip()]
TURN_SHARED_SECRET = os.getenv("TURN_SHARED_SECRET", "").strip()
TURN_CREDENTIAL_TTL_SECONDS = max(300, int(os.getenv("TURN_CREDENTIAL_TTL_SECONDS", "3600")))
CLOUDFLARE_TURN_KEY_ID = os.getenv("CLOUDFLARE_TURN_KEY_ID", "").strip()
CLOUDFLARE_TURN_API_TOKEN = os.getenv("CLOUDFLARE_TURN_API_TOKEN", "").strip()
if not DEBUG and SECRET_KEY == "development-only-change-before-deploy":
    raise ImproperlyConfigured("Set DJANGO_SECRET_KEY before running with DJANGO_DEBUG=false.")

ALLOWED_HOSTS = [host.strip() for host in os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if host.strip()]

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "channels",
    "corsheaders",
    "api",
    "accounts",
    "meetings",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASE_URL = os.getenv("DATABASE_URL")
if not DEBUG and not DATABASE_URL:
    raise ImproperlyConfigured("Set DATABASE_URL before running with DJANGO_DEBUG=false.")
DATABASES = {
    "default": dj_database_url.parse(DATABASE_URL, conn_max_age=600) if DATABASE_URL else {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

REDIS_URL = os.getenv("REDIS_URL")
if not DEBUG and not REDIS_URL:
    raise ImproperlyConfigured("Set REDIS_URL before running Channels with DJANGO_DEBUG=false.")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    } if REDIS_URL else {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    } if REDIS_URL else {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "qenilo-local-security-cache",
    }
}

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5174,http://127.0.0.1:5174").split(",")
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": os.getenv("AUTH_LOGIN_RATE", "5/min"),
        "auth_register": os.getenv("AUTH_REGISTER_RATE", "5/hour"),
        "auth_google": os.getenv("AUTH_GOOGLE_RATE", "10/min"),
    },
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]

SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
if os.getenv("DJANGO_TRUST_X_FORWARDED_PROTO", "false").strip().lower() in {"1", "true", "yes"}:
    # Enable only when the app is behind a trusted proxy that overwrites this header.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "Asia/Kathmandu")
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
