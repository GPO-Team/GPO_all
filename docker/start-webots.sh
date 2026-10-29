#!/bin/sh
set -eu
touch /tmp/webots-started
mkdir -p "$WEB_STATE_DIR"
# A fresh deployment must wait for a mission instead of generating a survey.
if [ ! -f "$WEB_STATE_DIR/route.csv" ]; then
  printf 'x,y,headingDeg\n' > "$WEB_STATE_DIR/route.csv"
fi
if [ ! -f "$WEB_STATE_DIR/limit_zones.txt" ]; then
  printf 'zone_count 0\n' > "$WEB_STATE_DIR/limit_zones.txt"
fi
if [ ! -f "$WEB_STATE_DIR/surface_zones.txt" ]; then
  printf 'surface_zone_count 0\n' > "$WEB_STATE_DIR/surface_zones.txt"
fi
renderer="${WEBOTS_RENDERER:-cpu}"
mode="${WEBOTS_MODE:-realtime}"
view_fps="${WEBOTS_VIEW_FPS:-30}"
ui="${WEBOTS_UI:-browser}"
case "$renderer" in cpu|gpu|auto) ;; *) echo "Invalid WEBOTS_RENDERER: $renderer" >&2; exit 1;; esac
case "$mode" in realtime|fast) ;; *) echo "Invalid WEBOTS_MODE: $mode" >&2; exit 1;; esac
case "$ui" in browser|gui) ;; *) echo "Invalid WEBOTS_UI: $ui" >&2; exit 1;; esac
case "$view_fps" in ''|*[!0-9]*) echo 'WEBOTS_VIEW_FPS must be an integer from 1 to 60' >&2; exit 1;; esac
if [ "$view_fps" -lt 1 ] || [ "$view_fps" -gt 60 ]; then
  echo 'WEBOTS_VIEW_FPS must be an integer from 1 to 60' >&2; exit 1
fi
# W3D scene updates; the browser renders the external view. Sensor periods stay intact.
sed -i "s/^  FPS .*/  FPS $view_fps/" /project/worlds/youbot_only.wbt

# CUDA availability does not prove that OpenGL is hardware accelerated.
if [ "$renderer" != cpu ]; then
  if timeout 15 glxinfo -B > /tmp/webots-renderer.log 2>&1 &&
     grep -q 'Accelerated: yes' /tmp/webots-renderer.log &&
     ! grep -Eiq 'llvmpipe|softpipe|software rasterizer' /tmp/webots-renderer.log; then
    echo 'Webots renderer: GPU'
    grep 'OpenGL renderer string:' /tmp/webots-renderer.log
    if [ "$ui" = gui ]; then
      echo 'Webots UI: native WSLg window with full scene'
      exec webots --batch --stdout --stderr --mode="$mode" /project/worlds/youbot_only.wbt
    fi
    exec webots --batch --stdout --stderr --mode="$mode" --no-rendering --stream=w3d /project/worlds/youbot_only.wbt
  fi
  cat /tmp/webots-renderer.log >&2
  if [ "$renderer" = gpu ]; then
    echo 'GPU requested but hardware OpenGL is unavailable. Use CPU mode or fix GPU access.' >&2
    exit 1
  fi
  echo 'Hardware OpenGL unavailable; falling back to CPU.' >&2
fi
if [ "$ui" = gui ]; then
  echo 'Webots GUI requires hardware OpenGL through WSLg.' >&2
  exit 1
fi
echo 'Webots renderer: CPU (software Mesa)'
export LIBGL_ALWAYS_SOFTWARE=1
exec xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" \
  webots --batch --stdout --stderr --mode="$mode" --no-rendering --stream=w3d /project/worlds/youbot_only.wbt
