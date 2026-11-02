#!/usr/bin/env bash
# Bake Forest Basin and render review shots with the #140 lighting engine
# (minimap_png + scene_shot from a main checkout's engine build).
#   ENGINE=/path/to/main/engine tools/map-builder/render.sh [outdir]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-/workspace/forest-basin-shots}"
ENGINE="${ENGINE:-/workspace/wt-lighting/engine}"
EX="$ENGINE/target/release/examples"
mkdir -p "$OUT"
cd "$ROOT/apps/stick-web"
NODE_PATH="$ROOT/apps/server/node_modules" "$ROOT/apps/server/node_modules/.bin/tsx" scripts/bake-zones.ts forest_basin
BAZ="$ROOT/apps/stick-web/public/zones/forest_basin.baz"
BAP="$ROOT/apps/stick-web/public/zones/forest_basin.bap"
LIGHTS="$(NODE_PATH="$ROOT/apps/server/node_modules" "$ROOT/apps/server/node_modules/.bin/tsx" "$ROOT/tools/map-builder/lights-arg.ts")"
MOOD="0.66,0.72,0.7,5,0.32,0.45,1"
png() { python3 -c "from PIL import Image; Image.open('$1').save('$2')" && rm -f "$1"; }
"$EX/minimap_png" "$BAZ" "$BAP" "$OUT/minimap.ppm" && png "$OUT/minimap.ppm" "$OUT/minimap.png"
shot() { # name x z facing cam [phase]
  printf "me %s %s %s knight idle\n" "$2" "$3" "$4" > /tmp/fb-units.txt
  if [ -n "${6:-}" ]; then SHOT_PHASE="$6" "$EX/scene_shot" "$BAZ" "$BAP" /tmp/fb-units.txt "$5" 1280 720 "$OUT/$1.ppm" "$MOOD" "$LIGHTS"
  else "$EX/scene_shot" "$BAZ" "$BAP" /tmp/fb-units.txt "$5" 1280 720 "$OUT/$1.ppm" "$MOOD" "$LIGHTS"; fi
  png "$OUT/$1.ppm" "$OUT/$1.png"
}
shot kettle-hollow 12 -96 0 iso
shot scraped-ring -24 2 0 iso
shot wrightsbridge -28 58 0 tp
shot hartstep-ford -71 94 0.6 iso
shot stillmere 40 20 1.2 tp
shot wrights-stair -80 112 3.6 tp
shot unnamed-hall -95 134 0 iso
shot goat-ledges -100 -34 -1.6 iso
shot lantern-rock-night -136 -28 1.6 iso 0.02
shot kiln-shelf 122 60 0 iso
shot stoneback-bridge 59 62 0 iso
shot crossing-stones 116 -6 0.8 iso
shot spurgate-ring 112 -92 0 iso
shot kettle-hollow-night 12 -98 0 iso 0.02
ls "$OUT"
