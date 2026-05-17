"use client";

import { useState, useTransition } from "react";
import { Copy, Check, RefreshCw, Trash2 } from "lucide-react";
import { addDomainAction, removeDomainAction, verifyDomainAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

export type DomainRecord = {
  record?: string;
  name: string;
  type: string;
  value: string;
  ttl?: string;
  status?: string;
  priority?: number;
};

export type Domain = {
  id: string;
  domain: string;
  status: "pending" | "verified" | "failed";
  region: string | null;
  dnsRecords: DomainRecord[];
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
};

export function DomainManager({ domains }: { domains: Domain[] }) {
  const [addPending, startAdd] = useTransition();
  const [addErr, setAddErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(domains[0]?.id ?? null);

  function onAdd(formData: FormData) {
    setAddErr(null);
    startAdd(async () => {
      const r = await addDomainAction(formData);
      if ("error" in r) setAddErr(r.error);
    });
  }

  return (
    <div className="flex flex-col">
      {domains.length === 0 ? (
        <p className="k-body-sm text-muted-foreground mb-5">
          No sending domains yet. Add one below — krabs will register it with
          Resend and give you the DNS records to add at your registrar.
        </p>
      ) : (
        <ul className="flex flex-col mb-5">
          {domains.map((d, i) => (
            <li key={d.id}>
              <DomainRow
                domain={d}
                expanded={expanded === d.id}
                onToggle={() => setExpanded(expanded === d.id ? null : d.id)}
              />
              {i < domains.length - 1 && <Separator />}
            </li>
          ))}
        </ul>
      )}

      <form action={onAdd} className="flex flex-col gap-3">
        <Label htmlFor="resend-add-domain" className="k-eyebrow">
          add sending domain
        </Label>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            id="resend-add-domain"
            name="domain"
            placeholder="acme.com"
            required
            autoComplete="off"
            spellCheck={false}
            className="font-mono flex-1"
          />
          <button
            type="submit"
            disabled={addPending}
            className="k-btn k-btn--primary k-btn--md"
          >
            {addPending ? "Adding…" : "Add domain"}
          </button>
        </div>
        {addErr && (
          <Alert variant="destructive">
            <AlertDescription className="font-mono">{addErr}</AlertDescription>
          </Alert>
        )}
      </form>
    </div>
  );
}

function DomainRow({
  domain,
  expanded,
  onToggle,
}: {
  domain: Domain;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [verifyPending, startVerify] = useTransition();
  const [removePending, startRemove] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onVerify(e: React.MouseEvent) {
    e.stopPropagation();
    setErr(null);
    startVerify(async () => {
      const r = await verifyDomainAction(domain.id);
      if ("error" in r) setErr(r.error);
    });
  }

  function onRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Remove ${domain.domain}? This deletes it from Resend.`)) return;
    setErr(null);
    startRemove(async () => {
      const r = await removeDomainAction(domain.id);
      if ("error" in r) setErr(r.error);
    });
  }

  return (
    <div className="py-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <code className="font-mono text-sm text-foreground truncate">{domain.domain}</code>
          <StatusPill status={domain.status} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onVerify}
            disabled={verifyPending}
            className="k-btn k-btn--ghost k-btn--sm"
          >
            <RefreshCw data-icon="inline-start" aria-hidden />
            {verifyPending ? "verifying…" : "verify"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={removePending}
            className="k-btn k-btn--ghost k-btn--sm text-destructive hover:text-destructive"
          >
            <Trash2 aria-hidden />
          </button>
        </div>
      </button>

      {err && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription className="font-mono">{err}</AlertDescription>
        </Alert>
      )}

      {expanded && (
        <div className="mt-4">
          {domain.status === "verified" ? (
            <p className="k-body-sm text-muted-foreground">
              All DNS records are verified. You can send from{" "}
              <code className="font-mono text-foreground">noreply@{domain.domain}</code>.
            </p>
          ) : (
            <DnsTable records={domain.dnsRecords} />
          )}
          {domain.lastVerifiedAt && (
            <p className="text-xs text-muted-foreground mt-3">
              Last checked {relTime(domain.lastVerifiedAt)}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "verified" | "failed" }) {
  if (status === "verified") {
    return (
      <span className="k-badge k-badge--success">
        <span className="k-badge__dot" />
        verified
      </span>
    );
  }
  if (status === "failed") {
    return <span className="k-badge k-badge--danger">failed</span>;
  }
  return <span className="k-badge k-badge--neutral">pending</span>;
}

function DnsTable({ records }: { records: DomainRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="k-body-sm text-muted-foreground">
        No DNS records returned yet. Click verify to fetch them from Resend.
      </p>
    );
  }
  return (
    <div className="rounded border border-border overflow-hidden">
      <div className="grid grid-cols-[80px_minmax(0,1.2fr)_minmax(0,2fr)_auto] gap-2 px-3 py-2 bg-muted text-xs k-eyebrow">
        <span>type</span>
        <span>name</span>
        <span>value</span>
        <span></span>
      </div>
      <ul>
        {records.map((r, i) => (
          <li
            key={`${r.type}-${r.name}-${i}`}
            className={i > 0 ? "border-t border-border" : ""}
          >
            <div className="grid grid-cols-[80px_minmax(0,1.2fr)_minmax(0,2fr)_auto] gap-2 px-3 py-2 text-xs items-start">
              <span className="font-mono uppercase tracking-wide text-muted-foreground">
                {r.type}
              </span>
              <code className="font-mono text-foreground break-all">{r.name}</code>
              <code className="font-mono text-foreground break-all">{r.value}</code>
              <CopyButton text={r.value} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function onClick() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="k-btn k-btn--ghost k-btn--sm"
      aria-label="Copy value"
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </button>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
