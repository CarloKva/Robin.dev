"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";

// Load CodeMirror only on the client (no SSR) to avoid hydration issues
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[240px] rounded-md border border-input bg-muted/50 animate-pulse" />
  ),
});

import { json } from "@codemirror/lang-json";

const MCP_PLACEHOLDER = JSON.stringify(
  {
    mcpServers: {
      "example-http": {
        type: "http",
        url: "https://your-mcp-server.example.com",
        headers: {
          Authorization: "Bearer YOUR_TOKEN",
        },
      },
      "example-stdio": {
        type: "stdio",
        command: "npx",
        args: ["@your-org/mcp-server"],
      },
    },
  },
  null,
  2
);

interface McpServersFormProps {
  workspaceId: string;
  initialMcpConfig: Record<string, unknown> | null;
}

export function McpServersForm({
  workspaceId,
  initialMcpConfig,
}: McpServersFormProps) {
  const [value, setValue] = useState<string>(
    initialMcpConfig !== null
      ? JSON.stringify(initialMcpConfig, null, 2)
      : MCP_PLACEHOLDER
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [apiError, setApiError] = useState<string | null>(null);

  function handleSave() {
    setJsonError(null);
    setStatus("idle");
    setApiError(null);

    // 1. Validate JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setJsonError("JSON non valido. Correggi la sintassi prima di salvare.");
      return;
    }

    // 2. Validate mcpServers key
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("mcpServers" in parsed)
    ) {
      setJsonError('L\'oggetto deve contenere la chiave "mcpServers".');
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mcp_config: parsed }),
      });

      if (res.ok) {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setApiError(
          (data as { error?: string }).error ?? "Errore durante il salvataggio."
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border border-input">
        <CodeMirror
          value={value}
          height="240px"
          extensions={[json()]}
          onChange={(val) => {
            setValue(val);
            setJsonError(null);
            setStatus("idle");
          }}
          theme="light"
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: true,
          }}
        />
      </div>

      {jsonError && (
        <p className="text-sm text-destructive">{jsonError}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity disabled:opacity-50"
        >
          {isPending ? "Salvataggio..." : "Salva configurazione MCP"}
        </button>

        {status === "saved" && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            Salvato
          </span>
        )}

        {status === "error" && (
          <span className="text-sm text-destructive">{apiError}</span>
        )}
      </div>
    </div>
  );
}
