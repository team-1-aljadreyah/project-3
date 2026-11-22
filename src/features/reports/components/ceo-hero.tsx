import Link from "next/link";
import type { User } from "@/shared/api/types";
import { Greeting } from "@/shared/ui";
import { useFmt } from "@/shared/lib/i18n";

/**
 * The top of the CEO's dashboard: a wine night sky over a ridge, with the page's name, one line that says what the
 * platform is for, today's numbers and the way to the reports. The words arrive one after the other. Always dark,
 * whatever the theme (styles in app/styles.css, `.night-hero`). Decoration only: with "reduce motion" it is simply there.
 */
export function CeoHero({ user, numbers }: { user: Pick<User, "name" | "name_en">; numbers: { label: string; value: string; alert?: boolean; href: string }[] }) {
  const { tr } = useFmt();
  return (
    <section aria-labelledby="dashboard-title" className="night-hero relative isolate overflow-hidden rounded-3xl px-5 py-14 text-center sm:py-20">
      <span aria-hidden="true" className="night-stars" />
      <span aria-hidden="true" className="night-stars night-stars-far" />
      {/* Two ridges, the far one lighter: a drawing, not a photo. */}
      <svg aria-hidden="true" viewBox="0 0 1200 200" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 -z-10 h-[40%] w-full">
        <path d="M0 200V118l90-26 70 20 110-62 80 38 60-16 120 54 90-68 70 28 100-56 130 80 90-32 100 44 90-28v104z" fill="#2a1322" />
        <path d="M0 200V152l120-34 90 28 80-20 130 42 110-64 90 50 120-28 100 36 140-50 110 42 110-26v64z" fill="#12090f" />
      </svg>
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
        <h1 id="dashboard-title" className="hero-in rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-xs font-medium text-[#f2dace]">
          {tr("لوحة التحكم", "Dashboard")}
        </h1>
        <Greeting user={user} size="md" className="items-center text-center" />
        <p className="hero-in text-3xl leading-tight font-semibold text-white sm:text-5xl sm:leading-tight">
          {tr("كل ما في الشركة،", "Everything in the company,")}
          <br />
          {tr("في مكان واحد.", "in one place.")}
        </p>
        <ul className="hero-in flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-[#e6d3da]">
          {numbers.map((n) => (
            <li key={n.label}>
              <Link href={n.href} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-white">
                {n.label}:{" "}
                <b dir="ltr" className={n.alert ? "num font-semibold text-[#ffb9b1]" : "num font-semibold text-white"}>
                  {n.value}
                </b>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/reports"
          className="hero-in mt-2 inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-medium text-[#3b0720] transition-colors hover:bg-[#f2dace] focus-visible:outline-white"
        >
          {tr("كل التقارير", "All reports")}
        </Link>
      </div>
    </section>
  );
}
