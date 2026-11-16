"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Logo } from "@/components/shell/logo";
import { Avatar, Button, Field, Input, errorText } from "@/components/ui";
import { ROLES } from "@/lib/access";
import { api, ApiError } from "@/lib/api";
import type { Role } from "@/lib/api/types";
import { setSession, useSession } from "@/lib/auth";
import { USE_MOCK } from "@/lib/config";
import { setLang, useFmt } from "@/lib/i18n";
import { safeNext } from "@/lib/safe-next";

// One demo account per job, shown only in the demo build (USE_MOCK). The real site never has them.
const DEMO: { id: number; name: string; email: string; role: Role }[] = [
  { id: 1, name: "مريم العبيدي", email: "ceo@demo.test", role: "ceo" },
  { id: 2, name: "أحمد كريم", email: "pm@demo.test", role: "pm" },
  { id: 3, name: "هدى ناصر", email: "monitor@demo.test", role: "monitor" },
  { id: 4, name: "مصطفى جواد", email: "lead@demo.test", role: "lead" },
  { id: 5, name: "سارة علي", email: "employee@demo.test", role: "employee" },
  { id: 8, name: "حسن رعد", email: "admin@demo.test", role: "admin" },
];

function LoginForm() {
  const { tr, lang } = useFmt();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const session = useSession();
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
      setSession(await api.login(id, pw));
      // The effect above moves on once the session is saved.
    } catch (e) {
      setBusy(false);
      setError({ message: errorText(e, tr), fields: e instanceof ApiError ? e.errors : undefined });
    }
  };

  return (
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

      {USE_MOCK && (
        <section aria-labelledby="demo-title" className="mt-6">
          <h2 id="demo-title" className="mb-3 text-sm font-medium text-muted">
            {tr("نسخة تجريبية: سجّل الدخول بأي وظيفة بضغطة واحدة", "Demo: sign in as any job with one tap")}
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEMO.map((d) => (
              <li key={d.email}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => signIn(d.email, "123456")}
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
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center">
      {/* The page reads ?next= from the address, which needs a Suspense boundary in Next.js. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
