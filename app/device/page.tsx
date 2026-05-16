import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { BRAND } from "@/lib/brand.js";
import { getDashboardContext } from "@/lib/web/dashboard-ctx.js";
import {
  findByUserCode,
  isExpired,
  normalizeUserCode,
} from "@/domain/device-auth.js";
import type { DeviceAuthorizationRow } from "@/db/schema.js";
import { DeviceClient } from "./DeviceClient.js";
import { submitCodeAction } from "./actions.js";

type SearchParams = { code?: string | string[] };

const containerStyle: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  padding: "80px 32px",
};

const detailsBlockStyle: React.CSSProperties = {
  background: "var(--bg-subtle)",
  border: "1px solid var(--border-light)",
  borderRadius: "var(--radius-4)",
  padding: "18px 20px",
  marginTop: 24,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "100px 1fr",
  gap: 12,
  alignItems: "baseline",
  padding: "8px 0",
  fontSize: 13.5,
};

const keyStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--fg-muted, #71717a)",
  textTransform: "lowercase",
};

const valueStyle: React.CSSProperties = {
  color: "var(--fg)",
  wordBreak: "break-word",
};

function Wordmark() {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
      <Link href="/" aria-label={BRAND.productName}>
        <Image
          src="/brand/logo-wordmark.svg"
          alt={BRAND.productName}
          width={110}
          height={22}
          priority
        />
      </Link>
    </div>
  );
}

function parseClientMeta(raw: string | null): {
  clientName?: string;
  userAgent?: string;
} {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: { clientName?: string; userAgent?: string } = {};
    if (typeof parsed["clientName"] === "string") {
      out.clientName = parsed["clientName"];
    }
    if (typeof parsed["userAgent"] === "string") {
      out.userAgent = parsed["userAgent"];
    }
    return out;
  } catch {
    return {};
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + "…";
}

function pickCode(sp: SearchParams): string | null {
  const raw = sp.code;
  if (!raw) return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  return v;
}

export default async function DevicePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const rawCode = pickCode(sp);

  const { userId } = await auth();
  if (!userId) {
    const target = rawCode
      ? `/device?code=${encodeURIComponent(rawCode)}`
      : "/device";
    const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(target)}`;
    return (
      <main style={containerStyle}>
        <Wordmark />
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          Authorize a new device
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--fg-muted, #52525b)",
            textAlign: "center",
            lineHeight: 1.6,
            marginBottom: 28,
          }}
        >
          You need to be signed in to {BRAND.productName} to authorize an agent.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Link href={signInUrl} className="mk-btn mk-btn--primary mk-btn--lg">
            Sign in to continue
          </Link>
        </div>
      </main>
    );
  }

  const { account } = await getDashboardContext();

  if (!rawCode) {
    return (
      <main style={containerStyle}>
        <Wordmark />
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          Enter your device code
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--fg-muted, #52525b)",
            textAlign: "center",
            lineHeight: 1.6,
            marginBottom: 28,
          }}
        >
          Type the code shown by your agent.
        </p>
        <form action={submitCodeAction} style={{ display: "flex", gap: 10 }}>
          <input
            name="userCode"
            type="text"
            placeholder="WDJB-MJHT"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            style={{
              flex: 1,
              height: 42,
              padding: "0 14px",
              fontFamily: "var(--font-mono)",
              fontSize: 15,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: "var(--bg)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-4)",
              color: "var(--fg)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            className="mk-btn mk-btn--primary mk-btn--lg"
          >
            Continue
          </button>
        </form>
      </main>
    );
  }

  const normalized = normalizeUserCode(rawCode);
  const row = await findByUserCode(normalized);

  if (!row) return <NotFoundState />;

  if (row.status === "approved") {
    return (
      <SimpleState
        heading="Code already used"
        body="This device code was already approved. If your agent is still waiting, ask it to start a fresh authorization."
      />
    );
  }

  if (row.status === "denied") {
    return (
      <SimpleState
        heading="Code denied"
        body="This device code was denied. Ask the agent to start a new authorization if this was a mistake."
      />
    );
  }

  if (row.status === "expired" || isExpired(row)) {
    return (
      <SimpleState
        heading="Code expired"
        body="Device codes are valid for 10 minutes. Ask the agent to start over."
      />
    );
  }

  return (
    <ApprovalCard row={row} accountEmail={account.email} />
  );
}

function NotFoundState() {
  return (
    <main style={containerStyle}>
      <Wordmark />
      <h1
        style={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        Code not recognized
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--fg-muted, #52525b)",
          textAlign: "center",
          lineHeight: 1.6,
          marginBottom: 28,
        }}
      >
        Double-check the code shown by your agent. Codes use letters and numbers
        only.
      </p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Link href="/device" className="mk-btn mk-btn--secondary mk-btn--lg">
          Try another code
        </Link>
      </div>
    </main>
  );
}

function SimpleState({ heading, body }: { heading: string; body: string }) {
  return (
    <main style={containerStyle}>
      <Wordmark />
      <h1
        style={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        {heading}
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--fg-muted, #52525b)",
          textAlign: "center",
          lineHeight: 1.6,
          marginBottom: 28,
        }}
      >
        {body}
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
        <Link href="/device" className="mk-btn mk-btn--secondary mk-btn--lg">
          Try another code
        </Link>
        <Link href="/dashboard" className="mk-btn mk-btn--primary mk-btn--lg">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}

function ApprovalCard({
  row,
  accountEmail,
}: {
  row: DeviceAuthorizationRow;
  accountEmail: string;
}) {
  const meta = parseClientMeta(row.clientMeta);
  const clientName = meta.clientName ?? "Unknown agent";
  const userAgent = meta.userAgent ? truncate(meta.userAgent, 60) : "Unknown";

  return (
    <main style={containerStyle}>
      <Wordmark />
      <h1
        style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          textAlign: "center",
          marginBottom: 10,
        }}
      >
        Authorize a new device
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--fg-muted, #52525b)",
          textAlign: "center",
          lineHeight: 1.6,
          marginBottom: 8,
        }}
      >
        An agent wants to access your {BRAND.name} workspace.
      </p>

      <div style={detailsBlockStyle}>
        <div style={rowStyle}>
          <span style={keyStyle}>client</span>
          <span style={valueStyle}>{clientName}</span>
        </div>
        <div style={rowStyle}>
          <span style={keyStyle}>user-agent</span>
          <span style={valueStyle}>{userAgent}</span>
        </div>
        <div style={rowStyle}>
          <span style={keyStyle}>account</span>
          <span style={valueStyle}>
            {BRAND.productName} &middot; {accountEmail}
          </span>
        </div>
        <div
          style={{
            ...rowStyle,
            borderTop: "1px solid var(--border-light)",
            marginTop: 6,
            paddingTop: 14,
          }}
        >
          <span style={keyStyle}>code</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 24,
              letterSpacing: "0.1em",
              color: "var(--fg)",
            }}
          >
            {row.userCode}
          </span>
        </div>
      </div>

      <DeviceClient userCode={row.userCode} />
    </main>
  );
}
