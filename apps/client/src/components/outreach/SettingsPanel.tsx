import { useEffect, useState } from "react";
import type { WarmPathSettings } from "@warmpath/shared/contracts/warm-path";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Settings2, KeyRound, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [listLimit, setListLimit] = useState("1000");
  const [staticTargetsJson, setStaticTargetsJson] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCookieHelp, setShowCookieHelp] = useState(false);

  useEffect(() => {
    if (!props.settings) {
      return;
    }

    setAdvisorSlug(props.settings.advisor_slug);
    setDefaultCategory(props.settings.default_job_category);
    setLinkedinLiAt(props.settings.linkedin_li_at);
    setListLimit(String(props.settings.default_list_limit));
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
      default_list_limit: Number(listLimit),
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
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Settings2 className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              Configure your profile and LinkedIn connection. You only need to do this once.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {/* Basics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="settings-advisor-slug">Your profile name</Label>
            <Input
              id="settings-advisor-slug"
              value={advisorSlug}
              onChange={(event) => setAdvisorSlug(event.currentTarget.value)}
              placeholder="hirefrank"
            />
            <p className="text-xs text-muted-foreground">
              A short identifier for your profile, like a username.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-default-category">Default job category</Label>
            <Input
              id="settings-default-category"
              value={defaultCategory}
              onChange={(event) => setDefaultCategory(event.currentTarget.value)}
              placeholder="product"
            />
            <p className="text-xs text-muted-foreground">
              e.g. product, engineering, design, marketing
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-li-at" className="flex items-center gap-2">
            <KeyRound className="size-3.5" /> LinkedIn session cookie
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
          <button
            type="button"
            onClick={() => setShowCookieHelp(!showCookieHelp)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showCookieHelp ? "Hide instructions" : "How do I find this?"}
          </button>
          {showCookieHelp && (
            <div className="rounded-lg border bg-accent/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>1. Open LinkedIn in Chrome and sign in.</p>
              <p>2. Open DevTools (F12 or Cmd+Opt+I).</p>
              <p>3. Go to <strong>Application</strong> &rarr; <strong>Cookies</strong> &rarr; <strong>linkedin.com</strong>.</p>
              <p>4. Find the cookie named <code>li_at</code> and copy its value.</p>
              <p>5. Paste it in the field above.</p>
            </div>
          )}
        </div>

        {/* Advanced section */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={cn("size-4 transition-transform", showAdvanced && "rotate-180")} />
          Advanced settings
        </button>

        {showAdvanced && (
          <div className="space-y-4 rounded-lg border bg-accent/10 p-4 animate-fade-in-up">
            <div className="space-y-2">
              <Label htmlFor="settings-list-limit">Results per page</Label>
              <Input
                id="settings-list-limit"
                type="number"
                min={1}
                max={10000}
                value={listLimit}
                onChange={(event) => setListLimit(event.currentTarget.value)}
                className="w-28"
              />
              <p className="text-xs text-muted-foreground">
                Max jobs and contacts to load at once (default 1000)
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="settings-rate-limit">LinkedIn request delay</Label>
                <Input
                  id="settings-rate-limit"
                  type="number"
                  min={100}
                  value={rateLimitMs}
                  onChange={(event) => setRateLimitMs(event.currentTarget.value)}
                />
                <p className="text-xs text-muted-foreground">Milliseconds between requests</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-timeout">LinkedIn request timeout</Label>
                <Input
                  id="settings-timeout"
                  type="number"
                  min={1000}
                  value={requestTimeoutMs}
                  onChange={(event) => setRequestTimeoutMs(event.currentTarget.value)}
                />
                <p className="text-xs text-muted-foreground">Milliseconds before giving up</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-min-confidence">Minimum match confidence</Label>
                <Input
                  id="settings-min-confidence"
                  type="number"
                  min={0}
                  max={1}
                  step="0.01"
                  value={minConfidence}
                  onChange={(event) => setMinConfidence(event.currentTarget.value)}
                />
                <p className="text-xs text-muted-foreground">0.0&ndash;1.0, higher = stricter</p>
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
                Which sources to try, in order. Options: linkedin_li_at (live LinkedIn), static_seed (manual targets).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-static-targets">Seed targets (optional)</Label>
              <Textarea
                id="settings-static-targets"
                rows={6}
                value={staticTargetsJson}
                onChange={(event) => setStaticTargetsJson(event.currentTarget.value)}
                placeholder='[{"full_name": "Jane Smith", "current_company": "Acme", "current_title": "Product Manager", "confidence": 0.8}]'
              />
              <p className="text-xs text-muted-foreground">
                Add people manually as JSON when you don&apos;t have LinkedIn connected. Each entry needs a name, company, title, and confidence score.
              </p>
            </div>
          </div>
        )}

        <Button onClick={() => void handleSave()} disabled={props.isSaving} className="gap-2">
          {props.isSaving ? "Saving settings..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
