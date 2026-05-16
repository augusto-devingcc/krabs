import Link from "next/link";
import { AlertTriangle, IdCard, KeyRound, Mail, User } from "lucide-react";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { NameForm } from "./NameForm";
import { CopyAccountId } from "./CopyAccountId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { account, clerkEmail } = await getDashboardContext();

  return (
    <div className="p-8 max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground mb-2">
        # settings
      </p>
      <h1 className="text-3xl font-medium mb-2">Account</h1>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        Tenant-level configuration. Your account is the boundary — every agent and key lives
        inside it.
      </p>

      <Card className="mb-5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <IdCard size={20} className="text-muted-foreground" aria-hidden />
            <CardTitle>Identity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Row k="account id" v={<CopyAccountId value={account.id} />} />
          <Separator />
          <Row
            k="email"
            v={
              <div className="flex flex-col">
                <span className="font-mono text-xs text-foreground">{clerkEmail}</span>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                  <Mail size={12} aria-hidden />
                  synced from Clerk
                </span>
              </div>
            }
          />
          <Separator />
          <Row k="created" v={<span className="font-mono text-xs">{account.createdAt}</span>} />
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User size={20} className="text-muted-foreground" aria-hidden />
            <CardTitle>Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <NameForm initial={account.name ?? ""} />
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound size={20} className="text-muted-foreground" aria-hidden />
            <CardTitle>Your agents</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            API keys are how Claude Desktop, the CLI, and any other agent talk to your account.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/keys">
              <KeyRound size={14} aria-hidden />
              View your API keys
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-5 border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-destructive" aria-hidden />
            <CardTitle className="text-destructive">Danger zone</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Deleting an account is not yet self-serve.{" "}
            <a
              href="mailto:support@socrm.dev?subject=Delete%20my%20account"
              className="underline hover:text-foreground"
            >
              Email support@socrm.dev
            </a>{" "}
            and we&apos;ll wipe your tenant and confirm.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2 text-sm">
      <span className="text-muted-foreground font-mono text-xs uppercase tracking-wide pt-0.5">
        {k}
      </span>
      <span className="col-span-2">{v}</span>
    </div>
  );
}
