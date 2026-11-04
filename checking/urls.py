from django.urls import path

from .views import MessageCheckView, PhoneCheckView, URLCheckView

urlpatterns = [
    path("message/", MessageCheckView.as_view(), name="check-message"),
    path("url/", URLCheckView.as_view(), name="check-url"),
    path("phone/", PhoneCheckView.as_view(), name="check-phone"),
]
