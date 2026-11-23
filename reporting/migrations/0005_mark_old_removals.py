from django.db import migrations


def mark_removed(apps, schema_editor):
    # Before 0004, "Remove from the scam list" only switched the number's record off and left its
    # reports APPROVED, so the admin still showed them as approved. Make those reports REMOVED.
    CommunityReport = apps.get_model("reporting", "CommunityReport")
    PhoneReferenceRecord = apps.get_model("checking", "PhoneReferenceRecord")
    removed_numbers = PhoneReferenceRecord.objects.filter(active=False).values_list("phone_number", flat=True)
    CommunityReport.objects.filter(
        report_type="PHONE", status="APPROVED", phone_number__in=list(removed_numbers)
    ).update(status="REMOVED")


class Migration(migrations.Migration):

    dependencies = [
        ("reporting", "0004_removal_requests"),
        ("checking", "0002_normalize_rwanda_phone_numbers"),
    ]

    operations = [
        migrations.RunPython(mark_removed, migrations.RunPython.noop),
    ]
