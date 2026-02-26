import type { ReactNode } from "react";
import { AppSidebar, type WorkflowStep } from "./AppSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AppLayoutProps {
  activeStep: WorkflowStep;
  onStepChange: (step: WorkflowStep) => void;
  contactCount: number;
  jobCount: number;
  pathCount: number;
  hasDraft: boolean;
  children: ReactNode;
}

export function AppLayout(props: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        activeStep={props.activeStep}
        onStepChange={props.onStepChange}
        contactCount={props.contactCount}
        jobCount={props.jobCount}
        pathCount={props.pathCount}
        hasDraft={props.hasDraft}
      />
      <ScrollArea className="flex-1">
        <main className="mx-auto max-w-3xl p-6">{props.children}</main>
      </ScrollArea>
    </div>
  );
}
