// The banner on top of every page (for the jobs chosen, until a time) with a live preview, and read-only mode.
import { Lock, Megaphone } from "lucide-react";
import { useId } from "react";
import { ROLES } from "@/shared/lib/access";
import { BannerBar } from "@/shared/shell";
import { Input, Textarea } from "@/shared/ui";
import { ALL_ROLES, DEFAULT_RULES as D, LIMITS } from "../rules";
import type { Banner } from "../types";
import { Chips, type Ctx, Part, Row, Segmented, Switch } from "./controls";
import { Live } from "./parts-rules";

// Ready texts: switching on writes one you can change, so nothing turns red at once.
const READY_BANNER = { ar: "إعلان من الإدارة: اكتب هنا ما تريد أن يراه الجميع.", en: "A notice from the management." };
const READY_READ_ONLY = { ar: "نحدّث المنصة الآن. يمكنكم الاطلاع على كل شيء، وسيُتاح التعديل مجدداً قريباً.", en: "We are updating the platform. You can look at everything; changes come back shortly." };

/** "2026-11-21T10:30" for a datetime box, in local time. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function AnnouncePart(c: Ctx) {
  const { tr, r } = c;
  const b = r.banner;
  const ro = r.read_only;
  const setB = (p: Partial<Banner>) => c.set({ banner: { text: "", roles: [], tone: "info", ...b, ...p } });
  const setRo = (p: Partial<typeof ro>) => c.set({ read_only: { ...ro, ...p } });
  const ids = { text: useId(), until: useId(), msg: useId() };

  return (
    <div className="flex flex-col gap-5">
      <Part title={tr("إعلان أعلى الصفحات", "A banner on top of every page")} sub={tr("يظهر لمن تختار حتى تحذفه أو ينتهي وقته", "Shown to whom you choose until you remove it or it ends")} icon={<Megaphone size={17} aria-hidden="true" className="text-accent" />} action={<Live />}>
        <Row label={tr("الإعلان", "The banner")} changed={!!b} onDefault={() => c.set({ banner: D.banner })} defText={tr("بلا إعلان", "None")}>
          <Switch
            checked={!!b}
            onChange={(on) => c.set({ banner: on ? { text: READY_BANNER.ar, text_en: READY_BANNER.en, roles: [], tone: "info" } : null })}
            label={tr("الإعلان", "The banner")}
            text={b ? tr("ظاهر", "Shown") : tr("بلا إعلان", "None")}
          />
        </Row>
        {b && (
          <>
            <Row label={tr("النص", "Text")} hint={tr(`حتى ${LIMITS.banner} حرف`, `Up to ${LIMITS.banner} letters`)} error={c.errors["banner.text"]} errorId={ids.text}>
              <Textarea
                aria-label={tr("نص الإعلان", "The banner's text")}
                value={b.text}
                maxLength={LIMITS.banner}
                onChange={(e) => setB({ text: e.target.value })}
                invalid={!!c.errors["banner.text"]}
                aria-describedby={c.errors["banner.text"] ? ids.text : undefined}
                className="min-h-20"
              />
            </Row>
            <Row label={tr("النص بالإنجليزية (اختياري)", "English text (optional)")} hint={tr("لمن يستعمل المنصة بالإنجليزية", "For people who use the platform in English")} error={c.errors["banner.text_en"]}>
              <Input dir="ltr" aria-label={tr("نص الإعلان بالإنجليزية", "The banner's English text")} value={b.text_en ?? ""} maxLength={LIMITS.banner} onChange={(e) => setB({ text_en: e.target.value || undefined })} />
            </Row>
            <Row label={tr("لمن", "For whom")} hint={tr("بلا اختيار = الجميع", "None chosen = everyone")} error={c.errors["banner.roles"]}>
              <Chips label={tr("لمن يظهر الإعلان", "Who sees the banner")} value={b.roles} options={ALL_ROLES.map((x) => ({ v: x, l: tr(ROLES[x].ar, ROLES[x].en) }))} onChange={(roles) => setB({ roles })} />
            </Row>
            <Row label={tr("اللون", "Colour")}>
              <Segmented
                label={tr("لون الإعلان", "The banner's colour")}
                value={b.tone}
                onChange={(tone) => setB({ tone })}
                options={[
                  { v: "info", l: tr("معلومة", "Info") },
                  { v: "warning", l: tr("تنبيه", "Warning") },
                ]}
              />
            </Row>
            <Row label={tr("ينتهي في (اختياري)", "Ends at (optional)")} hint={tr("بعده يختفي وحده", "After it, the banner goes by itself")} error={c.errors["banner.until"]} errorId={ids.until}>
              <Input
                type="datetime-local"
                dir="ltr"
                aria-label={tr("ينتهي الإعلان في", "The banner ends at")}
                value={b.until ? toLocalInput(b.until) : ""}
                onChange={(e) => setB({ until: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              />
            </Row>
            <div className="border-t border-line bg-card-2 px-5 py-4">
              <p className="mb-2 text-xs font-medium text-muted">{tr("هكذا يظهر أعلى الصفحات:", "This is how it shows on top of the pages:")}</p>
              <BannerBar banner={b} preview />
            </div>
          </>
        )}
      </Part>

      <Part
        title={tr("وضع القراءة فقط", "Read-only mode")}
        sub={tr("يرى الجميع غيرك كل شيء، ولا يحفظ الخادم تعديلاتهم (مثلاً أثناء نقل البيانات)", "Everyone but you sees everything, and the server saves none of their changes (during a data move, say)")}
        icon={<Lock size={17} aria-hidden="true" className="text-accent" />}
        action={<Live />}
      >
        <Row
          label={tr("وضع القراءة فقط", "Read-only mode")}
          hint={tr("يبقى لهم الدخول وقراءة إشعاراتهم ومحادثاتهم", "They can still sign in and read their notifications and chats")}
          changed={ro.on}
          onDefault={() => setRo({ on: false })}
          defText={tr("متوقف", "Off")}
        >
          <Switch
            checked={ro.on}
            onChange={(on) => setRo({ on, ...(on && !ro.message.trim() ? { message: READY_READ_ONLY.ar, message_en: ro.message_en || READY_READ_ONLY.en } : {}) })}
            label={tr("وضع القراءة فقط", "Read-only mode")}
            text={ro.on ? tr("مفعّل الآن", "On now") : tr("متوقف", "Off")}
          />
        </Row>
        <Row label={tr("الرسالة للموظفين", "The message to the staff")} hint={tr("تظهر أعلى الصفحات ومع كل تعديل يُرفض", "Shown on top of the pages and with every refused change")} error={c.errors["read_only.message"]} errorId={ids.msg}>
          <Textarea
            aria-label={tr("رسالة وضع القراءة فقط", "The read-only message")}
            value={ro.message}
            maxLength={LIMITS.readOnly}
            onChange={(e) => setRo({ message: e.target.value })}
            invalid={!!c.errors["read_only.message"]}
            aria-describedby={c.errors["read_only.message"] ? ids.msg : undefined}
            className="min-h-20"
          />
        </Row>
        <Row label={tr("الرسالة بالإنجليزية (اختياري)", "English message (optional)")}>
          <Input dir="ltr" aria-label={tr("رسالة وضع القراءة فقط بالإنجليزية", "The read-only message in English")} value={ro.message_en ?? ""} maxLength={LIMITS.readOnly} onChange={(e) => setRo({ message_en: e.target.value || undefined })} />
        </Row>
      </Part>
    </div>
  );
}
