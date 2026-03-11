# Onchain Agent Public Release - PRD + TDD

Status: Draft Owner: Agent Platform Target branch: `next` Primary app: `client/apps/onchain-agent`

## 1. Summary

Ship the Eternum onchain agent as a public CLI product with:

1. Cross-platform prebuilt binaries published to GitHub Releases.
2. A `curl | sh` installer for macOS and Linux.
3. A stable runtime layout that does not require the monorepo checkout.
4. CI gates and release automation that produce verifiable, reproducible artifacts.

This document combines product requirements and technical design, then defines a test-driven delivery plan.

## 2. Problem

Current `onchain-agent` usage is dev-mode only:

1. App is private (`client/apps/onchain-agent/package.json` has `"private": true`).
2. Runtime entrypoint is `tsx` (`dev` script), not a distributable CLI binary.
3. Default config is repo-relative (`client/apps/onchain-agent/src/config.ts` default `MANIFEST_PATH`).
4. No public release workflow exists in root `.github/workflows`.
5. Public users currently need repo context and local build assumptions.

Result: high setup friction, low reproducibility, no clean public install path.

## 3. Goals

### 3.1 Product Goals

1. New user installs and runs the agent in less than 10 minutes without cloning the monorepo.
2. Installation is one command (`curl | sh`) for supported platforms.
3. Public releases are versioned, traceable, and rollback-capable.
4. Runtime behavior is stable across supported OS/arch targets.

### 3.2 Engineering Goals

1. Deterministic build and package pipeline in CI.
2. Explicit runtime asset packaging (data files, required sidecars).
3. Failing-fast installer with checksum verification.
4. Strong test coverage at unit, integration, and smoke levels.

## 4. Non-Goals (V1)

1. Auto-update daemon.
2. GUI installer.
3. Native package managers (`brew`, `apt`, `rpm`) as first release gate.
4. In-product telemetry pipeline (can be added later).

## 5. Users and Core Use Cases

### 5.1 Personas

1. Individual players running autonomous agents locally.
2. Guild operators deploying managed bot instances.
3. Internal team validating release candidates on clean environments.

### 5.2 Key Flows

1. Install latest stable version from GitHub Releases.
2. Run `init` to create local config/data/session directories.
3. Run `doctor` to validate environment and dependencies.
4. Start agent with `run`, authenticate via Cartridge URL flow, continue operation.

## 6. Requirements

### 6.1 Functional Requirements

FR-001 Installer

1. Provide `install.sh` that detects OS/arch and downloads matching artifact.
2. Support latest and pinned install (`VERSION=vX.Y.Z`).
3. Verify artifact checksum before extraction.
4. Install binary and runtime assets to user-space by default.

FR-002 Release Artifacts

1. Publish per-platform archives to GitHub Release.
2. Include binary plus required runtime files in each archive.
3. Publish `checksums.txt` in every release.

FR-003 CLI Runtime

1. Provide stable executable name (proposed: `eternum-agent`).
2. Provide `--version` command output.
3. Provide `doctor` command for local validation.
4. Provide `init` command to scaffold `.env` and runtime data.
5. Provide `run` command as canonical startup path.

FR-004 Config and Asset Resolution

1. No default config path may rely on repository-relative paths.
2. Data dir and manifest paths must resolve in installed context.
3. Session path defaults remain writable and user-local.

FR-005 CI/CD

1. Add release workflow triggered by semver tag and manual dispatch.
2. Build, package, smoke test, checksum, and publish must happen in one pipeline.
3. Release fails if any artifact smoke test fails.

FR-006 Documentation

1. Publish public install/run docs.
2. Document required env vars and auth flow.
3. Document rollback/uninstall.

### 6.2 Non-Functional Requirements

NFR-001 Security

1. Installer must verify checksums before install.
2. Release assets must be immutable per version tag.

NFR-002 Reliability

1. CLI startup must fail with actionable errors.
2. `doctor` must explain missing/misconfigured prerequisites.

NFR-003 Compatibility

1. Support targets for V1:

- `darwin-arm64`
- `darwin-x64`
- `linux-x64`
- `linux-arm64`

NFR-004 Operability

1. Release process must support rollback to previous tag with no code changes.

## 7. Success Metrics

1. Installer success rate on supported platforms >= 95% in RC validation runs.
2. Time-to-first-successful-run <= 10 minutes median in manual QA.
3. Zero P0 packaging/runtime regressions across first 3 public releases.
4. Release pipeline completes under 20 minutes for tagged builds.

## 8. Current-State Findings (Repo-Verified)

