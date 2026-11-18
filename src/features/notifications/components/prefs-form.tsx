import { Lock } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/shared/api";
import { NOTIFICATION_KINDS, REQUIRED_NOTIFICATIONS } from "@/shared/api/notification-kinds";
import { useFmt } from "@/shared/lib/i18n";
import { Button, errorText, useToast } from "@/shared/ui";
import { notificationsApi } from "../api";
import type { NotificationPrefs } from "../types";
import { KIND_WORDS } from "../words";

/**
 * Which notifications this person wants. The required ones are shown ticked and locked (the brief: preferences are
 * for the notifications that aren't required). The whole row is the checkbox's label (click anywhere).
 */
export function PrefsForm({ saved }: { saved: NotificationPrefs }) {
  const { tr, lang } = useFmt();
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const on = (kind: (typeof NOTIFICATION_KINDS)[number]) => REQUIRED_NOTIFICATIONS.has(kind) || prefs[kind] !== false;

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await notificationsApi.savePrefs(prefs);
      toast(tr("حُفظت التفضيلات.", "Preferences saved."));
    } catch (e) {
      setError(e instanceof ApiError && e.errors?.prefs ? e.errors.prefs : errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col overflow-hidden rounded-xl border border-line bg-card">
        {NOTIFICATION_KINDS.map((kind) => {
          const required = REQUIRED_NOTIFICATIONS.has(kind);
          const w = KIND_WORDS[kind];
          return (
            <li key={kind} className="border-b border-line last:border-b-0">
              <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-card-2 has-[:disabled]:cursor-default">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                  checked={on(kind)}
                  disabled={required}
                  onChange={(e) => setPrefs((p) => ({ ...p, [kind]: e.target.checked }))}
                />
                <span className="flex flex-1 flex-col gap-0.5 text-sm font-medium">
                  {lang === "en" ? w.en : w.ar}
                  <span className="text-[13px] font-normal text-muted">{lang === "en" ? w.hint_en : w.hint_ar}</span>
                </span>
                {required && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Lock size={12} aria-hidden="true" />
                    {tr("إلزامي", "Required")}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <Button onClick={save} disabled={busy}>
          {busy ? tr("جارٍ الحفظ…", "Saving…") : tr("احفظ التفضيلات", "Save preferences")}
        </Button>
      </div>
    </div>
  );
}
