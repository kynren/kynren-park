import sharp from 'sharp';

const src = 'C:/Users/boamponsem/Documents/kynenParkApp/apps/mobile/assets/kynren-wordmark.webp';
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const alpha = (x, y) => data[(y * W + x) * 4 + 3];

// connected components of the visible pixels (alpha > 24), 8-connected
const label = new Int32Array(W * H);
const comps = [];
const stack = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (label[i] || alpha(x, y) <= 24) continue;
    const id = comps.length + 1;
    const c = { id, minX: x, maxX: x, minY: y, maxY: y, n: 0 };
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const j = stack.pop();
      const px = j % W, py = (j - px) / W;
      c.n++;
      if (px < c.minX) c.minX = px;
      if (px > c.maxX) c.maxX = px;
      if (py < c.minY) c.minY = py;
      if (py > c.maxY) c.maxY = py;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const k = ny * W + nx;
          if (!label[k] && alpha(nx, ny) > 24) {
            label[k] = id;
            stack.push(k);
          }
        }
      }
    }
    comps.push(c);
  }
}
comps.sort((a, b) => b.n - a.n);
console.log(`${W}x${H}`, comps.slice(0, 12).map((c) => `#${c.id} n=${c.n} x${c.minX}-${c.maxX} y${c.minY}-${c.maxY}`).join('\n'));
