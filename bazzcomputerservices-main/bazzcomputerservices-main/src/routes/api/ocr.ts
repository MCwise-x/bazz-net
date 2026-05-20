import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

type OcrRequest = {
  images: Array<{ name: string; dataUrl: string }>;
  autocorrect?: boolean;
};

export const Route = createFileRoute("/api/ocr")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let body: OcrRequest;
        try {
          body = (await request.json()) as OcrRequest;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!Array.isArray(body.images) || body.images.length === 0) {
          return new Response("No images provided", { status: 400 });
        }
        if (body.images.length > 10) {
          return new Response("Maximum 10 images per request", { status: 400 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-2.5-flash");
        const autocorrect = body.autocorrect !== false;

        const system = autocorrect
          ? "You are an expert OCR engine. Extract all text from the image with high fidelity. Then silently autocorrect obvious OCR mistakes, spelling errors, broken words, and spacing issues — but preserve the original meaning, line breaks, lists, and paragraph structure. Do NOT add commentary, headings, or explanations. Output ONLY the cleaned extracted text."
          : "You are an expert OCR engine. Extract all text from the image verbatim, preserving line breaks, lists, and structure. Do NOT add commentary. Output ONLY the raw extracted text.";

        try {
          const results = await Promise.all(
            body.images.map(async (img) => {
              try {
                const match = img.dataUrl.match(/^data:(.+?);base64,(.*)$/);
                if (!match) throw new Error("Invalid image data URL");
                const mediaType = match[1];
                const base64 = match[2];
                const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
                const { text } = await generateText({
                  model,
                  system,
                  messages: [
                    {
                      role: "user",
                      content: [
                        { type: "text", text: "Extract the text from this image." },
                        { type: "image", image: bytes, mediaType },
                      ],
                    },
                  ],
                });
                return { name: img.name, text, error: null as string | null };
              } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                return { name: img.name, text: "", error: message };
              }
            }),
          );
          return Response.json({ results });
        } catch (err) {
          const message = err instanceof Error ? err.message : "OCR failed";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});