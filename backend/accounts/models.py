from django.conf import settings
from django.db import models


class ExternalIdentity(models.Model):
    provider = models.CharField(max_length=30)
    subject = models.CharField(max_length=255)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="external_identities")
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("provider", "subject"), name="unique_external_identity")]
