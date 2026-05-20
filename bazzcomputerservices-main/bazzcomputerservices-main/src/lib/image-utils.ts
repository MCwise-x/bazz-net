export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
  });
  return img;
}

export async function applyAdjustments(
  src: string,
  opts: { brightness?: number; contrast?: number; rotation?: number; maxDim?: number },
): Promise<string> {
  const img = await loadImage(src);
  const rot = (((opts.rotation ?? 0) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  let w = img.width;
  let h = img.height;
  const maxDim = opts.maxDim ?? 2000;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d")!;
  const b = opts.brightness ?? 100;
  const c = opts.contrast ?? 100;
  ctx.filter = `brightness(${b}%) contrast(${c}%)`;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return canvas.toDataURL("image/jpeg", 0.92);
}