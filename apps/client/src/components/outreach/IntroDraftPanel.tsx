import { useState } from "react";
import type { IntroDraftResponse } from "@warmpath/shared/contracts/warm-path";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Copy, Check } from "lucide-react";

interface IntroDraftPanelProps {
  draft: IntroDraftResponse | null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => void handleCopy()}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function IntroDraftPanel(props: IntroDraftPanelProps) {
  if (!props.draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Intro Draft</CardTitle>
          <CardDescription>
            Generate a forwardable intro email, DM, and follow-up cadence.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intro Draft</CardTitle>
        <CardDescription>{props.draft.subject}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Forwardable Email</h3>
            <CopyButton text={props.draft.forwardable_email} />
          </div>
          <div className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
            {props.draft.forwardable_email}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Short DM</h3>
            <CopyButton text={props.draft.short_dm} />
          </div>
          <div className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
            {props.draft.short_dm}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Follow-up Sequence</h3>
          <div className="space-y-2">
            {props.draft.follow_up_sequence.map((step, index) => (
              <div key={index} className="flex items-start gap-3 rounded-md bg-muted p-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {index + 1}
                </span>
                <span className="whitespace-pre-wrap">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
