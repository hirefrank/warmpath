import type { ReactNode } from "react";
import { AppSidebar, type WorkflowStep } from "./AppSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AppLayoutProps {
  activeStep: WorkflowStep;
  onStepChange: (step: WorkflowStep) => void;
  contactCount: number;
  jobCount: number;
  buildPathCount: number;
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
        buildPathCount={props.buildPathCount}
        pathCount={props.pathCount}
        hasDraft={props.hasDraft}
      />
      <ScrollArea className="flex-1 bg-grain">
        <div
          className="pointer-events-none fixed inset-0 left-64"
          style={{
            background: "radial-gradient(ellipse at 30% 0%, oklch(0.92 0.03 65 / 0.4), transparent 60%)",
          }}
        />
        <main className="relative z-10 mx-auto max-w-3xl px-8 py-8">{props.children}</main>
      </ScrollArea>
    </div>
  );
}
