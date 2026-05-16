"use client";

import { useState, useTransition } from "react";
import { Check, Info } from "lucide-react";
import { requestUpgradeAction } from "./actions";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Plan = "solo" | "pro";

type PlanSpec = {
  id: "free" | Plan;
  name: string;
  price: string;
  features: string[];
  current?: boolean;
  highlight?: boolean;
  cta?: { plan: Plan; label: string; variant: "primary" | "secondary" };
};

export function PricingGrid({ plans }: { plans: PlanSpec[] }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} onMessage={setMessage} />
        ))}
      </div>
      {message && (
        <Alert className="mt-6">
          <Info size={16} aria-hidden />
          <AlertTitle>Upgrade coming soon</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

function PlanCard({
  plan,
  onMessage,
}: {
  plan: PlanSpec;
  onMessage: (m: string) => void;
}) {
  const isHighlight = !!plan.highlight;

  return (
    <Card className={isHighlight ? "border-2 border-foreground" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {plan.name}
          </CardTitle>
          {isHighlight && <Badge>Popular</Badge>}
          {plan.current && <Badge variant="secondary">Current plan</Badge>}
        </div>
        <p>
          <span className="text-4xl font-medium tabular-nums">{plan.price}</span>
          {plan.id !== "free" && (
            <span className="text-sm text-muted-foreground ml-1">/mo</span>
          )}
        </p>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="flex flex-col gap-2 text-sm">
          {plan.features.map((f) => (
            <li key={f} className="flex gap-2 items-start">
              <Check size={16} aria-hidden className="text-primary mt-0.5 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {plan.current ? (
          <div className="w-full text-center text-xs font-mono uppercase tracking-wide text-muted-foreground py-2.5 border border-border rounded-md">
            current plan
          </div>
        ) : plan.cta ? (
          <UpgradeButton
            plan={plan.cta.plan}
            label={plan.cta.label}
            variant={plan.cta.variant}
            onMessage={onMessage}
          />
        ) : null}
      </CardFooter>
    </Card>
  );
}

function UpgradeButton({
  plan,
  label,
  variant,
  onMessage,
}: {
  plan: Plan;
  label: string;
  variant: "primary" | "secondary";
  onMessage: (m: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const r = await requestUpgradeAction(plan);
      onMessage(r.message);
    });
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={pending}
      variant={variant === "primary" ? "default" : "outline"}
      className="w-full"
    >
      {pending ? "requesting…" : label}
    </Button>
  );
}
