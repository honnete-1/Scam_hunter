from django.contrib import admin

from .models import PhoneReferenceRecord, URLReferenceRecord


@admin.register(URLReferenceRecord)
class URLReferenceRecordAdmin(admin.ModelAdmin):
    list_display = ("url", "domain", "source", "source_report", "active", "approved_at")
    list_filter = ("active", "source")
    search_fields = ("url", "domain")
    # The domain is worked out from the URL when saving, so it is not typed in.
    readonly_fields = ("domain", "created_at")


@admin.register(PhoneReferenceRecord)
class PhoneReferenceRecordAdmin(admin.ModelAdmin):
    list_display = ("phone_number", "source", "source_report", "active", "approved_at")
    list_filter = ("active", "source")
    search_fields = ("phone_number",)
    readonly_fields = ("created_at",)
