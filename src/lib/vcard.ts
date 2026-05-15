/**
 * Minimal vCard 3.0 / 4.0 parser. Handles a single vCard block.
 * Recognized properties: FN, N, EMAIL, TEL, ORG, TITLE, URL,
 * X-SOCIALPROFILE (with type=...), X-TELEGRAM, X-WHATSAPP.
 */

export type ParsedVCardIdentity = {
  kind: "email" | "phone" | "whatsapp" | "telegram" | "linkedin" | "twitter" | "instagram" | "other";
  value: string;
};

export type ParsedVCard = {
  name: string;
  org: string | null;
  title: string | null;
  identities: ParsedVCardIdentity[];
};

function unfold(text: string): string {
  // vCard folding: lines starting with space/tab continue the previous line
  return text.replace(/\r?\n[ \t]/g, "");
}

function decodeValue(value: string, params: Map<string, string>): string {
  let v = value;
  const encoding = params.get("ENCODING");
  const charset = params.get("CHARSET");
  if (encoding === "QUOTED-PRINTABLE") {
    v = v.replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    if (charset && charset.toUpperCase() === "UTF-8") {
      try {
        v = Buffer.from(v, "binary").toString("utf8");
      } catch {
        /* fall through */
      }
    }
  }
  return v;
}

function parseLine(line: string): { name: string; params: Map<string, string>; value: string } | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx <= 0) return null;
  const head = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const headParts = head.split(";");
  const name = headParts[0]!.toUpperCase();
  const params = new Map<string, string>();
  for (let i = 1; i < headParts.length; i++) {
    const p = headParts[i]!;
    const eq = p.indexOf("=");
    if (eq < 0) {
      // bare param like 'WORK' (vCard 2.1 style) — record as TYPE
      params.set("TYPE", (params.get("TYPE") ? params.get("TYPE")! + "," : "") + p.toUpperCase());
    } else {
      params.set(p.slice(0, eq).toUpperCase(), p.slice(eq + 1));
    }
  }
  return { name, params, value: decodeValue(value, params) };
}

function classifySocial(typeAttr: string | undefined, urlOrValue: string): ParsedVCardIdentity["kind"] {
  const t = (typeAttr ?? "").toLowerCase();
  const v = urlOrValue.toLowerCase();
  if (t.includes("linkedin") || v.includes("linkedin.com")) return "linkedin";
  if (t.includes("twitter") || t.includes("x.com") || v.includes("twitter.com") || v.includes("x.com")) return "twitter";
  if (t.includes("instagram") || v.includes("instagram.com")) return "instagram";
  if (t.includes("telegram") || v.includes("t.me/")) return "telegram";
  if (t.includes("whatsapp")) return "whatsapp";
  return "other";
}

export function parseVCard(text: string): ParsedVCard | null {
  const unfolded = unfold(text);
  const lines = unfolded.split(/\r?\n/);

  let inCard = false;
  let fn = "";
  let nStructured = "";
  let org: string | null = null;
  let title: string | null = null;
  const identities: ParsedVCardIdentity[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^BEGIN:VCARD$/i.test(line)) {
      inCard = true;
      continue;
    }
    if (/^END:VCARD$/i.test(line)) {
      inCard = false;
      break;
    }
    if (!inCard) continue;

    const parsed = parseLine(line);
    if (!parsed) continue;
    const { name, params, value } = parsed;

    switch (name) {
      case "FN":
        fn = value.trim();
        break;
      case "N": {
        // Family;Given;Additional;Prefix;Suffix
        const parts = value.split(";");
        const given = parts[1]?.trim() ?? "";
        const family = parts[0]?.trim() ?? "";
        nStructured = [given, family].filter(Boolean).join(" ");
        break;
      }
      case "ORG":
        org = value.split(";")[0]?.trim() || null;
        break;
      case "TITLE":
        title = value.trim() || null;
        break;
      case "EMAIL": {
        const v = value.trim();
        if (v) identities.push({ kind: "email", value: v });
        break;
      }
      case "TEL": {
        const v = value.trim();
        if (v) identities.push({ kind: "phone", value: v });
        break;
      }
      case "URL":
      case "X-SOCIALPROFILE": {
        const v = value.trim();
        if (!v) break;
        identities.push({ kind: classifySocial(params.get("TYPE"), v), value: v });
        break;
      }
      case "X-TELEGRAM":
        if (value.trim()) identities.push({ kind: "telegram", value: value.trim() });
        break;
      case "X-WHATSAPP":
        if (value.trim()) identities.push({ kind: "whatsapp", value: value.trim() });
        break;
      default:
        // Ignore unknown
        break;
    }
  }

  const name = fn || nStructured;
  if (!name && identities.length === 0) return null;

  return {
    name: name || identities[0]?.value || "Unknown",
    org,
    title,
    identities,
  };
}
