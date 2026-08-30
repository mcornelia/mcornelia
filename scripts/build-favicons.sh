#!/usr/bin/env bash
# Regenerate browser and Apple touch icons from the editable SVG.
# Requires ImageMagick 7: https://imagemagick.org/script/download.php
set -euo pipefail

icon_project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick 7 (magick) is required to rebuild the favicon files." >&2
  exit 1
fi

magick -background none -density 768 "$icon_project_dir/favicon.svg" \
  -resize 48x48 -strip "$icon_project_dir/favicon-48x48.png"

magick -background none -density 768 "$icon_project_dir/favicon.svg" \
  -strip -define icon:auto-resize=64,48,32,16 "$icon_project_dir/favicon.ico"

# Apple supplies the rounded mask; keep the touch icon square and opaque.
magick -background '#0d1117' -density 768 "$icon_project_dir/favicon.svg" \
  -resize 180x180 -alpha remove -alpha off -strip "$icon_project_dir/apple-touch-icon.png"

echo "Built favicon.ico (16/32/48/64px), favicon-48x48.png, and apple-touch-icon.png (180px)."
