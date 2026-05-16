import { KeyRound, Trash2 } from "lucide-react";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listApiKeys } from "../../../../src/domain/api-key.js";
import { KeyCreator } from "./KeyCreator";
import { RevokeButton } from "./RevokeButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const { ctx } = await getDashboardContext();
  const { items } = await listApiKeys(ctx, { includeRevoked: true });

  const isEmpty = items.length === 0;

  return (
    <div className="p-8 max-w-5xl">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground mb-2">
        # api keys
      </p>
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-medium">Connect your agents</h1>
        <KeyRound size={24} className="text-muted-foreground" aria-hidden />
      </div>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        One key per agent or device. Every action your agents take is recorded against the
        key, so the audit log tells you exactly which client did what.
      </p>

      {isEmpty ? (
        <Card className="text-center items-center">
          <CardHeader className="items-center w-full">
            <div className="flex justify-center w-full mb-2">
              <KeyRound size={48} className="text-muted-foreground" aria-hidden />
            </div>
            <CardTitle className="text-xl">Generate your first API key</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Name it after the agent or device that&apos;ll use it — like &ldquo;Claude Desktop on
              MacBook&rdquo; — so the audit log stays readable.
            </CardDescription>
          </CardHeader>
          <CardContent className="w-full">
            <div className="max-w-xl mx-auto text-left">
              <KeyCreator embedded />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <KeyCreator />

          <Card className="overflow-hidden p-0 gap-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    label
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    type
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    preview
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    last used
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    status
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    created
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((k) => {
                  const isSystem = k.label === "Web Dashboard";
                  return (
                    <TableRow key={k.id}>
                      <TableCell>{k.label}</TableCell>
                      <TableCell>
                        <Badge variant={isSystem ? "outline" : "secondary"} className="font-mono uppercase text-[10px] tracking-wide">
                          {isSystem ? "system" : "agent"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{k.tokenPreview}</TableCell>
                      <TableCell>{k.lastUsedAt ? relTime(k.lastUsedAt) : "—"}</TableCell>
                      <TableCell>
                        {k.revokedAt ? (
                          <span className="text-muted-foreground inline-flex items-center gap-1">
                            <Trash2 size={14} aria-hidden /> revoked
                          </span>
                        ) : (
                          <span className="text-foreground">active</span>
                        )}
                      </TableCell>
                      <TableCell>{relTime(k.createdAt)}</TableCell>
                      <TableCell>
                        {!k.revokedAt && !isSystem && (
                          <RevokeButton keyId={k.id} label={k.label} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
