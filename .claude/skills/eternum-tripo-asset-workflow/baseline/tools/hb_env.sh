#!/usr/bin/env bash
# Shared by the shell tools (source it; it is not run on its own). Finds Blender and its Python and turns paths into the form they take.
#   HB_BLENDER  the Blender executable. Default: `blender` (or `blender.exe`) on PATH
#   HB_PYTHON   the Python that ships with that Blender (it has numpy). Default: <Blender's folder>/<version>/python/bin/python*
# Under WSL with a Windows Blender, paths given to it are turned into Windows form (wslpath -w) and the environment variables the Blender
# scripts read are passed on through WSLENV. Elsewhere paths and variables are passed as they are.
HB_TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "${HB_BLENDER:-}" ]; then HB_BLENDER="$(command -v blender || command -v blender.exe || true)"; fi
[ -n "$HB_BLENDER" ] || { echo "hb_env: Blender not found; set HB_BLENDER to the Blender 5.2 executable" >&2; exit 2; }
if [ -z "${HB_PYTHON:-}" ]; then
  _root="$(dirname "$(readlink -f "$HB_BLENDER")")"
  HB_PYTHON="$(ls "$_root"/*/python/bin/python.exe "$_root"/*/python/bin/python3* 2>/dev/null | head -1)"
fi
[ -n "$HB_PYTHON" ] || { echo "hb_env: Blender's Python not found beside $HB_BLENDER; set HB_PYTHON" >&2; exit 2; }
HB_WIN=0; case "$HB_BLENDER" in *.exe) command -v wslpath >/dev/null 2>&1 && HB_WIN=1;; esac
# hb_path <path>: the absolute path, in the form Blender and its Python take
hb_path() { local a; a="$(realpath -m "$1")"; if [ "$HB_WIN" = 1 ]; then wslpath -w "$a"; else echo "$a"; fi; }
# hb_py <tool> [args]: a Python tool with Blender's Python
hb_py() { local t="$1"; shift; "$HB_PYTHON" "$(hb_path "$HB_TOOLS/$t")" "$@"; }
# Variables are named in WSLENV so that a Windows program sees them.
# hb_blender <tool.py> [NAME=value ...]: a Blender tool, headless; the values are the variables it reads
hb_blender() {
  local t="$1" names="" kv; shift
  for kv in "$@"; do names="$names:${kv%%=*}"; done
  env "$@" WSLENV="${WSLENV:-}${WSLENV:+:}${names#:}" "$HB_BLENDER" -b --factory-startup --python "$(hb_path "$HB_TOOLS/$t")"
}
# hb_pyenv <tool> [NAME=value ...] -- [args]: a Python tool that reads variables
hb_pyenv() {
  local t="$1" names="" kvs=() kv; shift
  while [ "$1" != "--" ]; do kvs+=("$1"); names="$names:${1%%=*}"; shift; done; shift
  env "${kvs[@]}" WSLENV="${WSLENV:-}${WSLENV:+:}${names#:}" "$HB_PYTHON" "$(hb_path "$HB_TOOLS/$t")" "$@"
}
# hb_spec <char.json> <key>: see hb_spec.py; a path comes back in shell form
hb_spec() {
  local v; v="$(hb_py hb_spec.py "$(hb_path "$1")" "$2" | tr -d '\r')"
  if [ "$HB_WIN" = 1 ] && { [ "$2" = work ] || [ "$2" = gear ]; } && [ -n "$v" ]; then wslpath -u "$v"; else echo "$v"; fi
}
