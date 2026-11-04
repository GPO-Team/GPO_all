const zlib = require("zlib");

// Minimal RGBA software rasterizer with anti-aliased edges and a PNG encoder.
// Enough for the map exports; it avoids a native canvas dependency on the server.

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const parseColor = (text) => {
  const value = String(text).trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).concat(1);
  }
  const parts = value.replace(/^rgba?\(|\)$/g, "").split(",").map(Number);
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
};

const mix = (from, to, t) => from.map((value, index) => value + (to[index] - value) * t);

// Color stops are [offset, color]; returns a sampler of the interpolated RGBA for t in 0..1.
const createStopSampler = (stops) => {
  const parsed = stops.map(([offset, color]) => [offset, parseColor(color)]);
  return (t) => sampleStops(parsed, t);
};

const sampleStops = (parsed, t) => {
  if (t <= parsed[0][0]) return parsed[0][1];
  for (let i = 1; i < parsed.length; i += 1) {
    const [offset, color] = parsed[i];
    if (t <= offset) {
      const [prevOffset, prevColor] = parsed[i - 1];
      return mix(prevColor, color, (t - prevOffset) / Math.max(offset - prevOffset, 1e-9));
    }
  }
  return parsed[parsed.length - 1][1];
};

const linearGradient = (x0, y0, x1, y1, stops) => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSq = dx * dx + dy * dy || 1;
  const sample = createStopSampler(stops);
  return (x, y) => sample(clamp(((x - x0) * dx + (y - y0) * dy) / lengthSq, 0, 1));
};

const radialGradient = (cx, cy, r0, r1, stops) => {
  const sample = createStopSampler(stops);
  return (x, y) => sample(clamp((Math.hypot(x - cx, y - cy) - r0) / Math.max(r1 - r0, 1e-9), 0, 1));
};

const createRaster = (width, height) => {
  const data = new Float32Array(width * height * 3);
  let clip = null;

  const blend = (x, y, color, coverage) => {
    const alpha = clamp(color[3] * coverage, 0, 1);
    if (alpha <= 0 || (clip && !clip(x + 0.5, y + 0.5))) return;
    const index = (y * width + x) * 3;
    for (let channel = 0; channel < 3; channel += 1)
      data[index + channel] += (color[channel] - data[index + channel]) * alpha;
  };

  // Paints every pixel of the bounding box with coverage(px, py) in 0..1.
  const paint = (minX, minY, maxX, maxY, coverage, paintStyle) => {
    const color = typeof paintStyle === "function" ? paintStyle : (() => {
      const parsed = parseColor(paintStyle);
      return () => parsed;
    })();
    const x0 = clamp(Math.floor(minX), 0, width - 1);
    const y0 = clamp(Math.floor(minY), 0, height - 1);
    const x1 = clamp(Math.ceil(maxX), 0, width - 1);
    const y1 = clamp(Math.ceil(maxY), 0, height - 1);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const amount = coverage(px, py);
        if (amount > 0) blend(x, y, color(px, py), amount);
      }
    }
  };

  const edge = (distanceInside) => clamp(distanceInside + 0.5, 0, 1);

  const fillRect = (x, y, w, h, style) =>
    paint(x, y, x + w, y + h, (px, py) =>
      edge(Math.min(px - x, x + w - px)) * edge(Math.min(py - y, y + h - py)), style);

  const line = (x0, y0, x1, y1, lineWidth, style, dash = null) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy) || 1e-9;
    const half = lineWidth / 2;
    const period = dash ? dash[0] + dash[1] : 0;
    paint(Math.min(x0, x1) - half - 1, Math.min(y0, y1) - half - 1, Math.max(x0, x1) + half + 1, Math.max(y0, y1) + half + 1,
      (px, py) => {
        const along = ((px - x0) * dx + (py - y0) * dy) / length;
        if (dash && (along < 0 || along % period > dash[0])) return 0;
        const t = clamp(along / length, 0, 1);
        const distance = Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
        return clamp(half + 0.5 - distance, 0, 1) * (lineWidth < 1 ? lineWidth : 1);
      }, style);
  };

  const strokeRect = (x, y, w, h, lineWidth, style) => {
    line(x, y, x + w, y, lineWidth, style);
    line(x + w, y, x + w, y + h, lineWidth, style);
    line(x + w, y + h, x, y + h, lineWidth, style);
    line(x, y + h, x, y, lineWidth, style);
  };

  const ellipseDistance = (cx, cy, rx, ry, rotation) => {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return (px, py) => {
      const u = (px - cx) * cos + (py - cy) * sin;
      const v = -(px - cx) * sin + (py - cy) * cos;
      return (Math.hypot(u / rx, v / ry) - 1) * Math.min(rx, ry);
    };
  };

  // Half extents of the rotated ellipse's bounding box plus a margin.
  const ellipseReach = (rx, ry, rotation, margin) => {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return [Math.hypot(rx * cos, ry * sin) + margin, Math.hypot(rx * sin, ry * cos) + margin];
  };

  const fillEllipse = (cx, cy, rx, ry, rotation, style) => {
    const distance = ellipseDistance(cx, cy, rx, ry, rotation);
    const [reachX, reachY] = ellipseReach(rx, ry, rotation, 1);
    paint(cx - reachX, cy - reachY, cx + reachX, cy + reachY, (px, py) => edge(-distance(px, py)), style);
  };

  const strokeEllipse = (cx, cy, rx, ry, rotation, lineWidth, style) => {
    const distance = ellipseDistance(cx, cy, rx, ry, rotation);
    const [reachX, reachY] = ellipseReach(rx, ry, rotation, lineWidth + 1);
    paint(cx - reachX, cy - reachY, cx + reachX, cy + reachY,
      (px, py) => clamp(lineWidth / 2 + 0.5 - Math.abs(distance(px, py)), 0, 1), style);
  };

  // Convex or concave polygon via even-odd rule; used as a hard-edged clip.
  const insidePolygon = (points) => (px, py) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  const strokePolygon = (points, lineWidth, style) =>
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      line(point[0], point[1], next[0], next[1], lineWidth, style);
    });

  const toPng = () => {
    const rowLength = width * 4 + 1;
    const raw = Buffer.alloc(rowLength * height);
    for (let y = 0; y < height; y += 1) {
      raw[y * rowLength] = 0;
      for (let x = 0; x < width; x += 1) {
        const source = (y * width + x) * 3;
        const target = y * rowLength + 1 + x * 4;
        raw[target] = clamp(Math.round(data[source]), 0, 255);
        raw[target + 1] = clamp(Math.round(data[source + 1]), 0, 255);
        raw[target + 2] = clamp(Math.round(data[source + 2]), 0, 255);
        raw[target + 3] = 255;
      }
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header.set([8, 6, 0, 0, 0], 8);
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", header),
      pngChunk("IDAT", zlib.deflateSync(raw)),
      pngChunk("IEND", Buffer.alloc(0)),
    ]);
  };

  return {
    width, height, fillRect, line, strokeRect, fillEllipse, strokeEllipse, strokePolygon, toPng,
    setClip: (points) => { clip = points ? insidePolygon(points) : null; },
    fillFrame: (style) => paint(0, 0, width, height, () => 1, style),
  };
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, body) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
};

module.exports = { createRaster, linearGradient, radialGradient, parseColor };
