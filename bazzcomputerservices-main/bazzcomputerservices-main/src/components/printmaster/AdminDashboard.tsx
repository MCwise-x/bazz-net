import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Clock,
  KeyRound,
  LogOut,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Trash2,
  Download,
  Upload,
} from "lucide-react";
import {
  type AccessCode,
  type LogEntry,
  type Settings,
  appendLog,
  clearLogs,
  exportAll,
  generateCode,
  getCodes,
  getLogs,
  getSettings,
  importAll,
  saveCodes,
  saveSettings,
} from "@/lib/printmaster-db";

const DAY = 24 * 60 * 60 * 1000;

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [validityDays, setValidityDays] = useState(30);
  const clock = useClock();

  const refresh = async () => {
    const [c, l, s] = await Promise.all([getCodes(), getLogs(), getSettings()]);
    setCodes(c);
    setLogs(l);
    setSettings(s);
    setValidityDays(s.defaultCodeValidityDays);
  };
  useEffect(() => {
    refresh();
  }, []);

  const handleGenerate = async () => {
    const existing = await getCodes();
    // Expire all currently active codes per spec
    const updated = existing.map((c) => (c.revoked ? c : { ...c, revoked: true }));
    const newCode: AccessCode = {
      code: generateCode(),
      createdAt: Date.now(),
      expiresAt: Date.now() + validityDays * DAY,
      revoked: false,
    };
    updated.unshift(newCode);
    await saveCodes(updated);
    setCodes(updated);
    toast.success(`New code: ${newCode.code}`, {
      description: `Valid ${validityDays} days. Previous codes revoked.`,
    });
  };

  const revoke = async (code: string) => {
    const updated = codes.map((c) => (c.code === code ? { ...c, revoked: true } : c));
    await saveCodes(updated);
    setCodes(updated);
    toast.success("Code revoked");
  };

  const deleteCode = async (code: string) => {
    const updated = codes.filter((c) => c.code !== code);
    await saveCodes(updated);
    setCodes(updated);
  };

  const handleExport = async () => {
    const json = await exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `printmaster-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    try {
      await importAll(text);
      await refresh();
      toast.success("Backup restored");
    } catch {
      toast.error("Invalid backup file");
    }
  };

  const sessionsThisMonth = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const days = Array.from({ length: now.getDate() }, (_, i) => ({
      day: i + 1,
      sessions: 0,
    }));
    logs
      .filter((l) => l.type === "code_entry" && l.ts >= start)
      .forEach((l) => {
        const d = new Date(l.ts).getDate();
        if (days[d - 1]) days[d - 1].sessions += 1;
      });
    return days;
  }, [logs]);

  const featureUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach((l) => {
      if (l.type === "ocr") counts.OCR = (counts.OCR ?? 0) + 1;
      else if (l.type === "print") counts.Print = (counts.Print ?? 0) + 1;
      else if (l.type === "image_edit") counts["Image edit"] = (counts["Image edit"] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [logs]);

  const dailyActive = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const cutoff = Date.now() - 14 * DAY;
    logs
      .filter((l) => l.type === "code_entry" && l.ts >= cutoff && l.code)
      .forEach((l) => {
        const day = new Date(l.ts).toISOString().slice(5, 10);
        if (!map.has(day)) map.set(day, new Set());
        map.get(day)!.add(l.code!);
      });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, set]) => ({ day, users: set.size }));
  }, [logs]);

  const chartColors = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399"];

  if (!settings) {
    return <div className="p-8 text-muted-foreground">Loading dashboard…</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">PrintMaster AI — control center</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 font-mono text-sm">
            <Clock className="size-4 text-primary" />
            {clock.toLocaleString()}
          </div>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="size-4 mr-2" /> Logout
          </Button>
        </div>
      </header>

      <Tabs defaultValue="codes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="codes">Access codes</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>

        <TabsContent value="codes" className="space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Validity (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value) || 30)}
                  className="w-32"
                />
              </div>
              <Button onClick={handleGenerate} className="h-11">
                <Plus className="size-4 mr-2" /> Generate new code
              </Button>
              <p className="text-xs text-muted-foreground">
                Generating a new code revokes all previously active codes.
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <KeyRound className="size-4" /> All codes ({codes.length})
            </h3>
            {codes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No codes yet. Generate one above.</p>
            ) : (
              <div className="divide-y divide-border">
                {codes.map((c) => {
                  const expired = Date.now() > c.expiresAt;
                  const active = !c.revoked && !expired;
                  return (
                    <div key={c.code} className="flex items-center justify-between py-3 gap-2">
                      <div>
                        <div className="font-mono text-lg tracking-widest">{c.code}</div>
                        <div className="text-xs text-muted-foreground">
                          Created {new Date(c.createdAt).toLocaleString()} · Expires{" "}
                          {new Date(c.expiresAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={active ? "default" : "secondary"}>
                          {c.revoked ? "Revoked" : expired ? "Expired" : "Active"}
                        </Badge>
                        {active && (
                          <Button size="sm" variant="outline" onClick={() => revoke(c.code)}>
                            Revoke
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteCode(c.code)}
                          aria-label="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Sessions this month</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sessionsThisMonth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="sessions" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Most used features</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={featureUsage.length ? featureUsage : [{ name: "No data", value: 1 }]}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label
                >
                  {(featureUsage.length ? featureUsage : [{ name: "x", value: 1 }]).map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-5 md:col-span-2">
            <h3 className="font-semibold mb-3">Daily active users (last 14 days)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyActive}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#a78bfa" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Usage logs ({logs.length})</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={refresh}>
                  <RefreshCcw className="size-4 mr-2" /> Refresh
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    await clearLogs();
                    await refresh();
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="max-h-[480px] overflow-auto text-sm font-mono">
              {logs.length === 0 && (
                <p className="text-muted-foreground">No activity yet.</p>
              )}
              {logs.map((l) => (
                <div key={l.id} className="py-1 border-b border-border/40">
                  <span className="text-muted-foreground">
                    {new Date(l.ts).toLocaleString()}
                  </span>{" "}
                  · <span className="text-primary">{l.type}</span>
                  {l.code && <> · code {l.code}</>}
                  {l.detail && <> · {l.detail}</>}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="p-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Brand name</Label>
                <Input
                  value={settings.brandName}
                  onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Primary color</Label>
                <Input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="h-10 w-24 p-1"
                />
              </div>
              <div className="space-y-2">
                <Label>Max prints per session</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.maxPrintsPerSession}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxPrintsPerSession: Number(e.target.value) || 10,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Session timeout (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.sessionTimeoutMin}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sessionTimeoutMin: Number(e.target.value) || 30,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Default code validity (days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.defaultCodeValidityDays}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultCodeValidityDays: Number(e.target.value) || 30,
                    })
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Print watermark text (optional)</Label>
                <Input
                  value={settings.watermark}
                  onChange={(e) => setSettings({ ...settings, watermark: e.target.value })}
                  placeholder="e.g. CONFIDENTIAL"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Logo (optional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () =>
                      setSettings({ ...settings, logoDataUrl: r.result as string });
                    r.readAsDataURL(f);
                  }}
                />
                {settings.logoDataUrl && (
                  <img
                    src={settings.logoDataUrl}
                    alt="logo preview"
                    className="mt-2 h-16 rounded border border-border bg-white p-1"
                  />
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSettings({ ...settings, logoDataUrl: null })}
              >
                Remove logo
              </Button>
              <Button
                onClick={async () => {
                  await saveSettings(settings);
                  await appendLog({ type: "admin_login", detail: "settings_updated" });
                  toast.success("Settings saved");
                }}
              >
                Save settings
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card className="p-6 space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <ShieldAlert className="size-4 text-primary mt-0.5" />
              <p>
                Backups include codes, logs, and settings. Importing replaces all current data —
                proceed with care.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleExport}>
                <Download className="size-4 mr-2" /> Export JSON
              </Button>
              <label className="inline-flex items-center">
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImport(f);
                  }}
                />
                <span className="inline-flex items-center justify-center rounded-md border border-input bg-background h-9 px-4 text-sm font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground">
                  <Upload className="size-4 mr-2" /> Import JSON
                </span>
              </label>
            </div>
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">
                View raw export
              </summary>
              <Textarea
                readOnly
                className="mt-2 font-mono text-xs h-64"
                value={JSON.stringify({ codes, logs, settings }, null, 2)}
              />
            </details>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}