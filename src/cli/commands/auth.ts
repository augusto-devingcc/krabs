import { Command } from "commander";
import { spawn } from "node:child_process";
import { readConfig, writeConfig, clearConfig, configFilePath } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, type OutputFormat } from "../output.js";

const DEFAULT_API_URL = "https://api.krabs.dev";
const DEFAULT_POLL_TIMEOUT_MS = 5 * 60_000;
const CLIENT_NAME = "krabs-cli/0.1.0";

type DeviceAuthResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  account_id: string;
};

type OAuthErrorBody = {
  error: string;
  error_description?: string;
};

function openBrowser(url: string): void {
  // Best-effort: failures must not crash the CLI; the user can fall back to the printed URL.
  try {
    const platform = process.platform;
    let cmd: string;
    let args: string[];
    if (platform === "darwin") {
      cmd = "open";
      args = [url];
    } else if (platform === "win32") {
      cmd = "cmd";
      args = ["/c", "start", "", url];
    } else {
      cmd = "xdg-open";
      args = [url];
    }
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {
      /* ignored */
    });
    child.unref();
  } catch {
    /* ignored */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson<T>(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T | OAuthErrorBody | null }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T | OAuthErrorBody) : null;
  return { ok: res.ok, status: res.status, data };
}

async function runDeviceFlow(apiUrl: string): Promise<string> {
  const deviceUrl = new URL("/v1/auth/device", apiUrl).toString();
  const tokenUrl = new URL("/v1/auth/token", apiUrl).toString();

  const init = await postJson<DeviceAuthResponse>(deviceUrl, { client_name: CLIENT_NAME });
  if (!init.ok || !init.data || !("device_code" in init.data)) {
    const errMsg =
      init.data && "error_description" in init.data
        ? init.data.error_description ?? init.data.error
        : `Failed to start device flow (HTTP ${init.status})`;
    throw new Error(errMsg);
  }
  const auth = init.data;
  const verifyUrl = auth.verification_uri_complete ?? auth.verification_uri;

  // Print to stderr so stdout stays clean for users piping --format json output.
  process.stderr.write("Opening browser to authorize this device.\n");
  process.stderr.write("If it doesn't open, visit:\n");
  process.stderr.write(`  ${auth.verification_uri}\n`);
  process.stderr.write("And enter this code:\n");
  process.stderr.write(`  ${auth.user_code}\n`);

  openBrowser(verifyUrl);

  const intervalMs = Math.max(1, auth.interval) * 1000;
  const startedAt = Date.now();
  let lastNotice = startedAt;

  while (true) {
    if (Date.now() - startedAt > DEFAULT_POLL_TIMEOUT_MS) {
      throw new Error("timed out waiting for approval");
    }
    await sleep(intervalMs);

    const poll = await postJson<TokenResponse>(tokenUrl, {
      grant_type: "device_code",
      device_code: auth.device_code,
    });

    if (poll.ok && poll.data && "access_token" in poll.data) {
      return poll.data.access_token;
    }

    const body = poll.data as OAuthErrorBody | null;
    const code = body?.error;

    if (poll.status === 428 || code === "authorization_pending") {
      if (Date.now() - lastNotice > 15_000) {
        process.stderr.write("still waiting...\n");
        lastNotice = Date.now();
      }
      continue;
    }

    if (poll.status === 410 || code === "expired_token") {
      throw new Error("code expired, run `krabs auth login` again");
    }

    if (poll.status === 403 && code === "access_denied") {
      throw new Error("authorization denied");
    }

    const message = body?.error_description ?? code ?? `Request failed with status ${poll.status}`;
    throw new Error(message);
  }
}

export function authCommand(): Command {
  const cmd = new Command("auth").description("Authenticate with the krabs API");

  cmd
    .command("login")
    .description("Authenticate via device flow (or pass --token to skip)")
    .option("--api-url <url>", "API base URL", DEFAULT_API_URL)
    .option("--token <token>", "Skip device flow; save this token directly")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { apiUrl: string; token?: string; format: OutputFormat }) => {
      const fmt = pickFormat(opts.format);
      const apiUrl = opts.apiUrl;

      if (opts.token) {
        const path = writeConfig({ apiUrl, token: opts.token });
        emit({ saved: true, path }, fmt, () => `Saved config to ${path}`);
        return;
      }

      const accessToken = await runDeviceFlow(apiUrl);
      const path = writeConfig({ apiUrl, token: accessToken });

      const me = await apiRequest<{
        account: { id: string; email: string };
        apiKeyId: string;
      }>({ apiUrl, token: accessToken }, "/v1/me");

      emit(
        { authenticated: true, account: me.account, path },
        fmt,
        () =>
          `Authenticated as ${me.account.email}  (account ${me.account.id})\n  Token saved to ${path}`,
      );
    });

  cmd
    .command("logout")
    .description("Remove stored credentials")
    .option("--format <format>", "json|table|auto", "auto")
    .action((opts: { format: OutputFormat }) => {
      const path = clearConfig();
      const fmt = pickFormat(opts.format);
      emit({ cleared: true, path }, fmt, () => `Cleared credentials in ${path}`);
    });

  cmd
    .command("status")
    .description("Show the authenticated account")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { format: OutputFormat }) => {
      const cfg = readConfig();
      const fmt = pickFormat(opts.format);
      if (!cfg.token) {
        emit({ authenticated: false, path: configFilePath() }, fmt, () => "not authenticated");
        process.exit(0);
      }
      const data = await apiRequest<{
        account: { id: string; email: string };
        apiKeyId: string;
      }>({ apiUrl: cfg.apiUrl!, token: cfg.token }, "/v1/me");
      emit(
        { authenticated: true, ...data },
        fmt,
        () => `${data.account.email} (${data.account.id})\n  api key: ${data.apiKeyId}`,
      );
    });

  return cmd;
}
