#!/usr/bin/env bash
# Render runs this at every deploy (see render.yaml). It stops at the first error.
set -o errexit

# 1. Python packages
pip install -r requirements.txt

# 2. The React website, built into frontend/dist and served by Django
(cd frontend && npm ci && npm run build)

# 3. Admin and API-docs files, collected for WhiteNoise
python manage.py collectstatic --noinput

# 4. Database tables (the free plan has no pre-deploy step, so migrations run here)
python manage.py migrate --noinput

# 5. The first moderator account, from DJANGO_SUPERUSER_USERNAME / _EMAIL / _PASSWORD.
#    Skipped when those are not set; does nothing if the account already exists.
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py createsuperuser --noinput || echo "Moderator account already exists."
fi
