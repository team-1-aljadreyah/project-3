"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api/errors";
import { useFmt, type Tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-chip", className)} />;
}

/** A page that is loading: screen readers hear "loading", sighted people see grey blocks. */
export function LoadingBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const { tr } = useFmt();
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{tr("جارٍ التحميل…", "Loading…")}</span>
      {children}
    </div>
  );
}

export function Empty({ title, body, action }: { title: React.ReactNode; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** The message for a failed call, in the current language. */
export function errorText(e: unknown, tr: Tr) {
  if (e instanceof ApiError) {
    if (e.message) return e.message;
    if (e.code === "NETWORK") return tr("لا يوجد اتصال بالخادم. تحقق من الإنترنت.", "Can't reach the server. Check the internet.");
    if (e.status === 403) return tr("ليست لديك صلاحية لهذه الصفحة.", "You don't have access to this page.");
    if (e.status === 404) return tr("لم يُعثر على ما تبحث عنه.", "Not found.");
  }
  return tr("حدث خطأ غير متوقع.", "Something went wrong.");
}

/**
 * A failed load. A refusal (403) or a missing thing (404) offers "back", because trying again gives the same answer;
 * anything else (network, server) offers "try again".
 */
export function ErrorBox({ error, onRetry, backHref = "/" }: { error: unknown; onRetry?: () => void; backHref?: string }) {
  const { tr } = useFmt();
  const final = error instanceof ApiError && (error.status === 403 || error.status === 404);
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-line bg-card px-6 py-10 text-center">
      <p className="font-medium">{errorText(error, tr)}</p>
      {final || !onRetry ? (
        <Link href={backHref} className="text-sm font-medium text-accent underline underline-offset-4">
          {tr("رجوع", "Back")}
        </Link>
      ) : (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {tr("إعادة المحاولة", "Try again")}
        </Button>
      )}
    </div>
  );
}
