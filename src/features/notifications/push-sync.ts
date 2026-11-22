// Push while the app is closed: tells the backend about this device's push address, or that it is gone. Runs only
// when NEXT_PUBLIC_PUSH_PUBLIC_KEY is set (the backend sends push) and the person allowed system notifications.
import { pushAvailable, subscribePush, unsubscribePush } from "@/shared/pwa";
import { notificationsApi } from "./api";

/** Once per page load is enough: the backend keeps the same address (adding it again changes nothing). */
let sentFor: number | null = null;

export async function syncPush(userId: number, on: boolean) {
  if (!pushAvailable()) return;
  if (on) {
    if (sentFor === userId) return;
    const sub = await subscribePush();
    if (!sub) return;
    await notificationsApi.addPushSubscription(sub).then(
      () => (sentFor = userId),
      () => {},
    );
  } else {
    sentFor = null;
    const endpoint = await unsubscribePush();
    if (endpoint) await notificationsApi.removePushSubscription(endpoint).catch(() => {});
  }
}
