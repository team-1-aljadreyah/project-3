// Push while the app is closed (24 November 2026, "still not getting the notification when I'm outside the app"): the
// device's sign-up with the server is no longer silent. The notifications page shows whether it worked, or what stopped
// it, with the server's code, so a broken link in the chain is seen on the phone itself.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/errors";
import { sameKey } from "@/shared/pwa/push";

const pwa = vi.hoisted(() => ({
  pushAvailable: vi.fn(() => true),
  subscribePush: vi.fn(),
  unsubscribePush: vi.fn(async () => null as string | null),
}));
const api = vi.hoisted(() => ({ addPushSubscription: vi.fn(), removePushSubscription: vi.fn(async () => {}) }));
vi.mock("@/shared/pwa", () => pwa);
vi.mock("@/features/notifications/api", () => ({ notificationsApi: api }));

const { syncPush, resetPushForTests, usePushState } = await import("@/features/notifications/push-sync");
// The state is read the same way the page reads it, without React: the store's current value.
const { renderToString } = await import("react-dom/server");
const { createElement } = await import("react");
const current = () => {
  let s: unknown;
  renderToString(createElement(() => ((s = usePushState()), null)));
  return s;
};

const SUB = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "p", auth: "a" }, device: "Android · Chrome" };

beforeEach(() => {
  resetPushForTests();
  vi.clearAllMocks();
  pwa.pushAvailable.mockReturnValue(true);
});

describe("signing this device up for push", () => {
  it("says it is signed up once the server keeps the address, and doesn't send it twice", async () => {
    pwa.subscribePush.mockResolvedValue(SUB);
    api.addPushSubscription.mockResolvedValue(undefined);
    await syncPush(5, true);
    expect(api.addPushSubscription).toHaveBeenCalledWith(SUB);
    expect(current()).toEqual({ step: "on" });
    await syncPush(5, true);
    expect(api.addPushSubscription).toHaveBeenCalledTimes(1);
  });

  it("shows the server's code and first message when it refuses, and tries again on request", async () => {
    pwa.subscribePush.mockResolvedValue(SUB);
    api.addPushSubscription.mockRejectedValueOnce(new ApiError(422, "Invalid", { endpoint: "must be https" }));
    await syncPush(5, true);
    expect(current()).toEqual({ step: "problem", problem: "server", detail: "422 · endpoint: must be https" });
    api.addPushSubscription.mockRejectedValueOnce(new ApiError(500, "Server error"));
    await syncPush(5, true);
    expect(current()).toEqual({ step: "problem", problem: "server", detail: "500 · Server error" });
    api.addPushSubscription.mockResolvedValueOnce(undefined);
    await syncPush(5, true);
    expect(current()).toEqual({ step: "on" });
  });

  it("says when the browser gave no address, and sends nothing to the server", async () => {
    pwa.subscribePush.mockResolvedValue({ problem: "refused", detail: "Registration failed - push service error" });
    await syncPush(5, true);
    expect(api.addPushSubscription).not.toHaveBeenCalled();
    expect(current()).toEqual({ step: "problem", problem: "refused", detail: "Registration failed - push service error" });
  });

  it("turning it off forgets the address on the server too", async () => {
    pwa.unsubscribePush.mockResolvedValue(SUB.endpoint);
    await syncPush(5, false);
    expect(api.removePushSubscription).toHaveBeenCalledWith(SUB.endpoint);
    expect(current()).toEqual({ step: "off" });
  });

  it("does nothing in a build without the push key", async () => {
    pwa.pushAvailable.mockReturnValue(false);
    await syncPush(5, true);
    expect(pwa.subscribePush).not.toHaveBeenCalled();
    expect(current()).toEqual({ step: "off" });
  });
});

describe("an old sign-up made with another key", () => {
  it("is told apart from the current key, so it is made again", () => {
    const key = new Uint8Array([4, 1, 2, 3]);
    expect(sameKey(new Uint8Array([4, 1, 2, 3]).buffer, key)).toBe(true);
    expect(sameKey(new Uint8Array([4, 1, 2, 9]).buffer, key)).toBe(false);
    expect(sameKey(new Uint8Array([4, 1, 2]).buffer, key)).toBe(false);
    expect(sameKey(null, key)).toBe(false);
  });
});
