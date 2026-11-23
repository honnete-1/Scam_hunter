# Django settings for the Scam Hunter project.

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# API keys and other private settings live in a .env file next to manage.py (see .env.example).
load_dotenv(BASE_DIR / '.env')


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
# Render sets RENDER=true on its servers. There the defaults are the safe production ones.
ON_RENDER = 'RENDER' in os.environ

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DJANGO_DEBUG', 'False' if ON_RENDER else 'True') == 'True'

# The key can be overridden with an environment variable outside local development.
# In production it must come from the environment (Render generates one).
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError('Set DJANGO_SECRET_KEY when DEBUG is off.')
    SECRET_KEY = 'django-insecure-pso8^z(e1_6dy2eu1mzsuul6fvn4(0#pdko$$45bf=y2n*i6a3'

# Extra hosts (e.g. your computer's LAN IP for a phone running Expo Go) can be added as a
# comma-separated list. 10.0.2.2 is how the Android emulator reaches this computer.
ALLOWED_HOSTS = ['localhost', '127.0.0.1'] + (['10.0.2.2'] if DEBUG else [])
ALLOWED_HOSTS += [host.strip() for host in os.environ.get('DJANGO_ALLOWED_HOSTS', '').split(',') if host.strip()]
# Render gives each service a public address such as scam-hunter.onrender.com.
RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME', '')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# The admin login form posts over HTTPS from the public address.
CSRF_TRUSTED_ORIGINS = [f'https://{host}' for host in ALLOWED_HOSTS if host not in ('localhost', '127.0.0.1', '10.0.2.2')]

if not DEBUG:
    # Render ends HTTPS at its proxy and tells Django with this header.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

# Only needed when the mobile app runs in a web browser (Expo web). Native apps don't use CORS.
# Example: DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:8081
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in os.environ.get('DJANGO_CORS_ALLOWED_ORIGINS', '').split(',') if origin.strip()]

# Set to True only for demos/testing: every reference lookup then fails with CHECK_UNAVAILABLE.
SIMULATE_REFERENCE_OUTAGE = os.environ.get('SIMULATE_REFERENCE_OUTAGE', 'False') == 'True'

# Optional online checks (AI, link reputation, domain age). They are always off while tests
# run, so tests never call the internet or use up free API limits.
RUNNING_TESTS = len(sys.argv) > 1 and sys.argv[1] == 'test'
ONLINE_CHECKS_ENABLED = os.environ.get('SCAM_HUNTER_ONLINE_CHECKS', 'True') == 'True' and not RUNNING_TESTS

# AI second opinion: any OpenAI-compatible API. Defaults to Groq's free tier.
AI_API_KEY = os.environ.get('SCAM_HUNTER_AI_API_KEY', '')
AI_BASE_URL = os.environ.get('SCAM_HUNTER_AI_BASE_URL', 'https://api.groq.com/openai/v1')
AI_MODEL = os.environ.get('SCAM_HUNTER_AI_MODEL', 'openai/gpt-oss-20b')

# Link reputation services (free keys, non-commercial use).
GOOGLE_SAFE_BROWSING_API_KEY = os.environ.get('GOOGLE_SAFE_BROWSING_API_KEY', '')
URLHAUS_AUTH_KEY = os.environ.get('URLHAUS_AUTH_KEY', '')


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'rest_framework.authtoken',
    'drf_spectacular',
    'drf_spectacular_sidecar',
    'corsheaders',

    # Scam Hunter apps
    'accounts',
    'checking',
    'reporting',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # Serves the admin/API-docs files and the built website without a separate web server.
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

# The website and the Android app both use this one database through the Django API.
# PostgreSQL when DATABASE_URL is set (postgres://user:password@host:port/name, kept in .env),
# otherwise the SQLite file, which is enough for a quick local try-out.
DATABASE_URL = os.environ.get('DATABASE_URL', '')


def database_from_url(url):
    from urllib.parse import unquote, urlparse

    parts = urlparse(url)
    if parts.scheme not in ('postgres', 'postgresql'):
        raise ValueError('DATABASE_URL must start with postgres:// or postgresql://')
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': unquote(parts.path.lstrip('/')),
        'USER': unquote(parts.username or ''),
        'PASSWORD': unquote(parts.password or ''),
        'HOST': parts.hostname or 'localhost',
        'PORT': str(parts.port or 5432),
        # Reuse connections for a minute instead of reconnecting on every request.
        'CONN_MAX_AGE': 60,
    }


if DATABASE_URL:
    DATABASES = {'default': database_from_url(DATABASE_URL)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# The built React website (npm run build in frontend/). In production Django serves it too,
# so the website, the API and the admin share one address. Locally, Vite serves it instead.
FRONTEND_DIST = BASE_DIR / 'frontend' / 'dist'
SERVE_FRONTEND = os.environ.get('SCAM_HUNTER_SERVE_FRONTEND', 'False' if DEBUG else 'True') == 'True'
if SERVE_FRONTEND and FRONTEND_DIST.exists():
    # Files such as /assets/index-1a2b.js, /favicon.svg and the demo video.
    WHITENOISE_ROOT = FRONTEND_DIST

# Uploaded files (proofs sent with removal requests) are kept in the database, not on disk:
# Render's free servers lose their disk at every deploy. They are private: no URL serves them;
# moderators open a proof only through the admin.
STORAGES = {
    'default': {'BACKEND': 'reporting.storage.DatabaseStorage'},
    'staticfiles': {
        'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage' if DEBUG
        else 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}
MEDIA_ROOT = Path(os.environ.get('SCAM_HUNTER_MEDIA_ROOT', BASE_DIR / 'media'))
# Proof photos can be a few MB.
DATA_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Django REST Framework
# Token auth is for the mobile app later; session auth lets the browsable API and admin work.
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# API documentation, served at / (ReDoc) and /api/docs/ (interactive Swagger UI).
SPECTACULAR_SETTINGS = {
    'TITLE': 'Scam Hunter API',
    'DESCRIPTION': (BASE_DIR / 'config' / 'api_description.md').read_text(encoding='utf-8'),
    'VERSION': '2.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'TAGS': [
        {'name': 'Checks', 'description': 'Check a message, link or phone number. No account needed; nothing is stored.'},
        {'name': 'Community reports', 'description': 'Submit reports, list your own, and read the public alerts feed and statistics.'},
        {'name': 'Removal requests', 'description': 'The owner of a wrongly reported number asks to be taken off the scam list, with proof.'},
        {'name': 'Moderation', 'description': 'Staff only. Approve or reject pending reports. Approved links and numbers become reference records.'},
        {'name': 'Accounts', 'description': 'Sign up, log in to get a token, log out and read your profile.'},
        {'name': 'App', 'description': 'The newest Android app build, for the download button and QR code.'},
    ],
    # The documentation pages load their scripts from this server, so they work offline too.
    'SWAGGER_UI_DIST': 'SIDECAR',
    'SWAGGER_UI_FAVICON_HREF': 'SIDECAR',
    'REDOC_DIST': 'SIDECAR',
}

# Where publish_android_build saves the newest APK link (machine-specific, so not in git).
ANDROID_RELEASE_FILE = Path(os.environ.get('SCAM_HUNTER_ANDROID_RELEASE_FILE', BASE_DIR / 'android_release.json'))
