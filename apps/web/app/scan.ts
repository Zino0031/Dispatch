export type DocPoint = { x: number; y: number };

export function convexHull(points: DocPoint[]): DocPoint[] {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: DocPoint, a: DocPoint, b: DocPoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: DocPoint[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: DocPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function rdpOpen(points: DocPoint[], eps: number): DocPoint[] {
  if (points.length <= 2) return points;
  const dist = (p: DocPoint, a: DocPoint, b: DocPoint) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / (Math.hypot(dx, dy) || 1);
  };
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let best = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = dist(points[i], points[s], points[e]);
      if (d > best) {
        best = d;
        idx = i;
      }
    }
    if (best > eps && idx > 0) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function rdpClosed(points: DocPoint[], eps: number): DocPoint[] {
  if (points.length <= 4) return points;
  let iMax = 1;
  let dMax = -1;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
    if (d > dMax) {
      dMax = d;
      iMax = i;
    }
  }
  const first = rdpOpen(points.slice(0, iMax + 1), eps);
  const second = rdpOpen(points.slice(iMax).concat([points[0]]), eps);
  return first.concat(second.slice(1, -1));
}

export function solveHomography(src: DocPoint[], dst: DocPoint[]): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const X = dst[i].x;
    const Y = dst[i].y;
    A.push([X, Y, 1, 0, 0, 0, -src[i].x * X, -src[i].x * Y]);
    b.push(src[i].x);
    A.push([0, 0, 0, X, Y, 1, -src[i].y * X, -src[i].y * Y]);
    b.push(src[i].y);
  }
  const N = 8;
  for (let c = 0; c < N; c++) {
    let piv = c;
    for (let r = c + 1; r < N; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-9) return null;
    const tmpA = A[c];
    A[c] = A[piv];
    A[piv] = tmpA;
    const tmpB = b[c];
    b[c] = b[piv];
    b[piv] = tmpB;
    for (let r = 0; r < N; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < N; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

export function warpQuad(src: HTMLCanvasElement, quad: DocPoint[]): HTMLCanvasElement | null {
  const [TL, TR, BR, BL] = quad;
  const wTop = Math.hypot(TR.x - TL.x, TR.y - TL.y);
  const wBot = Math.hypot(BR.x - BL.x, BR.y - BL.y);
  const hLeft = Math.hypot(BL.x - TL.x, BL.y - TL.y);
  const hRight = Math.hypot(BR.x - TR.x, BR.y - TR.y);
  let outW = Math.round(Math.max(wTop, wBot));
  let outH = Math.round(Math.max(hLeft, hRight));
  if (outW < 40 || outH < 40) return null;
  const s = Math.min(1, 3500 / Math.max(outW, outH));
  outW = Math.max(1, Math.round(outW * s));
  outH = Math.max(1, Math.round(outH * s));
  const H = solveHomography(quad, [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ]);
  if (!H) return null;
  const sctx = src.getContext("2d", { willReadFrequently: true });
  if (!sctx) return null;
  const srcData = sctx.getImageData(0, 0, src.width, src.height);
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d");
  if (!octx) return null;
  const outImg = octx.createImageData(outW, outH);
  const sd = srcData.data;
  const od = outImg.data;
  const SW = src.width;
  const SH = src.height;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const wgt = H[6] * x + H[7] * y + 1;
      const sxRaw = (H[0] * x + H[1] * y + H[2]) / wgt;
      const syRaw = (H[3] * x + H[4] * y + H[5]) / wgt;
      const sx = Math.min(SW - 1.001, Math.max(0, sxRaw));
      const sy = Math.min(SH - 1.001, Math.max(0, syRaw));
      const x0 = sx | 0;
      const y0 = sy | 0;
      const fx = sx - x0;
      const fy = sy - y0;
      const o = (y * outW + x) * 4;
      for (let c = 0; c < 3; c++) {
        const i00 = (y0 * SW + x0) * 4 + c;
        const i10 = i00 + 4;
        const i01 = i00 + SW * 4;
        const i11 = i01 + 4;
        od[o + c] =
          sd[i00] * (1 - fx) * (1 - fy) + sd[i10] * fx * (1 - fy) + sd[i01] * (1 - fx) * fy + sd[i11] * fx * fy;
      }
      od[o + 3] = 255;
    }
  }
  octx.putImageData(outImg, 0, 0);
  return out;
}

