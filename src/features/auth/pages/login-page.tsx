import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/shared/api";
import type { User } from "@/shared/api/types";
import { ROLES } from "@/shared/lib/access";
import { setLang, useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { setSession, useSession } from "@/shared/lib/session";
import { Logo } from "@/shared/shell";
import { Avatar, Button, Field, Input, errorText } from "@/shared/ui";
import { authApi } from "../api";
import { safeNext } from "../safe-next";

interface Demo {
  accounts: User[];
  password: string;
}

/**
 * The demo build's one-tap accounts. They are loaded from the demo data, and only in a demo build: the check is
 * written out in full so the real build drops it, and no demo email or password is in the real site's files.
 */
function useDemoAccounts() {
  const [demo, setDemo] = useState<Demo | null>(null);
  useEffect(() => {
    // Written as an `if` block on purpose: the bundler removes the whole block (and the demo file) from the real build.
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      import("@/mock/seed").then((m) => setDemo({ accounts: m.demoAccounts(), password: m.DEMO_PASSWORD }));
    }
  }, []);
  return demo;
}

export function LoginPage() {
  const { tr, lang } = useFmt();
  usePageTitle(tr("تسجيل الدخول", "Sign in"));
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const session = useSession();
  const demo = useDemoAccounts();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; fields?: Record<string, string> } | null>(null);

  // Already signed in (another tab, or the back button): straight on.
  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  const signIn = async (id: string, pw: string) => {
    if (!id.trim() || !pw) {
      setError({
        message: "",
        fields: {
          ...(id.trim() ? {} : { identifier: tr("اكتب بريدك الإلكتروني.", "Enter your email.") }),
          ...(pw ? {} : { password: tr("اكتب كلمة المرور.", "Enter your password.") }),
        },
      });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setSession(await authApi.login(id, pw));
      // The effect above moves on once the session is saved.
    } catch (e) {
      setBusy(false);
      setError({ message: errorText(e, tr), fields: e instanceof ApiError ? e.errors : undefined });
    }
  };

  return (
    <main className="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <Button variant="ghost" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
            {lang === "ar" ? "English" : "العربية"}
          </Button>
        </div>

        <div className="rounded-2xl border border-line bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-semibold">{tr("تسجيل الدخول", "Sign in")}</h1>
          <p className="mt-1 text-sm text-muted">{tr("استخدم حسابك في الشركة.", "Use your company account.")}</p>

          <form
            className="mt-6 flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              signIn(identifier, password);
            }}
          >
            <Field label={tr("البريد الإلكتروني", "Email")} htmlFor="identifier" error={error?.fields?.identifier}>
              <Input
                id="identifier"
                type="email"
                autoComplete="username"
                dir="ltr"
                value={identifier}
                invalid={!!error?.fields?.identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </Field>
            <Field label={tr("كلمة المرور", "Password")} htmlFor="password" error={error?.fields?.password}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                value={password}
                invalid={!!error?.fields?.password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error?.message && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error.message}
              </p>
            )}
            <Button type="submit" disabled={busy} className="mt-2 h-11">
              {busy ? tr("جارٍ الدخول…", "Signing in…") : tr("دخول", "Sign in")}
            </Button>
          </form>
        </div>

        {demo && (
          <section aria-labelledby="demo-title" className="mt-6">
            <h2 id="demo-title" className="mb-3 text-sm font-medium text-muted">
              {tr("نسخة تجريبية: سجّل الدخول بأي وظيفة بضغطة واحدة", "Demo: sign in as any job with one tap")}
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {demo.accounts.map((d) => (
                <li key={d.email}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => signIn(d.email, demo.password)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-start transition-colors hover:border-accent"
                  >
                    <Avatar user={d} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{d.name}</span>
                      <span className="truncate text-xs text-muted">{tr(ROLES[d.role].ar, ROLES[d.role].en)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
