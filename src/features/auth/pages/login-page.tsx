import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/shared/api";
import type { User } from "@/shared/api/types";
import { ROLES } from "@/shared/lib/access";
import { setLang, useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { setSession, useSession } from "@/shared/lib/session";
import { Logo } from "@/shared/shell";
import { BRAND } from "@/shared/lib/brand";
import { cn } from "@/shared/lib/utils";
import { Avatar, Button, Field, Input, LightRiver, Reveal, errorText } from "@/shared/ui";
import { authApi } from "../api";
import { FlowPlate, FlowWindow, HistoryPreview, IntroRing, SprintMeter, WeekPreview } from "../components/front-door";
import { safeNext } from "../safe-next";

/** The river of light down the side of the front door, in the brand palette: blush → dusty rose → mauve → fading wine. */
const RIVER_COLORS: [string, string, string, string] = ["#f2dace", "#d49a9a", "#aa5e7a", "rgba(124, 14, 68, 0)"];

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
  const logoRef = useRef<HTMLSpanElement>(null);
  const [landed, setLanded] = useState(false);
  const land = useCallback(() => setLanded(true), []);
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
    // The front door (19 November 2026): the ring counts the page in and folds into the logo, a river of light winds down the
    // page between the content (it travels with it as you scroll), a glass window shows a live task in the hero, a plate opens out of the logo mid-page, and the
    // sections settle into focus. Signing in is always right at the top. Motion is decoration only (see front-door.tsx).
    <main className="front-door relative min-h-dvh overflow-x-clip">
      <IntroRing target={logoRef} onLand={land} />
      <LightRiver colors={RIVER_COLORS} />
      <div className="relative z-10">

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-6 sm:px-8">
        <span ref={logoRef} data-river-avoid className={cn("inline-block rounded-xl", landed && "logo-land")}>
          <Logo />
        </span>
        <Button data-river-avoid variant="ghost" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          {lang === "ar" ? "English" : "العربية"}
        </Button>
      </header>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-8 lg:grid-cols-[minmax(0,440px)_1fr] lg:pt-16">
        <div data-river-avoid className="settle flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="w-fit rounded-full border border-line bg-card/60 px-3 py-1 text-xs text-muted">{tr("منصة الشركة الداخلية", "The company's own platform")}</span>
            <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">
              {tr("كل مشروع وكل مهمة،", "Every project and task,")} <span className="text-accent">{tr("في مكان واحد.", "in one place.")}</span>
            </h1>
            <p className="text-muted">{tr("المهام والدورات والمحادثات والتقارير وتقييم الأداء، لكل فريق في الشركة.", "Tasks, sprints, chat, reports and reviews, for every team in the company.")}</p>
          </div>
            <div className="rounded-2xl border border-line bg-card/80 p-6 shadow-card backdrop-blur sm:p-8">
              <h2 className="text-2xl font-semibold">{tr("تسجيل الدخول", "Sign in")}</h2>
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
              <section aria-labelledby="demo-title">
                <h3 id="demo-title" className="mb-3 text-sm font-medium text-muted">
                  {tr("نسخة تجريبية: سجّل الدخول بأي وظيفة بضغطة واحدة", "Demo: sign in as any job with one tap")}
                </h3>
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
        <div className="flex justify-center lg:justify-end">
          <div data-river-avoid className="w-full max-w-[520px]">
            <FlowWindow />
          </div>
        </div>
      </section>

      <FlowPlate />

      {/* A wide gap between the two columns, so the river of light can run between the cards. */}
      <section
        data-river-avoid-children
        aria-label={tr("نظرة على المنصة", "A look at the platform")}
        className="mx-auto grid w-full max-w-6xl gap-5 px-4 pb-24 sm:px-8 md:grid-cols-2 md:gap-x-20"
      >
        <WeekPreview />
        <HistoryPreview />
        <SprintMeter />
        <Reveal as="section" delay={140} className="flex flex-col justify-center gap-4 rounded-3xl border border-line bg-accent-soft p-6">
          <h3 className="text-2xl font-semibold">{tr("جاهز لبدء يومك؟", "Ready to start your day?")}</h3>
          <p className="text-muted">{tr("سجّل الدخول بحسابك في الشركة.", "Sign in with your company account.")}</p>
          <Button
            className="h-11 w-fit"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              document.getElementById("identifier")?.focus({ preventScroll: true });
            }}
          >
            {tr("إلى تسجيل الدخول", "Go to sign in")}
          </Button>
        </Reveal>
      </section>

      <footer data-river-avoid className="border-t border-line px-4 py-6 text-center text-xs text-faint">{tr(BRAND.ar, BRAND.en)}</footer>
      </div>
    </main>
  );
}
