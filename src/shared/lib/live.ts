// "The data changed": one signal every open screen listens to (through useLoad), so lists and boards show the
// new state by themselves. Sources: a change saved in this tab, changes from other tabs of this browser
// (BroadcastChannel), and the server's live updates (its WebSocket, socket.ts) when the build has one.
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

/** The server said something changed (its WebSocket, socket.ts): refresh this tab's screens. Not told to the other
 * tabs, since each tab has its own socket and hears the same news. */
export function serverChanged() {
  start();
  fire();
}

/** Call `listener` when data changes anywhere. Returns a function that stops listening. */
export function onDataChange(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
