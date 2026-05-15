import type { CliConfig } from "./config.js";

export type ApiErrorBody = {
  error: { code: string; message: string; hint?: string; field?: string };
  _schema_version: string;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly hint?: string;
  readonly field?: string;

  constructor(status: number, body: ApiErrorBody["error"]) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    if (body.hint !== undefined) this.hint = body.hint;
    if (body.field !== undefined) this.field = body.field;
  }
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(cfg: CliConfig, path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(path, cfg.apiUrl);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/json",
    ...opts.headers,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers,
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  const res = await fetch(url, init);

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const errBody = (json as ApiErrorBody | null)?.error ?? {
      code: "INTERNAL",
      message: `Request failed with status ${res.status}`,
    };
    throw new ApiClientError(res.status, errBody);
  }

  return (json as { data: T })?.data as T;
}
