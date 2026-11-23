# Keeps uploaded files (removal-request proofs) inside the database instead of on disk.
# Render's free servers start with an empty disk at every deploy, so files saved there would
# disappear; the database keeps them. Proofs are small (at most 5 MB) and few, so this is fine.

from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class DatabaseStorage(Storage):
    def _model(self):
        from .models import StoredFile

        return StoredFile

    def _open(self, name, mode="rb"):
        try:
            stored = self._model().objects.get(name=name)
        except self._model().DoesNotExist:
            raise FileNotFoundError(name)
        return ContentFile(bytes(stored.content), name=name)

    def _save(self, name, content):
        content.seek(0)
        data = b"".join(content.chunks())
        self._model().objects.create(name=name, content=data, size=len(data))
        return name

    def exists(self, name):
        return self._model().objects.filter(name=name).exists()

    def delete(self, name):
        self._model().objects.filter(name=name).delete()

    def size(self, name):
        stored = self._model().objects.filter(name=name).values_list("size", flat=True).first()
        if stored is None:
            raise FileNotFoundError(name)
        return stored

    def url(self, name):
        # Proofs are private: there is no public URL. Moderators open them through the admin.
        raise NotImplementedError("Stored files have no public URL.")
