import { Lock, Megaphone, X } from "lucide-react";
import { useState } from "react";
import type { Role } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import type { Banner } from "@/shared/lib/site";
import { useSiteLive } from "@/shared/lib/site";
import { cn } from "@/shared/lib/utils";

/** The CEO's banner. Also the live preview in the advanced settings (`preview`: no close button, not announced). */
export function BannerBar({ banner, preview, onClose }: { banner: Pick<Banner, "text" | "text_en" | "tone">; preview?: boolean; onClose?: () => void }) {
  const { tr, lang } = useFmt();
  const text = lang === "en" && banner.text_en?.trim() ? banner.text_en : banner.text;
  return (
    <div
      role={preview ? undefined : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium",
        banner.tone === "warning" ? "border-(--st-review-ink)/25 bg-(--st-review) text-(--st-review-ink)" : "border-accent/20 bg-accent-soft text-accent-ink",
      )}
    >
      <Megaphone size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p dir="auto" className="min-w-0 flex-1 leading-relaxed whitespace-pre-line">
        {text.trim() || tr("نص الإعلان…", "The banner's text…")}
      </p>
      {onClose && (
        <button type="button" onClick={onClose} aria-label={tr("إخفاء الإعلان", "Hide the banner")} className="-m-1 shrink-0 rounded-full p-1 opacity-70 hover:bg-black/5 hover:opacity-100">
          <X size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * Under the top bar: the CEO's banner (for this person's job) and the read-only notice. The CEO sees that read-only
 * mode is on for everyone else; the others see that changes are paused.
 */
export function SiteNotices({ role }: { role: Role }) {
  const { tr, lang } = useFmt();
  const live = useSiteLive();
  const [hidden, setHidden] = useState<string | null>(null);
  const banner = live.banner && hidden !== live.banner.text ? live.banner : null;
  const ro = live.read_only;
  if (!banner && !ro.on) return null;
  const roText = lang === "en" && ro.message_en?.trim() ? ro.message_en : ro.message;
  return (
    <div className="mx-3 mt-3 flex flex-col gap-2 sm:mx-7 print:hidden">
      {ro.on && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-line-strong/50 bg-card px-4 py-2.5 text-sm">
          <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
          <p dir="auto" className="min-w-0 flex-1">
            <b className="font-semibold">{role === "ceo" ? tr("وضع القراءة فقط مفعّل للجميع غيرك.", "Read-only mode is on for everyone but you.") : tr("المنصة في وضع القراءة فقط.", "The platform is read-only.")}</b>{" "}
            <span className="text-muted">{role === "ceo" ? tr("تُرفض تعديلاتهم حتى توقفه.", "Their changes are refused until you turn it off.") : roText}</span>
          </p>
        </div>
      )}
      {banner && <BannerBar banner={banner} onClose={() => setHidden(banner.text)} />}
    </div>
  );
}
