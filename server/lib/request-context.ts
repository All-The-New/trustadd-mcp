import { AsyncLocalStorage, type AsyncResource } from "node:async_hooks";
import { randomUUID } from "node:crypto";

interface RequestContext {
  requestId: string;
  startTime: number;
}

export const requestStore = new AsyncLocalStorage<RequestContext>();

export function getRequestId(): string | undefined {
  return requestStore.getStore()?.requestId;
}

export function getRequestStart(): number | undefined {
  return requestStore.getStore()?.startTime;
}

export function generateRequestId(): string {
  return randomUUID();
}
