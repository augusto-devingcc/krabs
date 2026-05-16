"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AccountIdTooltip({ accountId }: { accountId: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="mt-10 text-xs text-muted-foreground font-mono cursor-help inline-block">
            account:{" "}
            <span className="text-foreground/80">{accountId}</span>
          </p>
        </TooltipTrigger>
        <TooltipContent side="top">Your tenant id</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