1. Onchain agent package: `client/apps/onchain-agent/package.json`.
2. Runtime config loader: `client/apps/onchain-agent/src/config.ts`.
3. Agent data dependencies: `client/apps/onchain-agent/data/*` and `packages/game-agent/src/game-agent.ts`.
4. Existing CI does not publish onchain-agent binary release artifacts.
5. Bun binary spike works when built from app directory but requires sidecar runtime files.

## 9. Technical Design

### 9.1 Distribution Architecture

1. Build runtime executable with Bun compile.
2. Package executable with sidecar runtime assets in archive per platform.
3. Publish archives and checksums to GitHub Release.
4. Installer resolves latest/pinned tag, downloads archive, verifies checksum, installs locally.

### 9.2 Proposed Artifact Layout

Archive root:

```text
eternum-agent/
  eternum-agent            # binary (or eternum-agent.exe on windows if later)
  package.json             # required by transitive pi tooling
  data/
    HEARTBEAT.md
    soul.md
    tasks/*.md
  manifests/
    manifest_sepolia.json  # optional curated defaults
    manifest_mainnet.json  # optional curated defaults
  README.md
  LICENSE
```

Notes:

1. Keep app runtime self-contained.
2. Do not depend on monorepo-relative files at runtime.

### 9.3 Runtime Path Strategy

Current issue: `manifestPath` default points to repo path in `src/config.ts`.

Proposed changes:

1. Resolve package/runtime directory via executable location for binary mode.
2. Set `dataDir` default relative to runtime package dir.
3. Require explicit `MANIFEST_PATH` unless bundled defaults are selected via preset.
4. Improve startup errors if manifest path missing/unreadable.

### 9.4 CLI Contract (V1)

```text
eternum-agent --version
eternum-agent doctor
eternum-agent init
eternum-agent run
```

Behavior:

1. `doctor`: validates env vars, file paths, network reachability (optional non-blocking), write permissions.
2. `init`: creates local config and copies default `.env.example` and default data files if absent.
3. `run`: existing runtime start path.

### 9.5 Release Workflow Design

Proposed new workflow: `.github/workflows/release-onchain-agent.yml`

Stages:

1. Checkout + toolchain setup (`bun`, `node`, `pnpm`).
2. Run quality gates:

- `pnpm --dir client/apps/onchain-agent test`
- `pnpm --dir client/apps/onchain-agent build`
- `pnpm --dir packages/game-agent test`
- `pnpm --dir packages/client test`

3. Build and package per platform matrix.
4. Run smoke tests per artifact (`--version`, `doctor` dry run).
5. Generate `checksums.txt`.
6. Create/update release and upload assets.

### 9.6 Installer Design

Proposed new script: `scripts/install-onchain-agent.sh` (published as release install script or copied to release
assets)

Install algorithm:

1. Detect OS and arch.
2. Resolve version (latest or explicit `VERSION`).
3. Download archive + checksum file.
4. Verify checksum match.
5. Extract to install dir (`$HOME/.local/share/eternum-agent/<version>`).
6. Symlink/copy executable to `$HOME/.local/bin/eternum-agent`.
7. Print post-install commands.

Failure modes:

1. Unsupported platform -> clear exit message.
2. Checksum mismatch -> hard fail.
3. No writable install dir -> clear exit message.

### 9.7 Documentation Deliverables

1. `client/apps/onchain-agent/README.md` updates for public install path.
2. New `docs/prd/onchain-agent-public-release-prd-tdd.md` (this file).
3. New install docs section (either README or dedicated `INSTALL.md`).
4. Troubleshooting section for Cartridge auth callback/session persistence.

## 10. Delivery Plan (Phased)

### Phase 0 - Baseline Hardening

1. Add/expand CLI commands: `--version`, `doctor`, `init`, `run`.
2. Decouple runtime defaults from monorepo paths.
3. Define install-time runtime directory conventions.

Exit criteria:

1. Binary built locally from app directory starts without repo context assumptions.

### Phase 1 - Packaging

1. Add packaging script for multi-platform archive assembly.
2. Include all required sidecar assets.
3. Add checksum generation.

Exit criteria:

1. Each archive runs `--version` and `doctor` in clean extraction directory.

### Phase 2 - CI Release

1. Add release workflow matrix.
2. Add smoke tests in workflow.
3. Upload release artifacts and checksums.

Exit criteria:

1. Tag-triggered release publishes all expected artifacts automatically.

### Phase 3 - Installer + Docs

1. Publish install script.
2. Document install, init, run, troubleshooting, rollback.

Exit criteria:

1. Clean machine manual test passes one-command install to successful `run`.

### Phase 4 - Stabilization

1. Run RC rounds on target platforms.
2. Fix regressions and tighten diagnostics.

