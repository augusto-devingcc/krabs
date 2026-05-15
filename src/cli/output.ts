export type OutputFormat = "json" | "table" | "auto";

export function pickFormat(explicit: OutputFormat | undefined): "json" | "table" {
  if (explicit === "json") return "json";
  if (explicit === "table") return "table";
  return process.stdout.isTTY ? "table" : "json";
}

export function emit(value: unknown, format: "json" | "table", renderTable: () => string): void {
  if (format === "json") {
    process.stdout.write(JSON.stringify(value) + "\n");
  } else {
    process.stdout.write(renderTable() + "\n");
  }
}

export function pad(s: string, width: number): string {
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}
