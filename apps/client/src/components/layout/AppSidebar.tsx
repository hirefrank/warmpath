import { Search, Users, Briefcase, BarChart3, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type WorkflowStep = "scout" | "import" | "jobs" | "rank" | "draft";

interface AppSidebarProps {
  activeStep: WorkflowStep;
  onStepChange: (step: WorkflowStep) => void;
  contactCount: number;
  jobCount: number;
  pathCount: number;
  hasDraft: boolean;
}

const steps: { id: WorkflowStep; label: string; icon: typeof Search }[] = [
  { id: "scout", label: "Scout", icon: Search },
  { id: "import", label: "Contacts", icon: Users },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "rank", label: "Rank", icon: BarChart3 },
  { id: "draft", label: "Draft", icon: FileText },
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
      case "draft":
        return props.hasDraft ? "Ready" : null;
      default:
        return null;
    }
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-sidebar-background text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-semibold tracking-tight">WarmPath</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {steps.map((step) => {
          const badge = getBadge(step.id);
          const Icon = step.icon;
          const isActive = props.activeStep === step.id;
          return (
            <button
              key={step.id}
              onClick={() => props.onStepChange(step.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{step.label}</span>
              {badge ? (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {badge}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
