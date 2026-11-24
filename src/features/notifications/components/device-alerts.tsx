import { Bell, BellRing, CircleCheck, MessageCircle, Play, TriangleAlert, Volume2 } from "lucide-react";
import { useEffect } from "react";
import { USE_MOCK } from "@/shared/lib/config";
import { useFmt } from "@/shared/lib/i18n";
import { useUser } from "@/shared/lib/session";
import { cn } from "@/shared/lib/utils";
import { askNotificationPermission, playChime, pushAvailable, useNotificationPermission, type ChimeKind } from "@/shared/pwa";
import type { DevicePrefs } from "../alerts";
import { saveDevicePrefs, useDevicePrefs } from "../device-prefs";
import { syncPush, usePushState } from "../push-sync";

/** A row that is one switch: the whole row is its label (click anywhere). */
function SwitchRow({
  icon,
  title,
  hint,
  on,
  disabled,
  onChange,
  extra,
  sub,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: React.ReactNode;
  on: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  extra?: React.ReactNode;
  sub?: boolean;
}) {
  return (
    <li className={cn("flex items-center gap-2 border-b border-line pe-3 last:border-b-0", sub && "bg-card-2/60")}>
      <label className={cn("flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-3 ps-4", sub && "ps-[3.75rem]", disabled && "cursor-default opacity-55")}>
        {icon && (
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
            {icon}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">{title}</span>
          {hint && <span className="text-[13px] text-muted">{hint}</span>}
        </span>
        {/* The real checkbox lies over the drawn switch (see-through), so it is what a tap or a click reaches. */}
        <span className="relative flex shrink-0">
          <input
            type="checkbox"
            role="switch"
            className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-default"
            checked={on}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span
            aria-hidden="true"
            className="relative h-6 w-10 rounded-full bg-chip transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white dark:after:bg-text dark:peer-checked:after:bg-on-accent after:shadow-[0_1px_3px_rgb(40_10_25/0.25)] after:transition-[inset-inline-start] peer-checked:after:start-[1.125rem] dark:bg-line"
          />
        </span>
      </label>
      {extra}
    </li>
  );
}

/**
 * The alerts on THIS device (the notifications page): system notifications (and the browser's permission), alerts for
 * chat messages, and the sounds, with a button to hear each one. Kept in this browser (device-prefs.ts); which kinds of
 * notification the person gets at all is the preferences below it, kept on the server.
 */
export function DeviceAlerts() {
  const { tr } = useFmt();
  const me = useUser().id;
  const prefs = useDevicePrefs(me);
  const permission = useNotificationPermission();
  const set = (change: Partial<DevicePrefs>) => saveDevicePrefs(me, change);

  const setSystem = async (on: boolean) => {
    if (on && permission === "default") {
      const answer = await askNotificationPermission();
      if (answer !== "granted") return;
    }
    set({ system: on });
    void syncPush(me, on);
  };

  const listen = (kind: ChimeKind, label: string) => (
    <button
      type="button"
      onClick={() => playChime(kind, true)}
      aria-label={label}
      title={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-chip hover:text-text"
    >
      <Play size={14} aria-hidden="true" />
    </button>
  );

  const systemHint =
    permission === "granted"
      ? tr("تظهر على شاشة جهازك مع اسم المرسل، والضغط عليها يفتح الصفحة.", "They show on your device's screen with the sender's name; a tap opens the page.")
      : permission === "denied"
        ? tr("حجبتها في هذا المتصفح. لإعادتها: اضغط القفل بجانب عنوان الموقع ← الإشعارات ← السماح، ثم أعد تحميل الصفحة.", "You blocked them in this browser. To allow them: press the lock next to the address → Notifications → Allow, then reload the page.")
        : permission === "unsupported"
          ? tr("هذا المتصفح لا يعرضها. على iPhone وiPad: ثبّت المنصة على الشاشة الرئيسية أولاً (iOS 16.4 فأحدث).", "This browser can't show them. On iPhone and iPad: add the platform to the home screen first (iOS 16.4 or later).")
          : tr("سيسألك المتصفح عن السماح بها عند تفعيلها.", "The browser asks you to allow them when you turn this on.");

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col overflow-hidden rounded-xl border border-line bg-card">
        <SwitchRow
          icon={<Bell size={16} />}
          title={tr("التنبيهات على هذا الجهاز", "Notifications on this device")}
          hint={prefs.on ? tr("صوت وإشعار عند وصول جديد.", "A sound and a notification when something new arrives.") : tr("متوقفة: يبقى كل شيء في الجرس، بلا صوت ولا إشعار.", "Off: everything stays in the bell, with no sound or notification.")}
          on={prefs.on}
          onChange={(on) => set({ on })}
        />
      </ul>
      <ul className={cn("flex flex-col overflow-hidden rounded-xl border border-line bg-card", !prefs.on && "pointer-events-none opacity-50")} aria-disabled={!prefs.on || undefined}>
        <SwitchRow
          icon={<BellRing size={16} />}
          title={tr("إشعارات النظام", "System notifications")}
          hint={<span className={cn(permission === "denied" && "text-danger")}>{systemHint}</span>}
          on={prefs.system && permission === "granted"}
          disabled={permission === "denied" || permission === "unsupported"}
          onChange={setSystem}
        />
        <SwitchRow
          icon={<MessageCircle size={16} />}
          title={tr("تنبيهات رسائل المحادثات", "Alerts for chat messages")}
          hint={tr("عند إيقافها تبقى الرسائل غير المقروءة في الجرس، بلا صوت ولا إشعار.", "When off, unread chats stay in the bell, with no sound or notification.")}
          on={prefs.chat}
          onChange={(on) => set({ chat: on })}
        />
        <SwitchRow icon={<Volume2 size={16} />} title={tr("الصوت", "Sound")} hint={tr("نغمة قصيرة عند وصول جديد.", "A short chime when something new arrives.")} on={prefs.sound} onChange={(on) => set({ sound: on })} />
        <SwitchRow
          sub
          title={tr("نغمة الرسائل", "Message chime")}
          hint={tr("خفيفة وقصيرة", "Soft and short")}
          on={prefs.chatSound}
          disabled={!prefs.sound}
          onChange={(on) => set({ chatSound: on })}
          extra={listen("chat", tr("استمع إلى نغمة الرسائل", "Play the message chime"))}
        />
        <SwitchRow
          sub
          title={tr("نغمة الإشعارات", "Notification chime")}
          hint={tr("نغمتان أوضح", "Two clearer notes")}
          on={prefs.notifSound}
          disabled={!prefs.sound}
          onChange={(on) => set({ notifSound: on })}
          extra={listen("notification", tr("استمع إلى نغمة الإشعارات", "Play the notification chime"))}
        />
      </ul>
      {pushAvailable() ? (
        <PushLine me={me} systemOn={prefs.system && permission === "granted"} />
      ) : (
        <p className="text-[13px] text-muted">
          {USE_MOCK
            ? tr("في هذه النسخة التجريبية لا يوجد خادم إشعارات: تصلك التنبيهات ما دامت المنصة مفتوحة، ولو في الخلفية.", "This demo has no push server: alerts reach you while the platform is open, even in the background.")
            : tr("تصلك التنبيهات ما دامت المنصة مفتوحة، ولو في الخلفية.", "Alerts reach you while the platform is open, even in the background.")}
        </p>
      )}
    </div>
  );
}

/**
 * Whether THIS device really gets notifications while the platform is closed: signed up with the server, or what
 * stopped it (the browser, the app, or the server with its code), with «حاول مرة أخرى». Only when the build has push.
 */
function PushLine({ me, systemOn }: { me: number; systemOn: boolean }) {
  const { tr } = useFmt();
  const push = usePushState();
  // Opening this page signs the device up if nothing did yet on this page load, so the line always has an answer.
  useEffect(() => {
    if (systemOn && push.step === "off") void syncPush(me, true);
  }, [systemOn, push.step, me]);

  let tone: "muted" | "good" | "bad" = "muted";
  let text: string;
  if (!systemOn || (push.step === "problem" && push.problem === "not-allowed")) {
    text = tr("شغّل «إشعارات النظام» أعلاه لتصلك الإشعارات حتى والمنصة مغلقة.", "Turn on “System notifications” above to get notifications even when the platform is closed.");
  } else if (push.step === "on") {
    tone = "good";
    text = tr("هذا الجهاز مسجَّل: تصله الإشعارات حتى والمنصة مغلقة.", "This device is signed up: notifications reach it even when the platform is closed.");
  } else if (push.step === "problem") {
    tone = "bad";
    const detail = push.detail ? ` (${push.detail})` : "";
    text =
      push.problem === "unsupported"
        ? tr("هذا المتصفح لا يستقبل الإشعارات والمنصة مغلقة. على iPhone وiPad: افتح المنصة من أيقونتها على الشاشة الرئيسية.", "This browser can't get notifications while the platform is closed. On iPhone and iPad: open the platform from its icon on the home screen.")
        : push.problem === "no-worker"
          ? tr("لم يكتمل تجهيز التطبيق على هذا الجهاز بعد. أعد تحميل الصفحة ثم حاول مرة أخرى.", "The app isn't fully set up on this device yet. Reload the page, then try again.")
          : push.problem === "refused"
            ? tr(`لم يعطِ المتصفح عنواناً للإشعارات${detail}.`, `The browser gave no address for notifications${detail}.`)
            : tr(`لم يقبل الخادم تسجيل هذا الجهاز${detail}. أرسل هذه الرسالة إلى مسؤول النظام.`, `The server didn't accept this device${detail}. Send this message to the system admin.`);
  } else {
    text = tr("يُسجَّل هذا الجهاز لتصله الإشعارات والمنصة مغلقة…", "Signing this device up for notifications while the platform is closed…");
  }

  const Icon = tone === "good" ? CircleCheck : tone === "bad" ? TriangleAlert : null;
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]",
        tone === "muted" ? "text-muted" : cn("rounded-xl px-3 py-2.5", tone === "good" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"),
      )}
    >
      <span className="flex min-w-0 flex-1 items-start gap-2">
        {Icon && <Icon size={16} aria-hidden="true" className="mt-px shrink-0" />}
        <span className="min-w-0 break-words">{text}</span>
      </span>
      {tone === "bad" && push.step === "problem" && push.problem !== "unsupported" && (
        <button
          type="button"
          onClick={() => void syncPush(me, true)}
          className="shrink-0 rounded-lg border border-current/30 px-2.5 py-1 text-[13px] font-medium transition-colors hover:bg-card"
        >
          {tr("حاول مرة أخرى", "Try again")}
        </button>
      )}
    </div>
  );
}
