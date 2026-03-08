"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AppDialog } from "@/components/ui/app-dialog";

interface EnvVarsModalProps {
  environmentId: string;
  environmentName: string;
  onClose: () => void;
}

interface EnvVarRow {
  key: string;
  value: string;
}

export function EnvVarsModal({
  environmentId,
  environmentName,
  onClose,
}: EnvVarsModalProps) {
  const [existingKeys, setExistingKeys] = useState<string[]>([]);
  const [rows, setRows] = useState<EnvVarRow[]>([{ key: "", value: "" }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadKeys() {
      try {
        const res = await fetch(`/api/environments/${environmentId}/env-vars/keys`);
        if (res.ok) {
          const data = (await res.json()) as { keys: string[] };
          setExistingKeys(data.keys);
          if (data.keys.length > 0) {
            setRows(data.keys.map((k) => ({ key: k, value: "" })));
          }
        }
      } catch {
        // Silently ignore — show empty form
      } finally {
        setLoading(false);
      }
    }
    void loadKeys();
  }, [environmentId]);

  function addRow() {
    setRows((prev) => [...prev, { key: "", value: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: "key" | "value", val: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: val } : row))
    );
  }

  async function handleSave() {
    const vars: Record<string, string> = {};
    for (const row of rows) {
      const k = row.key.trim();
      const v = row.value.trim();
      if (k) vars[k] = v;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/environments/${environmentId}/env-vars`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vars }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Salvataggio fallito");
        return;
      }

      setSaved(true);
      setTimeout(onClose, 800);
    } catch {
      setError("Errore di rete — riprova");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppDialog onClose={onClose} maxWidth="max-w-lg">
      <AppDialog.Header>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Variabili d&apos;ambiente
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{environmentName}</p>
        </div>
      </AppDialog.Header>

      <AppDialog.Body className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
          </div>
        ) : (
          <>
            {existingKeys.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Chiavi configurate:{" "}
                  <span className="font-medium text-foreground">
                    {existingKeys.join(", ")}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  I valori non vengono mai mostrati. Per aggiornarli, inserisci i nuovi valori e salva.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span>Chiave</span>
                <span>Valore</span>
                <span />
              </div>

              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <Input
                    type="text"
                    placeholder="KEY_NAME"
                    value={row.key}
                    onChange={(e) => updateRow(i, "key", e.target.value)}
                    className="font-mono"
                  />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={row.value}
                    onChange={(e) => updateRow(i, "value", e.target.value)}
                    className="font-mono"
                  />
                  <button
                    onClick={() => removeRow(i)}
                    disabled={rows.length === 1}
                    className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}

              <button
                onClick={addRow}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                Aggiungi variabile
              </button>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </>
        )}
      </AppDialog.Body>

      <AppDialog.Footer>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Annulla
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || loading || saved}
          className={cn(saved ? "bg-emerald-600 hover:bg-emerald-600 text-white" : "")}
        >
          {saved ? "Salvato" : saving ? "Salvataggio..." : "Salva"}
        </Button>
      </AppDialog.Footer>
    </AppDialog>
  );
}
