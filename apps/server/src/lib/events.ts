import type { WarmPathEvent } from "../../../../packages/shared/src/contracts/warm-path";

export type EventWriter = (event: WarmPathEvent) => void;

export function trackEvent(writer: EventWriter, event: WarmPathEvent): void {
  writer(event);
}
