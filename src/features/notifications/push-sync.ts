// Push while the app is closed: tells the backend about this device's push address, or that it is gone. Runs only
// when NEXT_PUBLIC_PUSH_PUBLIC_KEY is set (the backend sends push) and the person allowed system notifications.
// The result is kept (pushState) so the notifications page can say whether this device is really signed up, or what
// stopped it: the browser, the app, or the server (with its error code).
import { useSyncExternalStore } from "react";
import { ApiError } from "@/shared/api";
import { pushAvailable, subscribePush, unsubscribePush, type PushProblem } from "@/shared/pwa";
import { notificationsApi } from "./api";

export type PushState =
  | { step: "off" }
  | { step: "working" }
  | { step: "on" }
  | { step: "problem"; problem: PushProblem | "server"; detail?: string };

let state: PushState = { step: "off" };
const listeners = new Set<() => void>();
const setState = (next: PushState) => {
  state = next;
  listeners.forEach((l) => l());
};

/** Where this device stands with push (for the notifications page). */
export function usePushState() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => state,
    () => state,
  );
}

/** What the server said, short: its status and its first field message ("422 · endpoint: …"). */
function serverDetail(e: unknown) {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : undefined;
  const field = e.errors && Object.entries(e.errors)[0];
  return [e.status || undefined, field ? `${field[0]}: ${field[1]}` : e.message].filter(Boolean).join(" · ");
}

/** Once per page load is enough: the backend keeps the same address (adding it again changes nothing). */
let sentFor: number | null = null;

export async function syncPush(userId: number, on: boolean) {
  if (!pushAvailable()) return;
  if (on) {
    if (sentFor === userId && state.step === "on") return;
    setState({ step: "working" });
    const sub = await subscribePush();
    if ("problem" in sub) return setState({ step: "problem", problem: sub.problem, detail: sub.detail });
    try {
      await notificationsApi.addPushSubscription(sub);
      sentFor = userId;
      setState({ step: "on" });
    } catch (e) {
      setState({ step: "problem", problem: "server", detail: serverDetail(e) });
    }
  } else {
    sentFor = null;
    setState({ step: "off" });
    const endpoint = await unsubscribePush();
    if (endpoint) await notificationsApi.removePushSubscription(endpoint).catch(() => {});
  }
}

/** For tests: back to the start. */
export function resetPushForTests() {
  sentFor = null;
  state = { step: "off" };
}
