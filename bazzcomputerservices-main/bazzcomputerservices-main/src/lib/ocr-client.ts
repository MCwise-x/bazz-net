// Lazy-loaded Tesseract.js wrapper. Runs fully in the browser.
export async function runOcr(
  image: string | File | Blob,
  lang: string = "eng",
  onProgress?: (p: number) => void,
): Promise<string> {
  const { default: Tesseract } = await import("tesseract.js");
  const { data } = await Tesseract.recognize(image, lang, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) onProgress(m.progress);
    },
  });
  return data.text.trim();
}