export function detectDocument(src: HTMLCanvasElement): DocPoint[] | null {
  const DW = 400;
  const scale = Math.min(1, DW / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sctx = small.getContext("2d", { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(src, 0, 0, w, h);
  const data = sctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const gray = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    gray[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) | 0;
  }
  const blur = new Uint8ClampedArray(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          sum += gray[yy * w + xx];
          count++;
        }
      }
      blur[y * w + x] = (sum / count) | 0;
    }
  }
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[blur[i]]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  const bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = blur[i] > thr ? 1 : 0;
  let ones = 0;
  let edge = 0;
  for (let x = 0; x < w; x++) {
    ones += bin[x] + bin[(h - 1) * w + x];
    edge += 2;
  }
  for (let y = 1; y < h - 1; y++) {
    ones += bin[y * w] + bin[y * w + w - 1];
    edge += 2;
  }
  const bg = ones * 2 >= edge ? 1 : 0;
  const bgMask = new Uint8Array(n);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const i = y * w + x;
    if (bin[i] === bg && !bgMask[i]) {
      bgMask[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  const labels = new Int32Array(n).fill(-1);
  const parent: number[] = [];
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  let nextLabel = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (bgMask[i]) continue;
      const l = x > 0 && !bgMask[i - 1] ? labels[i - 1] : -1;
      const t = y > 0 && !bgMask[i - w] ? labels[i - w] : -1;
      if (l < 0 && t < 0) {
        parent.push(nextLabel);
        labels[i] = nextLabel++;
      } else if (l >= 0 && t >= 0) {
        const rl = find(l);
        const rt = find(t);
        const m = Math.min(rl, rt);
        parent[rl] = m;
        parent[rt] = m;
        labels[i] = m;
      } else {
        labels[i] = l >= 0 ? find(l) : find(t);
      }
    }
  }
  const counts = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    if (bgMask[i]) continue;
    const r = find(labels[i]);
    labels[i] = r;
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  let bestLabel = -1;
  let bestCount = 0;
  counts.forEach((c, l) => {
    if (c > bestCount) {
      bestCount = c;
      bestLabel = l;
    }
  });
  const coverage = bestCount / n;
  if (bestLabel < 0 || coverage < 0.08 || coverage > 0.97) return null;
  const stride = Math.max(1, Math.floor(bestCount / 15000));
  const pts: DocPoint[] = [];
  let k = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (labels[y * w + x] === bestLabel) {
        if (k++ % stride === 0) pts.push({ x, y });
      }
    }
  }
  const hull = convexHull(pts);
  if (hull.length < 4) return null;
  let eps = 2;
  let quad = hull;
  while (quad.length > 4 && eps < 60) {
    quad = rdpClosed(hull, eps);
    eps *= 1.5;
  }
  if (quad.length !== 4) return null;
  const cx = quad.reduce((s, p) => s + p.x, 0) / 4;
  const cy = quad.reduce((s, p) => s + p.y, 0) / 4;
  const sorted = quad.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let start = 0;
  for (let i = 1; i < 4; i++) {
    if (sorted[i].x + sorted[i].y < sorted[start].x + sorted[start].y) start = i;
  }
  const ordered = [sorted[start], sorted[(start + 1) % 4], sorted[(start + 2) % 4], sorted[(start + 3) % 4]];
  return ordered.map((p) => ({ x: p.x / scale, y: p.y / scale }));
}
