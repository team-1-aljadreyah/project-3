// "The data changed": one signal every open screen listens to (through useLoad), so lists and boards show the
// new state by themselves. Sources today: a change saved in this tab, and changes from other tabs of this browser
// (BroadcastChannel). The server's live updates (WebSocket) plug in here later, the same way as in Project 2.
//
// Many changes close together become one refresh (a short wait), so a screen never loads ten times in a row.

const listeners = new Set<() => void>();
let wait: ReturnType<typeof setTimeout> | undefined;
let channel: BroadcastChannel | null = null;

function fire() {
  clearTimeout(wait);
  wait = setTimeout(() => {
    listeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
  }, 80);
}

function start() {
  if (channel || typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  channel = new BroadcastChannel("p3-live");
  channel.onmessage = fire;
}

/** Something was saved: refresh this tab's screens and tell the other tabs. */
export function dataChanged() {
  start();
  fire();
  try {
    channel?.postMessage("changed");
  } catch {}
}

/** Call `listener` when data changes anywhere. Returns a function that stops listening. */
export function onDataChange(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
