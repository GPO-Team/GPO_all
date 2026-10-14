"""Build the R2025a cache for our world, including template-selected textures."""
import hashlib
import re
import time
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import urlopen

BASE = "https://raw.githubusercontent.com/cyberbotics/webots/R2025a/"
cache = Path("/cache/assets")
cache.mkdir(parents=True, exist_ok=True)
visited = set()


def download(url):
    if url in visited:
        return
    if not url.startswith(BASE):
        raise ValueError(f"Unexpected asset origin: {url}")
    visited.add(url)
    for attempt in range(3):
        try:
            with urlopen(url, timeout=30) as response:
                content = response.read()
            break
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1)
    (cache / hashlib.sha1(url.encode()).hexdigest()).write_bytes(content)
    print(f"Cached {url} ({len(content)} bytes)", flush=True)
    if url.endswith(".proto"):
        references(content.decode(), url)


def references(text, parent):
    for reference in re.findall(r'"([^"\n]+\.(?:proto|png|jpg|jpeg|hdr|wav|obj|dae|stl))"', text):
        if any(marker in reference for marker in ("%", "${", "'", "+", " ")):
            continue
        if isinstance(parent, Path) and not reference.startswith(("https://", "webots://")):
            local = (parent.parent / reference).resolve()
            if not local.is_relative_to(Path("/project")):
                raise ValueError(f"Unexpected local asset: {local}")
            if local.suffix == ".proto":
                references(local.read_text(), local)
            continue
        url = BASE + reference[9:] if reference.startswith("webots://") else (reference if isinstance(parent, Path) else urljoin(parent, reference))
        download(url)


world = Path("/project/worlds/youbot_only.wbt")
references(world.read_text(), world)
# URLs assembled by JavaScript templates cannot be found by literal scanning.
for suffix in ("base_color", "normal", "occlusion", "roughness"):
    download(BASE + f"projects/appearances/protos/textures/parquetry/chequered_parquetry_{suffix}.jpg")
for sound in ("bump", "roll", "slide", "linear_motor", "rotational_motor"):
    download(BASE + f"projects/default/worlds/sounds/{sound}.wav")
for face in ("right", "left", "top", "bottom", "front", "back"):
    for extension in ("jpg", "hdr"):
        download(BASE + f"projects/default/worlds/textures/cubic/mountains_{face}.{extension}")
