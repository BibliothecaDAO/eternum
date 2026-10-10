import io
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest
import uuid

import shard


class ImageContextTest(unittest.TestCase):
    def test_atomic_credential_drafts_and_legacy_smoke_keys_never_enter_an_image(self):
        endpoint = os.environ.get("DOCKER_HOST") or subprocess.check_output(["docker", "context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], text=True).strip()
        if not endpoint.startswith("unix://"):
            raise RuntimeError("Image-context checks require a local Docker socket")
        name = "image-context-check-" + uuid.uuid4().hex
        container = None
        try:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                shutil.copyfile(shard.ROOT / "deploy/shard/Dockerfile.dockerignore", root / ".dockerignore")
                (root / "Dockerfile").write_text("FROM scratch\nCOPY . /context\n")
                (root / "public.txt").write_text("public fixture")
                public_data = root / "packages/core/src/data"
                public_data.mkdir(parents=True)
                (public_data / "realms.json").write_text("public source fixture")
                data = root / "trial/data"
                data.mkdir(parents=True)
                for filename in ("host-keys.json", "host-keys.json.123.fixture.tmp", "vrf-key.json.123.fixture.tmp", "authority.json.123.fixture.tmp", "harness.env.123.fixture.tmp", "device.json", "unusual-private-draft.tmp"):
                    (data / filename).write_text("private canary fixture")
                subprocess.run(["docker", "build", "--quiet", "--tag", name, str(root)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                container = subprocess.check_output(["docker", "create", name, "/not-executed"], text=True).strip()
                archive = subprocess.check_output(["docker", "export", container])
                names = tarfile.open(fileobj=io.BytesIO(archive)).getnames()
                self.assertIn("context/public.txt", names)
                self.assertIn("context/packages/core/src/data/realms.json", names)
                self.assertFalse(any("private canary fixture" in member.decode(errors="ignore") for member in [archive]))
                self.assertFalse(any(name.startswith("context/trial/data/") for name in names))
        finally:
            if container:
                subprocess.run(["docker", "rm", container], check=True, stdout=subprocess.DEVNULL)
            subprocess.run(["docker", "image", "rm", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
