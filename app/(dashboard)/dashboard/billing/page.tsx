import { ChevronDown, HelpCircle, Shield } from "lucide-react";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { PricingGrid } from "./UpgradeButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  await getDashboardContext();

  return (
    <div className="p-8 max-w-5xl">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground mb-2">
        # billing
      </p>
      <h1 className="text-3xl font-medium mb-2">Pick your plan</h1>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        You&apos;re currently on the <strong className="text-foreground">Free</strong>{" "}
        plan. Pay only when you actually use socrm in production.
      </p>

      <PricingGrid
        plans={[
          {
            id: "free",
            name: "Free",
            price: "$0",
            current: true,
            features: [
              "1 API key",
              "100 contacts",
              "Full agent contract",
              "Audit log + undo",
              "Community support",
            ],
          },
          {
            id: "solo",
            name: "Solo",
            price: "$9",
            highlight: true,
            features: [
              "Unlimited API keys",
              "10,000 contacts",
              "Email ingest, vCard ingest",
              "Account export (JSON)",
              "Email support",
            ],
            cta: { plan: "solo", label: "Upgrade to Solo", variant: "primary" },
          },
          {
            id: "pro",
            name: "Pro",
            price: "$29",
            features: [
              "100,000 contacts",
              "Priority email support",
              "Higher rate limits",
              "All future features",
            ],
            cta: { plan: "pro", label: "Upgrade to Pro", variant: "secondary" },
          },
        ]}
      />

      <div className="mt-10">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground mb-3">
          # faq
        </p>
        <Card className="p-0 gap-0 overflow-hidden">
          <CardHeader className="px-5 py-3 border-b">
            <div className="flex items-center gap-2">
              <HelpCircle size={20} className="text-muted-foreground" aria-hidden />
              <CardTitle>Frequently asked</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            <FaqItem
              q="Can I change plans anytime?"
              a="Yes — upgrades take effect immediately and downgrades take effect at the end of your current billing period. Polar handles proration automatically."
            />
            <FaqItem
              q="Is there a free trial?"
              a="The free tier is the trial — keep using it as long as you fit inside its limits. There's no clock."
            />
            <FaqItem
              q="Where does my data live?"
              a="Turso (libSQL) in us-east-1. Each account is a logical tenant inside a shared database. Export your data anytime from the settings page."
            />
          </CardContent>
        </Card>
      </div>

      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground mt-6">
        <Shield size={14} aria-hidden />
        Billing is processed by Polar (Merchant of Record). Cancel anytime.
      </p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between text-sm font-medium hover:bg-muted/50 select-none">
        <span>{q}</span>
        <ChevronDown
          size={16}
          aria-hidden
          className="text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
    </details>
  );
}
