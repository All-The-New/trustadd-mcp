import type { AgentMetadataEvent } from "@shared/schema";
import { EventTimeline } from "@/components/event-timeline";
interface Props {
  events: AgentMetadataEvent[] | { message: string; fullReportPrice: string } | undefined;
  isLoading: boolean;
}
export function HistoryTab({ events, isLoading }: Props) {
  const arr = Array.isArray(events) ? events : [];
  return <EventTimeline events={arr} isLoading={isLoading} />;
}
