import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, ShieldCheck, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Keypad } from "@/components/printmaster/Keypad";
import { AdminDashboard } from "@/components/printmaster/AdminDashboard";
import { UserApp } from "@/components/printmaster/UserApp";
import { checkAdmin } from "@/lib/admin-auth";
import {
  appendLog,
  getSettings,
  type Settings,
  validateCode,
} from "@/lib/printmaster-db";
import {
  clearSession,
  getSession,
  setSession,
  type Session,
} from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PrintMaster AI — Kiosk OCR, image tools & passport printing" },
      {
        name: "description",
        content:
          "PrintMaster AI is an offline-first kiosk app for OCR, image editing, and passport-size printing. Code-protected with full admin controls.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [session, setSess] = useState<Session | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [code, setCode] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");

  // Load session + settings on mount
  useEffect(() => {
    setSess(getSession());
    getSettings().then(setSettings);
  }, []);

  // F12 → admin dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        setAdminOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submitCode = async () => {
    if (code.length !== 6) return;
    const valid = await validateCode(code);
    if (!valid) {
      await appendLog({ type: "code_entry_fail", code, detail: "invalid_or_expired" });
      toast.error("Invalid or expired code");
      setCode("");
      return;
    }
    const s = await getSettings();
    setSettings(s);
    const sess: Session = {
      kind: "user",
      code: valid.code,
      loginAt: Date.now(),
      expiresAt: Date.now() + s.sessionTimeoutMin * 60 * 1000,
      codeExpiresAt: valid.expiresAt,
      prints: 0,
    };
    setSession(sess);
    setSess(sess);
    await appendLog({ type: "code_entry", code: valid.code });
    toast.success("Welcome");
  };

  const submitAdmin = async () => {
    if (!checkAdmin(adminUser, adminPass)) {
      toast.error("Wrong credentials");
      return;
    }
    const s = await getSettings();
    setSettings(s);
    const sess: Session = {
      kind: "admin",
      loginAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
    setSession(sess);
    setSess(sess);
    setAdminOpen(false);
    setAdminUser("");
    setAdminPass("");
    await appendLog({ type: "admin_login", detail: "login" });
  };

  const logout = () => {
    clearSession();
    setSess(null);
    setCode("");
  };

  const incrementPrints = () => {
    if (!session || session.kind !== "user") return;
    const next: Session = { ...session, prints: session.prints + 1 };
    setSession(next);
    setSess(next);
  };

  if (session?.kind === "admin") {
    return (
      <>
        <AdminDashboard onLogout={logout} />
        <Toaster />
      </>
    );
  }

  if (session?.kind === "user" && settings) {
    return (
      <>
        <UserApp
          settings={settings}
          code={session.code}
          printsUsed={session.prints}
          onPrint={incrementPrints}
          onLogout={logout}
          expiresAt={session.codeExpiresAt}
        />
        <Toaster />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(40% 40% at 20% 20%, oklch(0.82 0.16 195 / 0.18), transparent), radial-gradient(40% 40% at 80% 80%, oklch(0.78 0.18 320 / 0.18), transparent)",
        }}
      />
      <div className="relative z-10 text-center mb-8">
        <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-[image:var(--gradient-scanner)] shadow-[var(--shadow-glow)] mb-4">
          <Printer className="size-7 text-background" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-[image:var(--gradient-scanner)] bg-clip-text text-transparent">
          {settings?.brandName ?? "PrintMaster AI"}
        </h1>
        <p className="mt-2 text-muted-foreground">Enter your 6-digit access code to begin</p>
      </div>

      <Card className="relative z-10 w-full max-w-sm p-6 space-y-5">
        <div className="flex justify-center">
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`size-10 rounded-md border-2 flex items-center justify-center font-mono text-xl ${
                  i < code.length
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card"
                }`}
              >
                {code[i] ? "•" : ""}
              </div>
            ))}
          </div>
        </div>
        <Keypad value={code} onChange={setCode} onSubmit={submitCode} />
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="size-3" /> Local & secure
          </p>
          <Button variant="ghost" size="sm" onClick={() => setAdminOpen(true)}>
            <ShieldCheck className="size-4 mr-1" /> Admin
          </Button>
        </div>
      </Card>

      <p className="relative z-10 mt-6 text-xs text-muted-foreground">
        Press <kbd className="px-1.5 py-0.5 rounded bg-muted">F12</kbd> for admin login
      </p>

      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin login</DialogTitle>
            <DialogDescription>
              Sign in with your administrator credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                placeholder="ADMIN"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAdmin()}
              />
            </div>
            <Button onClick={submitAdmin} className="w-full">
              Sign in
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </main>
  );
}
