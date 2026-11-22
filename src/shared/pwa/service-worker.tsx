import { RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { workerAllowed, workerBuild } from "./detect";
import { IosInstallDialog } from "./ios-install-dialog";
import { setNotificationOpener } from "./system-notify";

/** This build's name (next.config.ts): the worker's address carries it, so each deploy brings a new worker. */
const BUILD = process.env.NEXT_PUBLIC_APP_BUILD ?? "dev";

/**
 * The app's side of public/sw.js, once for the whole site (the root providers): registers the worker (production
 * builds only, on https or localhost), opens the page a notification click asks for, holds the iOS install how-to,
 * and shows "a new version is ready" when a newer build's worker waits, so the person reloads when it suits them.
 */
export function PwaSupport() {
  const { tr } = useFmt();
  const router = useRouter();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloading = useRef(false);

  // A click on a notification: the app moves to its page (no full reload).
  useEffect(() => {
    setNotificationOpener((url) => router.push(url));
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "open" && typeof e.data.url === "string" && e.data.url.startsWith("/")) router.push(e.data.url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // The dev server never uses one, and drops a worker left by a built site tried on the same address.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister()), () => {});
      return;
    }
    if (!workerAllowed(location.protocol, location.hostname)) return;

    let reg: ServiceWorkerRegistration | undefined;
    /** A worker finished installing while another runs this page. */
    const offer = (w: ServiceWorker) => {
      if (!navigator.serviceWorker.controller) return;
      // This page is already the new build (it loaded fresh from the network): it takes over quietly, no reload.
      if (workerBuild(w.scriptURL) === BUILD) w.postMessage({ type: "SKIP_WAITING" });
      else setWaiting(w);
    };
    const watch = (r: ServiceWorkerRegistration) => {
      if (r.waiting) offer(r.waiting);
      r.addEventListener("updatefound", () => {
        const w = r.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed") offer(w);
        });
      });
    };
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(BUILD)}`, { scope: "/", updateViaCache: "none" }).then(
      (r) => {
        reg = r;
        watch(r);
      },
      () => {},
    );
    // After "Reload": the new worker took over, so load the page from it.
    const onChange = () => {
      if (reloading.current) window.location.reload();
    };
    // Back to the app after a while: ask for a newer worker.
    const onVisible = () => {
      if (document.visibilityState === "visible") reg?.update().catch(() => {});
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const reload = () => {
    if (!waiting) return;
    reloading.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <>
      <IosInstallDialog />
      {waiting && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
          <div
            role="status"
            className="menu-pop pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-card py-2 ps-4 pe-2 shadow-[0_18px_44px_-14px_rgb(70_12_40/0.35)] dark:shadow-[0_18px_44px_-10px_rgb(0_0_0/0.7)]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <RefreshCw size={15} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-sm">{tr("نسخة جديدة من المنصة جاهزة.", "A new version of the platform is ready.")}</span>
            <button type="button" onClick={reload} className="h-9 shrink-0 rounded-xl bg-accent px-3.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover">
              {tr("أعد التحميل", "Reload")}
            </button>
            <button type="button" onClick={() => setWaiting(null)} aria-label={tr("لاحقاً", "Later")} className="rounded-full p-1.5 text-muted hover:bg-chip hover:text-text">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
