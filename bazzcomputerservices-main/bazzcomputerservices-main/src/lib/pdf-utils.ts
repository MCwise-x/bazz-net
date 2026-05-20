import { jsPDF } from "jspdf";

export function textToPdfBlob(text: string, title = "Extracted text"): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  doc.setFontSize(14);
  doc.text(title, margin, margin);
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(text || "(empty)", maxWidth);
  doc.text(lines, margin, margin + 24);
  return doc.output("blob");
}

export async function imageToPdfBlob(dataUrl: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const orientation = img.width >= img.height ? "landscape" : "portrait";
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ratio = Math.min(pageW / img.width, pageH / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  doc.addImage(dataUrl, "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}