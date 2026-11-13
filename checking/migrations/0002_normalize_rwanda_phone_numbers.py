import re

from django.db import migrations

# Same rules as normalize_phone_number(), copied here so this migration never changes later.
RWANDA_LOCAL_MOBILE = re.compile(r"^07[2389]\d{7}$")
RWANDA_MOBILE_WITHOUT_PLUS = re.compile(r"^2507[2389]\d{7}$")


def to_canonical(number):
    if RWANDA_LOCAL_MOBILE.match(number):
        return "+250" + number[1:]
    if RWANDA_MOBILE_WITHOUT_PLUS.match(number):
        return "+" + number
    return number


def normalize_existing_records(apps, schema_editor):
    PhoneReferenceRecord = apps.get_model("checking", "PhoneReferenceRecord")
    for record in PhoneReferenceRecord.objects.all():
        canonical = to_canonical(record.phone_number)
        if canonical == record.phone_number:
            continue
        # If the +250 version already exists, keep that one and leave this old row unchanged.
        if PhoneReferenceRecord.objects.filter(phone_number=canonical).exists():
            continue
        record.phone_number = canonical
        record.save(update_fields=["phone_number"])


class Migration(migrations.Migration):
    dependencies = [
        ("checking", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(normalize_existing_records, migrations.RunPython.noop),
    ]
