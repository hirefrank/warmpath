import { useEffect, useState } from "react";
import type { WarmPathSettings } from "@warmpath/shared/contracts/warm-path";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Settings2, KeyRound } from "lucide-react";

interface SettingsPanelProps {
  settings: WarmPathSettings | null;
  hints: {
    linkedin_configured: boolean;
    static_seed_configured: boolean;
  } | null;
  isSaving: boolean;
  onSave: (patch: Partial<WarmPathSettings>) => Promise<void>;
}

export function SettingsPanel(props: SettingsPanelProps) {
  const [advisorSlug, setAdvisorSlug] = useState("hirefrank");
  const [defaultCategory, setDefaultCategory] = useState("product");
  const [linkedinLiAt, setLinkedinLiAt] = useState("");
  const [providerOrder, setProviderOrder] = useState("linkedin_li_at,static_seed");
  const [minConfidence, setMinConfidence] = useState("0.45");
  const [rateLimitMs, setRateLimitMs] = useState("1200");
  const [requestTimeoutMs, setRequestTimeoutMs] = useState("15000");
  const [staticTargetsJson, setStaticTargetsJson] = useState("");

  useEffect(() => {
    if (!props.settings) {
      return;
    }

    setAdvisorSlug(props.settings.advisor_slug);
    setDefaultCategory(props.settings.default_job_category);
    setLinkedinLiAt(props.settings.linkedin_li_at);
    setProviderOrder(props.settings.scout_provider_order);
    setMinConfidence(String(props.settings.scout_min_target_confidence));
    setRateLimitMs(String(props.settings.linkedin_rate_limit_ms));
    setRequestTimeoutMs(String(props.settings.linkedin_request_timeout_ms));
    setStaticTargetsJson(props.settings.scout_static_targets_json);
  }, [props.settings]);

  async function handleSave(): Promise<void> {
    await props.onSave({
      advisor_slug: advisorSlug,
      default_job_category: defaultCategory,
      linkedin_li_at: linkedinLiAt,
      scout_provider_order: providerOrder,
      scout_min_target_confidence: Number(minConfidence),
      linkedin_rate_limit_ms: Number(rateLimitMs),
      linkedin_request_timeout_ms: Number(requestTimeoutMs),
      scout_static_targets_json: staticTargetsJson,
    });
  }

  return (
    <Card className="animate-fade-in-up overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-accent/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Settings2 className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle>Settings</CardTitle>
              <CardDescription>
                Set this up once in plain English style, then run your workflow without touching `.env` files.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={props.hints?.linkedin_configured ? "secondary" : "outline"}>
              LinkedIn {props.hints?.linkedin_configured ? "Ready" : "Missing"}
            </Badge>
            <Badge variant={props.hints?.static_seed_configured ? "secondary" : "outline"}>
              Static Seed {props.hints?.static_seed_configured ? "Ready" : "Empty"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="settings-advisor-slug">Advisor slug</Label>
            <Input
              id="settings-advisor-slug"
              value={advisorSlug}
              onChange={(event) => setAdvisorSlug(event.currentTarget.value)}
              placeholder="hirefrank"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-default-category">Default job category</Label>
            <Input
              id="settings-default-category"
              value={defaultCategory}
              onChange={(event) => setDefaultCategory(event.currentTarget.value)}
              placeholder="product"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-li-at" className="flex items-center gap-2">
            <KeyRound className="size-3.5" /> LinkedIn `li_at` cookie
          </Label>
          <Textarea
            id="settings-li-at"
            rows={3}
            value={linkedinLiAt}
            onChange={(event) => setLinkedinLiAt(event.currentTarget.value)}
            placeholder="Paste your li_at cookie value here"
          />
          <p className="text-xs text-muted-foreground">
            Keep this private. It is stored locally in your SQLite database.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="settings-rate-limit">LinkedIn delay (ms)</Label>
            <Input
              id="settings-rate-limit"
              type="number"
              min={100}
              value={rateLimitMs}
              onChange={(event) => setRateLimitMs(event.currentTarget.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-timeout">LinkedIn timeout (ms)</Label>
            <Input
              id="settings-timeout"
              type="number"
              min={1000}
              value={requestTimeoutMs}
              onChange={(event) => setRequestTimeoutMs(event.currentTarget.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-min-confidence">Scout min confidence</Label>
            <Input
              id="settings-min-confidence"
              type="number"
              min={0}
              max={1}
              step="0.01"
              value={minConfidence}
              onChange={(event) => setMinConfidence(event.currentTarget.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-provider-order">Scout provider order</Label>
          <Input
            id="settings-provider-order"
            value={providerOrder}
            onChange={(event) => setProviderOrder(event.currentTarget.value)}
            placeholder="linkedin_li_at,static_seed"
          />
          <p className="text-xs text-muted-foreground">
            Supported values: `linkedin_li_at`, `static_seed` (comma-separated).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-static-targets">Static scout targets JSON (optional)</Label>
          <Textarea
            id="settings-static-targets"
            rows={6}
            value={staticTargetsJson}
            onChange={(event) => setStaticTargetsJson(event.currentTarget.value)}
            placeholder='[{"full_name":"Taylor Candidate","current_company":"Acme","current_title":"Senior Product Manager","confidence":0.82}]'
          />
        </div>

        <Button onClick={() => void handleSave()} disabled={props.isSaving} className="gap-2">
          {props.isSaving ? "Saving settings..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
