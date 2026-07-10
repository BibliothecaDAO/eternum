#!/usr/bin/env bash
set -euo pipefail

readonly plugin_version="1.2.835.0"
readonly plugin_sha256="7c6dcad12518571cc7959a713e6a8ae1bdf6ed66fd9bee37dc189e39ca58ae03"
readonly plugin_url="https://s3.amazonaws.com/session-manager-downloads/plugin/${plugin_version}/ubuntu_64bit/session-manager-plugin.deb"
readonly plugin_package="${RUNNER_TEMP:?RUNNER_TEMP is required}/session-manager-plugin.deb"

if command -v session-manager-plugin >/dev/null 2>&1 &&
  [[ "$(session-manager-plugin --version)" == "${plugin_version}" ]]; then
  exit 0
fi

curl --fail --location --retry 3 --silent --show-error "${plugin_url}" --output "${plugin_package}"
printf '%s  %s\n' "${plugin_sha256}" "${plugin_package}" | sha256sum --check --strict
sudo dpkg --install "${plugin_package}"
test "$(session-manager-plugin --version)" = "${plugin_version}"
