import { Search, Users, Briefcase, GitBranch, BarChart3, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type WorkflowStep = "scout" | "import" | "jobs" | "buildPath" | "rank" | "draft";

interface AppSidebarProps {
  activeStep: WorkflowStep;
  onStepChange: (step: WorkflowStep) => void;
  contactCount: number;
  jobCount: number;
  buildPathCount: number;
  pathCount: number;
  hasDraft: boolean;
}

const steps: { id: WorkflowStep; label: string; icon: typeof Search; description: string }[] = [
  { id: "scout", label: "Scout", icon: Search, description: "Find 2nd-degree targets" },
  { id: "import", label: "Contacts", icon: Users, description: "Import your network" },
  { id: "jobs", label: "Jobs", icon: Briefcase, description: "Pick target roles" },
  { id: "buildPath", label: "Build Path", icon: GitBranch, description: "Promote candidates" },
  { id: "rank", label: "Rank", icon: BarChart3, description: "Score warm paths" },
  { id: "draft", label: "Draft", icon: FileText, description: "Generate outreach" },
];

export function AppSidebar(props: AppSidebarProps) {
  function getBadge(id: WorkflowStep): string | null {
    switch (id) {
      case "import":
        return props.contactCount > 0 ? String(props.contactCount) : null;
      case "jobs":
        return props.jobCount > 0 ? String(props.jobCount) : null;
      case "rank":
        return props.pathCount > 0 ? String(props.pathCount) : null;
      case "buildPath":
        return props.buildPathCount > 0 ? String(props.buildPathCount) : null;
      case "draft":
        return props.hasDraft ? "Ready" : null;
      default:
        return null;
    }
  }

  const activeIndex = steps.findIndex((s) => s.id === props.activeStep);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-sidebar-background text-sidebar-foreground">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary/20">
          <div className="size-3 rounded-full bg-sidebar-primary" />
        </div>
        <span className="font-display text-lg font-semibold tracking-tight text-sidebar-accent-foreground">
          WarmPath
        </span>
      </div>

      {/* Steps */}
      <nav className="flex flex-1 flex-col px-3 pt-2">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-muted">
          Workflow
        </p>

        <div className="relative flex flex-col gap-0.5">
          {/* Vertical connector line */}
          <div
            className="absolute left-[22px] top-[20px] w-px bg-sidebar-border"
            style={{ height: `calc(100% - 40px)` }}
          />
          {/* Active progress overlay */}
          {activeIndex > 0 && (
            <div
              className="absolute left-[22px] top-[20px] w-px bg-sidebar-primary/60 transition-all duration-500"
              style={{ height: `${activeIndex * 44}px` }}
            />
          )}

          {steps.map((step, index) => {
            const badge = getBadge(step.id);
            const Icon = step.icon;
            const isActive = props.activeStep === step.id;
            const isPast = index < activeIndex;

            return (
              <button
                key={step.id}
                onClick={() => props.onStepChange(step.id)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                {/* Step indicator dot */}
                <div
                  className={cn(
                    "relative z-10 flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                    isActive
                      ? "border-sidebar-primary bg-sidebar-primary text-sidebar-background"
                      : isPast
                        ? "border-sidebar-primary/50 bg-sidebar-primary/20 text-sidebar-primary"
                        : "border-sidebar-border bg-sidebar-background/5 text-sidebar-muted",
                  )}
                >
                  <Icon className="size-2.5" strokeWidth={2.5} />
                </div>

                <div className="flex flex-1 flex-col text-left">
                  <span className={cn(
                    "text-[13px] font-medium leading-tight",
                    isActive && "text-sidebar-accent-foreground",
                  )}>
                    {step.label}
                  </span>
                  <span className={cn(
                    "text-[10px] leading-tight transition-colors",
                    isActive ? "text-sidebar-foreground/50" : "text-sidebar-muted",
                  )}>
                    {step.description}
                  </span>
                </div>

                {badge ? (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-auto h-5 border-0 px-1.5 text-[10px] font-semibold",
                      isActive
                        ? "bg-sidebar-primary/20 text-sidebar-primary"
                        : "bg-sidebar-accent text-sidebar-foreground/60",
                    )}
                  >
                    {badge}
                  </Badge>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-[10px] text-sidebar-muted">
          Local-first job seeker copilot
        </p>
      </div>
    </aside>
  );
}
