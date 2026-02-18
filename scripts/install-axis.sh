#!/usr/bin/env bash
set -euo pipefail

APP_NAME="axis"
DEFAULT_REPO="bibliothecadao/eternum"

GITHUB_REPO="${GITHUB_REPO:-$DEFAULT_REPO}"
RELEASE_BASE_URL="${RELEASE_BASE_URL:-https://github.com/${GITHUB_REPO}/releases/download}"
LATEST_VERSION_URL="${LATEST_VERSION_URL:-https://api.github.com/repos/${GITHUB_REPO}/releases/latest}"
INSTALL_DIR="${INSTALL_DIR:-${HOME}/.local/share/eternum-agent}"
BIN_DIR="${BIN_DIR:-${HOME}/.local/bin}"
TARGET="${TARGET:-}"
VERSION="${VERSION:-}"
TMP_DIR=""

log() {
  printf "[install] %s\n" "$*"
}

fail() {
  printf "[install] ERROR: %s\n" "$*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing required command: $1"
  fi
}

normalize_version() {
  local input="$1"
  if [[ "$input" == v* ]]; then
    printf "%s" "$input"
  else
    printf "v%s" "$input"
  fi
}

resolve_target() {
  if [[ -n "$TARGET" ]]; then
    case "$TARGET" in
      darwin-arm64|darwin-x64|linux-x64|linux-arm64) printf "%s" "$TARGET" ;;
      *) fail "Unsupported target: $TARGET" ;;
    esac
    return
  fi

  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os:$arch" in
    Darwin:arm64) printf "darwin-arm64" ;;
    Darwin:x86_64) printf "darwin-x64" ;;
    Linux:x86_64|Linux:amd64) printf "linux-x64" ;;
    Linux:aarch64|Linux:arm64) printf "linux-arm64" ;;
    *) fail "Unsupported platform: os=${os} arch=${arch}" ;;
  esac
}

resolve_latest_version() {
  require_command curl
  local response tag
  response="$(curl -fsSL "$LATEST_VERSION_URL")"
  tag="$(printf "%s" "$response" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"

  if [[ -z "$tag" ]]; then
    fail "Could not resolve latest release version from $LATEST_VERSION_URL"
  fi

  normalize_version "$tag"
}

compute_sha256() {
  local file_path="$1"

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file_path" | awk '{print $1}'
    return
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_path" | awk '{print $1}'
    return
  fi

  fail "No SHA-256 tool found (expected shasum or sha256sum)"
}

main() {
  require_command curl
  require_command tar

  local resolved_target resolved_version version_without_prefix
  resolved_target="$(resolve_target)"

  if [[ -n "$VERSION" ]]; then
    resolved_version="$(normalize_version "$VERSION")"
  else
    resolved_version="$(resolve_latest_version)"
  fi

  version_without_prefix="${resolved_version#v}"
  local archive_name="${APP_NAME}-v${version_without_prefix}-${resolved_target}.tar.gz"
  local archive_url="${RELEASE_BASE_URL}/${resolved_version}/${archive_name}"
  local checksums_url="${RELEASE_BASE_URL}/${resolved_version}/checksums.txt"

  TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t axis-install)"
  trap 'rm -rf "$TMP_DIR"' EXIT

  log "Downloading ${archive_name}"
  curl -fsSL "$archive_url" -o "${TMP_DIR}/${archive_name}" || fail "Failed to download artifact: ${archive_url}"

  log "Downloading checksums"
  curl -fsSL "$checksums_url" -o "${TMP_DIR}/checksums.txt" || fail "Failed to download checksums: ${checksums_url}"

  local expected actual line
  line="$(grep "  ${archive_name}$" "${TMP_DIR}/checksums.txt" || true)"
  [[ -n "$line" ]] || fail "Checksum entry missing for ${archive_name}"

  expected="$(printf "%s" "$line" | awk '{print $1}')"
  actual="$(compute_sha256 "${TMP_DIR}/${archive_name}")"

  if [[ "$expected" != "$actual" ]]; then
    fail "Checksum mismatch for ${archive_name}"
  fi

  local version_dir extracted_binary link_path
  version_dir="${INSTALL_DIR}/${resolved_version}"
  extracted_binary="${version_dir}/${APP_NAME}/${APP_NAME}"
  link_path="${BIN_DIR}/${APP_NAME}"

  mkdir -p "$version_dir" "$BIN_DIR"
  rm -rf "$version_dir"
  mkdir -p "$version_dir"

  log "Extracting artifact to ${version_dir}"
  tar -xzf "${TMP_DIR}/${archive_name}" -C "$version_dir"

  [[ -f "$extracted_binary" ]] || fail "Installed binary not found at ${extracted_binary}"
  chmod +x "$extracted_binary"
  ln -sfn "$extracted_binary" "$link_path"

  log "Installed ${APP_NAME} ${resolved_version}"
  log "Binary link: ${link_path}"
  log "Run: ${APP_NAME} --version"
  log "Then initialize once: ${APP_NAME} init"

  if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    printf "\nPATH update required:\n"
    printf "  export PATH=\"%s:\$PATH\"\n\n" "$BIN_DIR"
  fi
}

main "$@"
