from django.contrib.auth import get_user_model, password_validation
from rest_framework import serializers

User = get_user_model()


class RegistrationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, min_length=3, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    def validate_username(self, value):
        User._meta.get_field("username").run_validators(value)
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already in use.")
        return value

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("This email address is already in use.")
        return email

    def validate_password(self, value):
        user = User(username=self.initial_data.get("username", ""), email=self.initial_data.get("email", ""))
        password_validation.validate_password(value, user=user)
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
