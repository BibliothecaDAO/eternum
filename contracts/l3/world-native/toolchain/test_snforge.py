#!/usr/bin/env python3
"""Exercise installation failures and the supported entrypoints without compiling contracts."""

import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import snforge


class RunnerInstallationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.environment = patch.dict(os.environ, {"XDG_DATA_HOME": str(self.root / "data")})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.spec = snforge.identity()
        self.directory = snforge.install_directory(self.spec)
        self.candidate = self.root / "candidate"
        self.write_candidate("original")

    def write_candidate(self, marker, version="0.64.0", padding=0):
        self.candidate.write_text(
            f'#!/bin/sh\nif [ "$1" = --version ]; then echo "snforge {version}"; else echo "{marker}:$*"; fi\n'
            + "#" * padding + "\n"
        )
        self.candidate.chmod(0o755)

    def publish(self):
        return snforge.publish(self.candidate, self.directory, self.spec)

    def test_publish_replace_and_unchanged_setup(self):
        binary = self.publish()
        self.assertEqual(snforge.resolve(), binary)
        self.write_candidate("replacement")
        self.publish()
        self.assertEqual(subprocess.check_output([binary, "test"], text=True).strip(), "replacement:test")
        before = binary.stat()
        with patch.object(snforge, "run", side_effect=AssertionError("unchanged setup must not build")):
            self.assertEqual(snforge.build(), binary)
        self.assertEqual((binary.stat().st_ino, binary.stat().st_mtime_ns), (before.st_ino, before.st_mtime_ns))

    def test_invalid_candidate_keeps_previous_install(self):
        binary = self.publish()
        previous = binary.read_bytes()
        manifest = (self.directory / "manifest.json").read_bytes()
        self.write_candidate("invalid", version="0.1.0")
        with self.assertRaises(ValueError):
            self.publish()
        self.assertEqual(binary.read_bytes(), previous)
        self.assertEqual((self.directory / "manifest.json").read_bytes(), manifest)
        self.assertEqual(snforge.resolve(), binary)

    def test_interrupted_copy_keeps_previous_install(self):
        binary = self.publish()
        previous = binary.read_bytes()
        manifest = (self.directory / "manifest.json").read_bytes()
        self.write_candidate("oversized", padding=8192)
        script = '''
import json, resource, signal, sys
from pathlib import Path
import snforge
signal.signal(signal.SIGXFSZ, signal.SIG_IGN)
resource.setrlimit(resource.RLIMIT_FSIZE, (1024, 1024))
snforge.publish(Path(sys.argv[1]), Path(sys.argv[2]), json.loads(sys.argv[3]))
'''
        result = subprocess.run([sys.executable, "-c", script, str(self.candidate), str(self.directory),
                                 json.dumps(self.spec)], cwd=Path(snforge.__file__).parent, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"File too large", result.stderr)
        self.assertEqual(binary.read_bytes(), previous)
        self.assertEqual((self.directory / "manifest.json").read_bytes(), manifest)
        self.assertEqual(subprocess.check_output([binary, "test"], text=True).strip(), "original:test")
        self.assertEqual(snforge.resolve(), binary)
        self.assertEqual(list(self.directory.glob(".install-*")), [])

    def test_interrupted_manifest_publication_refuses_then_repairs(self):
        binary = self.publish()
        self.write_candidate("replacement")
        replace = os.replace

        def interrupt_manifest(source, destination):
            if Path(destination).name == "manifest.json":
                raise OSError("publication interrupted")
            return replace(source, destination)

        with patch.object(snforge.os, "replace", side_effect=interrupt_manifest):
            with self.assertRaisesRegex(OSError, "publication interrupted"):
                self.publish()
        self.assertEqual(subprocess.check_output([binary, "test"], text=True).strip(), "replacement:test")
        with self.assertRaisesRegex(RuntimeError, "Missing or stale"):
            snforge.resolve()
        self.publish()
        self.assertEqual(snforge.resolve(), binary)

    def test_same_version_replacement_is_rejected(self):
        binary = self.publish()
        self.write_candidate("older-same-version")
        shutil.copyfile(self.candidate, binary)
        self.assertEqual(subprocess.check_output([binary, "--version"], text=True).strip(), "snforge 0.64.0")
        with self.assertRaisesRegex(RuntimeError, "Missing or stale"):
            snforge.resolve()

    def test_source_patches_and_toolchain_select_different_install(self):
        self.publish()
        with patch.object(snforge, "SOURCE", "0" * 40):
            with self.assertRaisesRegex(RuntimeError, "Missing or stale"):
                snforge.resolve()
        copy = self.root / "world"
        (copy / "toolchain").mkdir(parents=True)
        for name in snforge.PATCHES:
            shutil.copyfile(snforge.WORLD / "toolchain" / name, copy / "toolchain" / name)
        shutil.copyfile(snforge.WORLD / ".tool-versions", copy / ".tool-versions")
        for changed in [*(copy / "toolchain" / name for name in snforge.PATCHES), copy / ".tool-versions"]:
            original = changed.read_bytes()
            changed.write_bytes(original + b"\n")
            with patch.object(snforge, "WORLD", copy):
                with self.assertRaisesRegex(RuntimeError, "Missing or stale"):
                    snforge.resolve()
            changed.write_bytes(original)
        with patch.object(snforge, "RUST", "0.0.0"):
            with self.assertRaisesRegex(RuntimeError, "Missing or stale"):
                snforge.resolve()

    def test_missing_install_stops_entrypoints_before_external_work(self):
        marker = self.root / "external-work"
        tools = self.root / "tools"
        tools.mkdir()
        for name in ("snforge", "scarb", "bun", "pnpm"):
            executable = tools / name
            executable.write_text(f'#!/bin/sh\necho {name} >> "{marker}"\nexit 97\n')
            executable.chmod(0o755)
        env = {**os.environ, "PATH": f"{tools}:{os.environ['PATH']}"}
        native = snforge.WORLD.parent
        for entrypoint in (native / "test-native.sh", native / "check-native.sh"):
            result = subprocess.run(["bash", str(entrypoint)], env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Missing or stale native runner", result.stderr)
        self.assertFalse(marker.exists())
        producer = snforge.WORLD / "scripts/generate-lords-budget-fixtures.py"
        module_spec = importlib.util.spec_from_file_location("budget_producer", producer)
        module = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(module)
        module.INPUT = self.root / "checkpoint-input"
        with patch.dict(os.environ, env):
            with self.assertRaises(subprocess.CalledProcessError):
                module.record_chunk(2000, 0, False, 100, 105, None)
        self.assertFalse(module.INPUT.exists())
        self.assertFalse(marker.exists())


if __name__ == "__main__":
    unittest.main()
