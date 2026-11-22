// Studio photo: removes the background on the device (no upload), cleans leftovers,
// and places the piece on the navy spotlight backdrop used across Dolaby.
// Background removal: @imgly/background-removal 1.4.5 (AGPL-3.0), bundled in vendor/, model files in vendor/bg-data/.
let lib = null;
async function getLib() {
  if (!lib) lib = await import("./vendor/bg-removal.mjs");
  return lib;
}
const DATA = new URL("./vendor/bg-data/", import.meta.url).href;

// warm the model in the background (first use downloads ~60 MB once; the browser caches it)
export async function warmUp() {
  try { await getLib(); } catch {}
}

export async function cutout(blob, onProgress) {
  const { removeBackground } = await getLib();
  return await removeBackground(blob, {
    publicPath: DATA, model: "small", device: "cpu",
    output: { format: "image/png", quality: 1 },
    progress: (key, cur, total) => onProgress?.(key, total ? cur / total : 0),
  });
}

// keep only the main subject: hard alpha, largest connected region (plus big neighbours), soft edge
function cleanAlpha(img) {
  const { width: w, height: h, data } = img;
  const s = Math.max(1, Math.round(Math.max(w, h) / 360)); // work on a small grid
  const gw = Math.ceil(w / s), gh = Math.ceil(h / s);
  const grid = new Uint8Array(gw * gh);
  for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) if (data[(y * w + x) * 4 + 3] > 140) grid[(y / s | 0) * gw + (x / s | 0)] = 1;
  const label = new Int32Array(gw * gh); const sizes = [0]; let id = 0;
  const stack = [];
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i] || label[i]) continue;
    id++; let n = 0; stack.push(i); label[i] = id;
    while (stack.length) {
      const p = stack.pop(); n++; const px = p % gw, py = (p / gw) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const q = ny * gw + nx; if (grid[q] && !label[q]) { label[q] = id; stack.push(q); }
      }
    }
    sizes.push(n);
  }
  if (!id) return null;
  const biggest = Math.max(...sizes);
  const keep = new Uint8Array(id + 1); sizes.forEach((n, k) => { if (k && n >= biggest * 0.15) keep[k] = 1; });
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; const l = label[(y / s | 0) * gw + (x / s | 0)];
    let a = data[i + 3];
    if (!keep[l]) {
      // allow soft edge pixels next to a kept cell
      const near = [[s, 0], [-s, 0], [0, s], [0, -s]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) return false; return keep[label[(yy / s | 0) * gw + (xx / s | 0)]]; });
      a = near ? Math.min(a, 255) : 0;
    }
    if (a < 24) a = 0; else if (a > 230) a = 255;
    data[i + 3] = a;
    if (a) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX <= minX || maxY <= minY) return null;
  return { minX, minY, maxX, maxY };
}

// compose on the Dolaby navy backdrop. kind: "bottle" (perfume, watch, small things: reflection) or "garment"
export async function compose(cutBlob, kind = "bottle") {
  const bmp = await createImageBitmap(cutBlob);
  const src = document.createElement("canvas"); src.width = bmp.width; src.height = bmp.height;
  const sx = src.getContext("2d", { willReadFrequently: true }); sx.drawImage(bmp, 0, 0);
  const img = sx.getImageData(0, 0, src.width, src.height);
  const box = cleanAlpha(img); if (!box) throw new Error("مالقيتش القطعة في الصورة. صوّرها لوحدها على خلفية سادة.");
  sx.putImageData(img, 0, 0);
  const bw = box.maxX - box.minX + 1, bh = box.maxY - box.minY + 1;

  const W = 1200, H = 1500; const out = document.createElement("canvas"); out.width = W; out.height = H;
  const c = out.getContext("2d");
  // backdrop: deep navy with a soft spotlight
  const g = c.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.48, H * 0.75);
  g.addColorStop(0, "#34456f"); g.addColorStop(0.55, "#1a2747"); g.addColorStop(1, "#0b1222");
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  const garment = kind === "garment";
  const maxH = H * (garment ? 0.78 : 0.6), maxW = W * (garment ? 0.82 : 0.62);
  const k = Math.min(maxH / bh, maxW / bw);
  const dw = bw * k, dh = bh * k; const dx = (W - dw) / 2; const base = garment ? H * 0.89 : H * 0.78; const dy = base - dh;

  // floor shadow
  c.save(); c.filter = "blur(18px)"; c.fillStyle = "rgba(0,0,0,.45)";
  c.beginPath(); c.ellipse(W / 2, base + 6, dw * 0.42, 16, 0, 0, Math.PI * 2); c.fill(); c.restore();

  if (!garment) { // reflection
    c.save(); c.translate(0, base * 2); c.scale(1, -1); c.globalAlpha = 0.22;
    c.drawImage(src, box.minX, box.minY, bw, bh, dx, dy, dw, dh); c.restore();
    const fade = c.createLinearGradient(0, base, 0, base + dh * 0.45);
    fade.addColorStop(0, "rgba(11,18,34,0)"); fade.addColorStop(1, "rgba(11,18,34,1)");
    c.fillStyle = fade; c.fillRect(0, base, W, H - base);
  }
  c.drawImage(src, box.minX, box.minY, bw, bh, dx, dy, dw, dh);
  return await new Promise((r) => out.toBlob(r, "image/jpeg", 0.9));
}

export async function studioShot(blob, kind, onProgress) {
  const cut = await cutout(blob, onProgress);
  return await compose(cut, kind);
}
