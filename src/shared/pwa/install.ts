// Installing the site as an app. Chrome, Edge and Samsung Internet (Android, computers) offer it through the
// `beforeinstallprompt` event: it is kept here, so the account menu and the phone hint can show the browser's own
// install window when the person asks. iPhone and iPad have no such event: they get a short how-to instead (Share,
// then "Add to Home Screen"). Nothing is offered once the app is installed or opened from the home screen.
import { useSyncExternalStore } from "react";
import { iosCanAddToHome, isStandalone } from "./detect";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** How this browser installs the app: its own window ("prompt"), the iOS how-to ("ios"), or not at all. */
export type InstallWay = "prompt" | "ios" | null;

let offer: BeforeInstallPromptEvent | null = null;
let installed = false;
let iosHelpOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// Listening starts as soon as this file loads (the root providers import it), before the event can fire.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Not the browser's own small banner: the app offers it in its menu and with a hint on phones.
    e.preventDefault();
    offer = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    offer = null;
    installed = true;
    emit();
  });
  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", emit);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function currentWay(): InstallWay {
  if (installed || isStandalone()) return null;
  if (offer) return "prompt";
  return iosCanAddToHome(navigator.userAgent, navigator.maxTouchPoints) ? "ios" : null;
}

/** How this browser can install the app now (null: it can't, or it is installed). Redraws when that changes. */
export function useInstallWay(): InstallWay {
  return useSyncExternalStore(subscribe, currentWay, () => null);
}

/**
 * Install: the browser's own window, or the iOS how-to. Resolves true when the person accepted the browser's window
 * (the offer is used up either way: a browser gives it once per page).
 */
export async function installApp(): Promise<boolean> {
  if (offer) {
    const e = offer;
    offer = null;
    emit();
    try {
      await e.prompt();
      const { outcome } = await e.userChoice;
      if (outcome === "accepted") installed = true;
      emit();
      return outcome === "accepted";
    } catch {
      return false;
    }
  }
  if (currentWay() === "ios") {
    iosHelpOpen = true;
    emit();
  }
  return false;
}

export function closeIosHelp() {
  iosHelpOpen = false;
  emit();
}

/** Is the iOS how-to open? */
export function useIosHelpOpen() {
  return useSyncExternalStore(
    subscribe,
    () => iosHelpOpen,
    () => false,
  );
}
