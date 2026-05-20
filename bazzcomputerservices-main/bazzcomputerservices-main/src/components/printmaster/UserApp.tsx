import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Printer,
  RotateCw,
  ScanText,
  Sparkles,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { runOcr } from "@/lib/ocr-client";
import { applyAdjustments, fileToDataUrl } from "@/lib/image-utils";
import { downloadBlob, imageToPdfBlob, textToPdfBlob } from "@/lib/pdf-utils";
import { appendLog, type Settings } from "@/lib/printmaster-db";

type Img = { id: string; name: string; dataUrl: string };

const MAX_IMAGES = 10;
const MAX_SIZE = 12 * 1024 * 1024;

export function UserApp({
  settings,
  code,
  printsUsed,
  onPrint,
  onLogout,
  expiresAt,
}: {
  settings: Settings;
  code: string;
  printsUsed: number;
  onPrint: () => void;
  onLogout: () => void;
  expiresAt: number;
}) {
  const [images, setImages] = useState<Img[]>([]);
  const [active, setActive] = useState(0);
  const [extracted, setExtracted] = useState<Record<string, string>>({});
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [printSize, setPrintSize] = useState<"original" | "2x2" | "35x45" | "51x51">("original");
  const fileRef = useRef<HTMLInputElement>(null);

  const current = images[active];
  const daysLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));

  const addFiles = async (files: FileList | File[]) => {
    const accepted: Img[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} is too large (12MB max)`);
        continue;
      }
      const dataUrl = await fileToDataUrl(f);
      accepted.push({ id: crypto.randomUUID(), name: f.name, dataUrl });
    }
    const next = [...images, ...accepted].slice(0, MAX_IMAGES);
    setImages(next);
    if (accepted.length) toast.success(`Added ${accepted.length} image(s)`);
  };

  const remove = (id: string) => {
    const next = images.filter((i) => i.id !== id);
    setImages(next);
    setActive(Math.max(0, Math.min(active, next.length - 1)));
    setExtracted((e) => {
      const copy = { ...e };
      delete copy[id];
      return copy;
    });
  };

  const extract = async (single?: Img) => {
    const targets = single ? [single] : images;
    if (!targets.length) return;
    setOcrBusy(true);
    try {
      for (const img of targets) {
        setOcrProgress(0);
        const processed = await applyAdjustments(img.dataUrl, {
          brightness,
          contrast,
          rotation,
        });
        const text = await runOcr(processed, "eng", (p) => setOcrProgress(p));
        setExtracted((e) => ({ ...e, [img.id]: text }));
        await appendLog({ type: "ocr", code, detail: img.name });
      }
      toast.success("Extraction complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OCR failed");
    } finally {
      setOcrBusy(false);
      setOcrProgress(0);
    }
  };

  const speak = (text: string) => {
    if (!text) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      toast.error("Speech synthesis not available");
    }
  };

  const downloadText = (img: Img) => {
    const text = extracted[img.id] ?? "";
    const blob = new Blob([text], { type: "text/plain" });
    downloadBlob(blob, `${img.name.replace(/\.[^.]+$/, "")}.txt`);
  };

  const downloadTextPdf = (img: Img) => {
    const text = extracted[img.id] ?? "";
    downloadBlob(textToPdfBlob(text, img.name), `${img.name.replace(/\.[^.]+$/, "")}.pdf`);
  };

  const downloadImagePdf = async (img: Img) => {
    const processed = await applyAdjustments(img.dataUrl, { brightness, contrast, rotation });
    const blob = await imageToPdfBlob(processed);
    downloadBlob(blob, `${img.name.replace(/\.[^.]+$/, "")}.pdf`);
    await appendLog({ type: "image_edit", code, detail: "image_pdf" });
  };

  const handlePrint = async (kind: "image" | "text" | "passport") => {
    if (printsUsed >= settings.maxPrintsPerSession) {
      toast.error(`Print limit reached (${settings.maxPrintsPerSession})`);
      return;
    }
    if (!current) return;
    await appendLog({ type: "print", code, detail: `${kind}:${printSize}` });
    onPrint();
    setTimeout(() => window.print(), 50);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileRef.current?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePrint("image");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        extract();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, brightness, contrast, rotation]);

  const currentExtracted = current ? extracted[current.id] ?? "" : "";

  const processedStyle = useMemo(
    () => ({
      filter: `brightness(${brightness}%) contrast(${contrast}%)`,
      transform: `rotate(${rotation}deg)`,
      transition: "filter 120ms, transform 200ms",
    }),
    [brightness, contrast, rotation],
  );

  const printClass =
    printSize === "2x2"
      ? "passport-2x2"
      : printSize === "35x45"
        ? "passport-35x45"
        : printSize === "51x51"
          ? "passport-51x51"
          : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10 no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {settings.logoDataUrl ? (
              <img src={settings.logoDataUrl} alt="" className="h-8" />
            ) : (
              <div className="size-8 rounded-md bg-[image:var(--gradient-scanner)]" />
            )}
            <div>
              <h1 className="font-semibold leading-tight">{settings.brandName}</h1>
              <p className="text-xs text-muted-foreground">
                Code expires in {daysLeft} day{daysLeft === 1 ? "" : "s"} · Prints {printsUsed}/
                {settings.maxPrintsPerSession}
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={onLogout}>
            <LogOut className="size-4 mr-2" /> Exit
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[320px_1fr] no-print">
        {/* Sidebar: uploads */}
        <aside className="space-y-4">
          <Card
            className="p-6 border-dashed border-2 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
            }}
          >
            <Upload className="size-8 mx-auto text-primary mb-2" />
            <p className="text-sm">Drop images here</p>
            <p className="text-xs text-muted-foreground mb-3">JPG, PNG, WEBP · 12MB · up to 10</p>
            <Button onClick={() => fileRef.current?.click()} className="w-full">
              <ImageIcon className="size-4 mr-2" /> Choose images
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </Card>

          {images.length > 0 && (
            <Card className="p-3 space-y-2">
              <div className="text-xs text-muted-foreground px-1">
                {images.length}/{MAX_IMAGES} images
              </div>
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`w-full flex items-center gap-2 rounded-md p-2 text-left transition ${
                    i === active ? "bg-primary/15 ring-1 ring-primary/50" : "hover:bg-muted/40"
                  }`}
                >
                  <img src={img.dataUrl} alt="" className="size-10 object-cover rounded" />
                  <span className="flex-1 truncate text-sm">{img.name}</span>
                  {extracted[img.id] && <Badge variant="secondary">OCR</Badge>}
                  <X
                    className="size-4 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(img.id);
                    }}
                  />
                </button>
              ))}
              <Button
                onClick={() => extract()}
                disabled={ocrBusy || images.length === 0}
                className="w-full mt-2"
              >
                {ocrBusy ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="size-4 mr-2" />
                )}
                Extract all
              </Button>
            </Card>
          )}
        </aside>

        {/* Main */}
        <section>
          {!current ? (
            <Card className="p-12 text-center">
              <ScanText className="size-12 mx-auto text-primary mb-3" />
              <h2 className="text-xl font-semibold">Add an image to begin</h2>
              <p className="text-muted-foreground mt-1">
                Extract text, edit, print passport photos, and more.
              </p>
              <div className="mt-6 text-xs text-muted-foreground space-y-1">
                <p>Shortcuts: Ctrl+O open · Ctrl+E extract · Ctrl+P print</p>
              </div>
            </Card>
          ) : (
            <Tabs defaultValue="ocr" className="space-y-4">
              <TabsList>
                <TabsTrigger value="ocr">
                  <ScanText className="size-4 mr-1" /> OCR
                </TabsTrigger>
                <TabsTrigger value="edit">
                  <RotateCw className="size-4 mr-1" /> Edit
                </TabsTrigger>
                <TabsTrigger value="print">
                  <Printer className="size-4 mr-1" /> Print
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ocr" className="grid gap-4 md:grid-cols-2">
                <Card className="p-4">
                  <img
                    src={current.dataUrl}
                    alt={current.name}
                    className="w-full rounded-md max-h-[420px] object-contain"
                    style={processedStyle}
                  />
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => extract(current)} disabled={ocrBusy}>
                      {ocrBusy ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="size-4 mr-2" />
                      )}
                      Extract
                    </Button>
                  </div>
                  {ocrBusy && ocrProgress > 0 && (
                    <Progress value={ocrProgress * 100} className="mt-3" />
                  )}
                </Card>
                <Card className="p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Extracted text</Label>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => speak(currentExtracted)}
                        aria-label="Read aloud"
                      >
                        <Volume2 className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(currentExtracted);
                          toast.success("Copied");
                        }}
                        aria-label="Copy"
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => downloadText(current)}
                        aria-label="Download txt"
                      >
                        <Download className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => downloadTextPdf(current)}
                        aria-label="Download pdf"
                      >
                        <FileText className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <textarea
                    className="flex-1 min-h-[300px] rounded-md border border-input bg-background p-3 text-sm font-mono"
                    value={currentExtracted}
                    onChange={(e) =>
                      setExtracted((s) => ({ ...s, [current.id]: e.target.value }))
                    }
                    placeholder="Extracted text will appear here…"
                  />
                </Card>
              </TabsContent>

              <TabsContent value="edit" className="grid gap-4 md:grid-cols-2">
                <Card className="p-4">
                  <img
                    src={current.dataUrl}
                    alt={current.name}
                    className="w-full rounded-md max-h-[420px] object-contain"
                    style={processedStyle}
                  />
                </Card>
                <Card className="p-4 space-y-5">
                  <div className="space-y-2">
                    <Label>Brightness: {brightness}%</Label>
                    <Slider
                      value={[brightness]}
                      min={0}
                      max={200}
                      step={1}
                      onValueChange={(v) => setBrightness(v[0])}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contrast: {contrast}%</Label>
                    <Slider
                      value={[contrast]}
                      min={0}
                      max={200}
                      step={1}
                      onValueChange={(v) => setContrast(v[0])}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setRotation((r) => r - 90)}>
                      <RotateCw className="size-4 mr-2 -scale-x-100" /> Rotate left
                    </Button>
                    <Button variant="outline" onClick={() => setRotation((r) => r + 90)}>
                      <RotateCw className="size-4 mr-2" /> Rotate right
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setBrightness(100);
                        setContrast(100);
                        setRotation(0);
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                  <Button onClick={() => downloadImagePdf(current)} className="w-full">
                    <FileText className="size-4 mr-2" /> Save as PDF
                  </Button>
                </Card>
              </TabsContent>

              <TabsContent value="print" className="grid gap-4 md:grid-cols-2">
                <Card className="p-4 space-y-3">
                  <Label>Print size</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["original", "Original"],
                        ["2x2", "Passport 2×2 in"],
                        ["35x45", "Passport 35×45 mm"],
                        ["51x51", "Passport 51×51 mm"],
                      ] as const
                    ).map(([k, label]) => (
                      <Button
                        key={k}
                        variant={printSize === k ? "default" : "outline"}
                        onClick={() => setPrintSize(k)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-border space-y-2">
                    <Button onClick={() => handlePrint("image")} className="w-full">
                      <Printer className="size-4 mr-2" /> Print image
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handlePrint("text")}
                      className="w-full"
                      disabled={!currentExtracted}
                    >
                      <Printer className="size-4 mr-2" /> Print extracted text
                    </Button>
                  </div>
                </Card>
                <Card className="p-4">
                  <Label className="text-xs text-muted-foreground">Print preview</Label>
                  <div className="mt-2 rounded-md bg-white p-4 flex items-center justify-center min-h-[320px]">
                    <img
                      src={current.dataUrl}
                      alt=""
                      className={`max-h-[300px] object-contain ${printClass}`}
                      style={processedStyle}
                    />
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </section>
      </main>

      {/* Hidden print surface */}
      {current && (
        <div className="print-area hidden print:block">
          {settings.watermark && <div className="print-watermark">{settings.watermark}</div>}
          <img
            src={current.dataUrl}
            alt=""
            className={printClass}
            style={{
              filter: `brightness(${brightness}%) contrast(${contrast}%)`,
              transform: `rotate(${rotation}deg)`,
              ...(printSize === "original" ? { maxWidth: "100%", maxHeight: "100vh" } : {}),
              display: "block",
              margin: "0 auto",
            }}
          />
        </div>
      )}
    </div>
  );
}