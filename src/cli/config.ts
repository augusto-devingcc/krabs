import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type CliConfig = {
  apiUrl: string;
  token: string;
};

const DEFAULT_API_URL = "https://api.krabs.dev";

function configPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg ?? join(homedir(), ".config");
  return join(base, "krabs", "config.json");
}

export function readConfig(): Partial<CliConfig> {
  const envUrl = process.env.KRABS_API_URL;
  const envToken = process.env.KRABS_API_KEY;

  if (envToken) {
    return { apiUrl: envUrl ?? DEFAULT_API_URL, token: envToken };
  }

  const path = configPath();
  if (!existsSync(path)) {
    return envUrl ? { apiUrl: envUrl } : {};
  }
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<CliConfig>;
    return {
      apiUrl: envUrl ?? parsed.apiUrl ?? DEFAULT_API_URL,
      ...(parsed.token ? { token: parsed.token } : {}),
    };
  } catch {
    return envUrl ? { apiUrl: envUrl } : {};
  }
}

export function writeConfig(cfg: CliConfig): string {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2), "utf8");
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best effort */
  }
  return path;
}

export function clearConfig(): string {
  const path = configPath();
  const existing = readConfig();
  const apiUrl = existing.apiUrl ?? DEFAULT_API_URL;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ apiUrl }, null, 2), "utf8");
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best effort */
  }
  return path;
}

export function configFilePath(): string {
  return configPath();
}

export function requireConfig(): CliConfig {
  const cfg = readConfig();
  if (!cfg.token) {
    throw new CliConfigError(
      "Not authenticated. Run `krabs auth login` or set KRABS_API_KEY.",
    );
  }
  return { apiUrl: cfg.apiUrl ?? DEFAULT_API_URL, token: cfg.token };
}

export class CliConfigError extends Error {}
