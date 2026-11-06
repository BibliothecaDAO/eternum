#!/usr/bin/env bash
# Narrows the checkout to every file but the binary media, then adds back the media in KEEP: one path per line from the
# repository root, a file or a folder with everything under it. Run by action.yml; runnable from any checkout.
set -euo pipefail
{
  printf '%s\n' '/*' '!*.png' '!*.webp' '!*.jpg' '!*.gif' '!*.glb' '!*.blend' '!*.mp3' '!*.wav' '!*.mp4' '!*.flac'
  while IFS= read -r entry; do
    entry=${entry#/}
    entry=${entry%/}
    # A file's own pattern, and a folder's files: a folder pattern alone loses to the type exclusions above.
    if [ -n "$entry" ]; then printf '/%s\n/%s/**\n' "$entry" "$entry"; fi
  done <<<"${KEEP:-}"
} | git sparse-checkout set --no-cone --stdin
