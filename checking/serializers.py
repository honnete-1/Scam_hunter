from rest_framework import serializers

# These only check that the field was sent. Real validation is in the CheckRequest classes,
# so allow_blank=True lets empty input reach CheckRequest.validate() and get a clear error.


class MessageCheckInputSerializer(serializers.Serializer):
    message = serializers.CharField(
        allow_blank=True, trim_whitespace=False, help_text="The suspicious message, pasted as received (max 5000 characters)."
    )


class URLCheckInputSerializer(serializers.Serializer):
    url = serializers.CharField(
        allow_blank=True, trim_whitespace=False, help_text="The suspicious link. http:// is assumed if no scheme is given."
    )


class PhoneCheckInputSerializer(serializers.Serializer):
    phone_number = serializers.CharField(
        allow_blank=True,
        trim_whitespace=False,
        help_text="The phone number. Rwanda numbers in any common format (0788…, 250788…, +250 788…) match the same record.",
    )


# The serializers below only describe responses for the API documentation.

class IndicatorSerializer(serializers.Serializer):
    type = serializers.CharField(help_text="Warning category, e.g. urgency, payment_request, ai_assessment, known_malicious_link.")
    evidence = serializers.CharField(help_text="The short phrase or finding that triggered it.")
    explanation = serializers.CharField(help_text="Plain-language explanation for the user.")


class CheckRowSerializer(serializers.Serializer):
    id = serializers.CharField(help_text="rules, reference, community, ai, safe_browsing, urlhaus or domain_age.")
    label = serializers.CharField(help_text="Display name of the check.")
    status = serializers.ChoiceField(choices=["COMPLETED", "NOT_CONFIGURED", "UNAVAILABLE"])
    finding = serializers.BooleanField(help_text="True when this check found a warning sign.")
    detail = serializers.CharField(help_text="Extra detail, e.g. the AI's reason or a website's age.")


class ReputationSerializer(serializers.Serializer):
    approved_reports = serializers.IntegerField(help_text="Moderator-approved community reports naming this number.")
    first_reported = serializers.DateField(allow_null=True, help_text="Date of the first approved report.")


class EnglishTextSerializer(serializers.Serializer):
    headline = serializers.CharField()
    explanation = serializers.CharField()
    safer_action = serializers.CharField()


class AnalysisResultSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=["SUCCESS", "CHECK_UNAVAILABLE"],
        help_text="CHECK_UNAVAILABLE means a required lookup failed. It is never a safe result.",
    )
    concern_level = serializers.ChoiceField(
        choices=["HIGH_CONCERN", "CAUTION", "NO_KNOWN_WARNING_SIGNS"],
        allow_null=True,
        help_text="null when the check could not be completed.",
    )
    indicators = IndicatorSerializer(many=True, help_text="One entry per warning category found.")
    reference_match = serializers.BooleanField(help_text="True when an approved suspicious record matched.")
    explanation = serializers.CharField(help_text="One or two sentences explaining the result.")
    safer_action = serializers.CharField(help_text="What the user should do next.")
    checks = CheckRowSerializer(many=True, help_text="Every check that ran, including ones not set up or unavailable.")
    reputation = ReputationSerializer(allow_null=True, help_text="Phone checks only: community reputation of the number.")
    ai_score = serializers.IntegerField(
        allow_null=True, min_value=0, max_value=100,
        help_text="Messages only: the AI model's scam-likelihood (0–100), or null if the AI did not run.",
    )
    headline = serializers.CharField(help_text="Short title of the result, e.g. for a phone notification.")
    language = serializers.CharField(
        allow_null=True,
        help_text="Messages only: language of the message (ISO 639-1, e.g. rw, fr), detected by the AI; null if unknown.",
    )
    english = EnglishTextSerializer(
        allow_null=True,
        help_text="Set when headline, explanation, safer_action and indicator explanations were translated into the "
                  "message's language; holds the English originals.",
    )


class InvalidInputSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["INVALID_INPUT"])
    concern_level = serializers.CharField(allow_null=True, help_text="Always null for invalid input.")
    errors = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()),
        help_text='Messages per field, e.g. {"url": ["Enter a valid URL, for example https://example.com."]}.',
    )
