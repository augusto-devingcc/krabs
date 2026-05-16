"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { undoActionFromWeb } from "./actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function UndoButton({
  actionId,
  operation,
}: {
  actionId: string;
  operation: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const r = await undoActionFromWeb(actionId);
      if ("error" in r) {
        alert(r.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="xs" className="font-mono">
          <Undo2 data-icon="inline-start" aria-hidden />
          undo
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Undo <span className="font-mono text-base">{operation}</span>?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This applies the inverse of the original action using the snapshot stored in
            its audit metadata. The undo itself is logged — you&apos;ll see it appear at
            the top of the log.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={pending}
          >
            {pending ? "Undoing…" : "Undo action"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
