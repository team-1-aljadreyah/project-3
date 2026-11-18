/**
 * Shown when a page crashes while drawing, or its code can't be downloaded (for example the site was updated while
 * the tab was open). Plain on purpose: it must work even when the rest of the app doesn't. Reloading fixes both cases.
 */
export function RouteError() {
  return (
    <main role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold">حدث خطأ غير متوقع</h1>
      <p className="text-muted" lang="en" dir="ltr">
        Something went wrong
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-lg bg-accent px-4 py-2 font-medium text-on-accent hover:bg-accent-hover"
      >
        إعادة تحميل الصفحة · Reload
      </button>
    </main>
  );
}
