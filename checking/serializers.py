from rest_framework import serializers

# These only check that the field was sent. Real validation is in the CheckRequest classes,
# so allow_blank=True lets empty input reach CheckRequest.validate() and get a clear error.


class MessageCheckInputSerializer(serializers.Serializer):
    message = serializers.CharField(allow_blank=True, trim_whitespace=False)


class URLCheckInputSerializer(serializers.Serializer):
    url = serializers.CharField(allow_blank=True, trim_whitespace=False)


class PhoneCheckInputSerializer(serializers.Serializer):
    phone_number = serializers.CharField(allow_blank=True, trim_whitespace=False)


class IndicatorSerializer(serializers.Serializer):
    type = serializers.CharField()
    evidence = serializers.CharField()
    explanation = serializers.CharField()


class AnalysisResultSerializer(serializers.Serializer):
    # Used to describe the response in the API docs.
    status = serializers.CharField()
    concern_level = serializers.CharField(allow_null=True)
    indicators = IndicatorSerializer(many=True)
    reference_match = serializers.BooleanField()
    explanation = serializers.CharField()
    safer_action = serializers.CharField()
