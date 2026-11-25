// Resize a picture to 1600 px on the long side and save it as a JPEG (quality 0.85).

async function load(blob) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch (_) {}
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

export async function resizeToJpeg(blob, max = 1600, quality = 0.85) {
  const src = await load(blob);
  const w = src.width, h = src.height;
  const k = Math.min(1, max / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(src, 0, 0, cw, ch);
  if (src.close) src.close();
  const out = await new Promise(res => c.toBlob(res, "image/jpeg", quality));
  if (!out) throw new Error("Could not read that picture.");
  return out;
}