Exit criteria:

1. Release checklist fully green for stable launch.

## 11. Risks and Mitigations

R-001 Runtime sidecar coupling

1. Risk: binary fails when expected sidecar files are missing.
2. Mitigation: package validator test checks for required file set before release publish.

R-002 Manifest/source-of-truth mismatch

1. Risk: bundled/default manifest becomes stale.
2. Mitigation: require explicit manifest path or versioned manifest presets with clear environment labels.

R-003 Platform-specific runtime regressions

1. Risk: one target platform fails post-build.
2. Mitigation: per-platform smoke tests in CI; no partial publish on failure.

R-004 Installer security trust concerns

1. Risk: users distrust `curl | sh`.
2. Mitigation: checksum verification, pinned version support, transparent script and release assets.

## 12. TDD Strategy

This delivery follows strict test-first sequencing for each feature slice.

### 12.1 TDD Rules

1. Write failing test first.
2. Confirm failure is for expected missing behavior.
3. Implement minimal code to pass.
4. Refactor only with green tests.

### 12.2 Test Layers

1. Unit tests (fast): path resolution, config defaults, CLI argument routing, checksum parsing.
2. Integration tests: package assembly layout, CLI `init` and `doctor` behavior.
3. E2E smoke tests: install script against generated local release fixtures.
4. CI workflow validation: script linting and release dry-run checks.

### 12.3 Minimum New Test Suites

Proposed files:

1. `client/apps/onchain-agent/test/cli/commands.test.ts`
2. `client/apps/onchain-agent/test/cli/doctor.test.ts`
3. `client/apps/onchain-agent/test/config/runtime-paths.test.ts`
4. `client/apps/onchain-agent/test/packaging/layout.test.ts`
5. `client/apps/onchain-agent/test/install/install-script.test.ts` (or shell-based fixture tests)

### 12.4 Test Case Matrix

TDD-001 CLI version

1. Red: `eternum-agent --version` fails/unknown.
2. Green: exits 0 and prints semver.

TDD-002 Doctor env validation

1. Red: missing required env is not flagged.
2. Green: doctor exits non-zero with precise missing key list.

TDD-003 Init scaffolding

1. Red: `init` does not create expected files.
2. Green: creates `.env` (or `.env.example` copy), data dir, session dir if absent; idempotent rerun.

TDD-004 Runtime path decoupling

1. Red: default manifest/data path resolves to repo-relative location.
2. Green: resolves to install/package-local paths or explicit env path.

TDD-005 Packaging completeness

1. Red: packaged archive missing required sidecar files.
2. Green: archive validator passes required file manifest.

TDD-006 Checksum enforcement

1. Red: installer proceeds on checksum mismatch.
2. Green: installer hard-fails with clear message.

TDD-007 Platform mapping

1. Red: unsupported/incorrect os-arch mapping downloads wrong asset.
2. Green: mapping selects exact artifact naming convention.

TDD-008 Release smoke

1. Red: published artifact cannot run `--version` after extraction.
2. Green: all artifacts pass smoke checks before publish.

### 12.5 CI Gates for TDD Compliance

1. PR gate must run all onchain-agent tests.
2. Release workflow must run test suite before packaging stage.
3. Shell scripts linted (`shellcheck`) where available.
4. Optional: `actionlint` for workflow syntax checks.

## 13. Release Readiness Checklist

1. CLI

- `--version` works.
- `doctor` works.
- `init` works and is idempotent.
- `run` works with documented env.

2. Artifacts

- All target platform archives built.
- `checksums.txt` present.
- Smoke tests pass per artifact.

3. Installer

- Latest and pinned install paths work.
- Checksum mismatch fails safely.
- Install path and PATH guidance are clear.

4. Docs

- Public install docs complete.
- Env var docs complete.
- Troubleshooting + rollback documented.

5. Ops

- Release tagging process documented.
- Rollback command/process validated.

## 14. Open Decisions

1. Final binary command name: `eternum-agent` vs `eternum-onchain-agent`.
2. Whether to bundle manifests or require explicit manifest path only.
3. Whether to include Windows in V1 public support.
4. Whether to add signing/notarization in V1 or V1.1.
5. Whether to add Homebrew tap in V1.1.

## 15. Implementation Backlog (Initial)

1. Runtime/CLI

- Add CLI command router and command tests.
- Refactor config path resolution.
- Add doctor/init command implementations.

2. Packaging

- Add build/package script for multi-platform assets.
- Add archive validator tests.

3. Release

- Add release workflow.
- Add checksum generation and verification steps.

4. Installer

- Add `install.sh` with tests.
- Add install docs.

5. Hardening

- RC runs and defect fixes.
