// History, file and defaults: every save from → to, the settings as a file (download, import with a check and a
// confirmation listing what changes), and everything back to the defaults (confirmation).
import { Download, FileUp, History, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { useLoad } from "@/shared/lib/use-load";
import { Button, Dialog, Empty, ErrorBox, errorText, LoadingBlock, Pill, Skeleton, useToast } from "@/shared/ui";
import { adminApi } from "@/features/admin";
import { advancedApi } from "../api";
import { changedRules, checkRules, DEFAULT_RULES, diffRules, rulesOf } from "../rules";
import type { AdvancedRules, SaveHow, SettingsChange, SettingsFile } from "../types";
import { keyName, showValue } from "../words";
import { Part } from "./controls";

/** One save: who, when, how, and each change from → to. */
function ChangeLines({ changes }: { changes: SettingsChange["changes"] }) {
  const { tr } = useFmt();
  return (
    <ul className="mt-2 flex flex-col gap-1 text-[13px]">
      {changes.map((ch) => (
        <li key={ch.key} className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-semibold">{keyName(ch.key, tr)}:</span>
          <span className="text-muted line-through decoration-1">{showValue(ch.key, ch.from, tr)}</span>
          <span aria-hidden="true" className="text-faint">
            {tr("←", "→")}
          </span>
          <span className="sr-only">{tr("إلى", "to")}</span>
          <span className="font-medium">{showValue(ch.key, ch.to, tr)}</span>
        </li>
      ))}
    </ul>
  );
}

export function HistoryPart({ saved, dirty }: { saved: AdvancedRules; dirty: boolean }) {
  const { tr, lang, dateTime, ago } = useFmt();
  const toast = useToast();
  const h = useLoad(() => advancedApi.history());
  const users = useLoad(() => adminApi.users());
  const file = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<{ name: string; rules: AdvancedRules } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);

  function download() {
    const body: SettingsFile = { kind: "p3-advanced-settings", version: 1, exported_at: new Date().toISOString(), rules: changedRules(saved) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `advanced-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function pick(f: File) {
    try {
      const j = JSON.parse(await f.text()) as Partial<SettingsFile>;
      if (j?.kind !== "p3-advanced-settings" || !j.rules || typeof j.rules !== "object") throw new Error("kind");
      const rules = rulesOf(j.rules);
      const bad = Object.keys(checkRules(rules));
      if (bad.length) {
        toast(tr(`في الملف قيم غير صحيحة: ${bad.map((k) => keyName(k, tr)).join("، ")}`, `The file has wrong values: ${bad.map((k) => keyName(k, tr)).join(", ")}`), "danger");
        return;
      }
      setIncoming({ name: f.name, rules });
    } catch {
      toast(tr("هذا ليس ملف إعدادات متقدمة لهذه المنصة.", "This isn't an advanced settings file of this platform."), "danger");
    } finally {
      if (file.current) file.current.value = "";
    }
  }

  async function apply(rules: Partial<AdvancedRules>, how: SaveHow, ok: string) {
    setBusy(true);
    try {
      await advancedApi.save(rules, how);
      toast(ok);
      setIncoming(null);
      setResetting(false);
    } catch (e) {
      toast(errorText(e, tr), "danger");
    } finally {
      setBusy(false);
    }
  }

  const incomingChanges = incoming ? diffRules(saved, incoming.rules) : [];
  const resetChanges = diffRules(saved, DEFAULT_RULES);
  // Accounts whose custom role would go (a reset drops every role; an import drops the ones not in the file):
  // they keep their base job.
  const losing = (keep: { key: string }[]) => (users.data ?? []).filter((u) => u.active && u.custom_role && !keep.some((r) => r.key === u.custom_role));
  const roleWarning = (n: number) =>
    n > 0 ? (
      <p role="alert" className="rounded-lg bg-(--st-review) px-3 py-2 text-[13px] text-(--st-review-ink)">
        {tr(`تنبيه: ${n} من الحسابات لها أدوار ستُحذف، فتعود إلى وظيفتها الأساسية.`, `Heads-up: ${n} accounts have roles that will go; they go back to their base job.`)}
      </p>
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      <Part title={tr("الملف والافتراضي", "File and defaults")} sub={tr("انسخ كل الإعدادات إلى ملف، أو أرجعها من ملف، أو أعدها كما كانت أول مرة", "Copy every setting to a file, bring them back from one, or return them to how they first were")}>
        <div className="flex flex-wrap gap-2 px-5 py-4">
          <Button variant="secondary" onClick={download}>
            <Download size={16} aria-hidden="true" />
            {tr("تنزيل ملف الإعدادات", "Download the settings file")}
          </Button>
          <Button variant="secondary" onClick={() => file.current?.click()}>
            <FileUp size={16} aria-hidden="true" />
            {tr("استيراد من ملف", "Import from a file")}
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            aria-label={tr("ملف الإعدادات", "The settings file")}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
          />
          <Button variant="secondary" onClick={() => setResetting(true)} disabled={!resetChanges.length} className="border-danger/30 bg-danger-soft text-danger hover:bg-danger-soft/70">
            <RotateCcw size={16} aria-hidden="true" />
            {tr("إرجاع الكل إلى الافتراضي", "All back to default")}
          </Button>
        </div>
        {dirty && <p className="border-t border-line px-5 py-3 text-xs text-muted">{tr("لديك تغييرات غير محفوظة: الملف يُنزَّل بالإعدادات المحفوظة.", "You have unsaved changes: the file holds the saved settings.")}</p>}
      </Part>

      <Part title={tr("سجل تغييرات الإعدادات", "Settings history")} sub={tr("من غيّر ماذا ومتى، الأحدث أولاً", "Who changed what and when, newest first")} icon={<History size={17} aria-hidden="true" className="text-accent" />}>
        {h.state.status === "loading" ? (
          <LoadingBlock className="flex flex-col gap-3 p-5">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </LoadingBlock>
        ) : h.state.status === "error" ? (
          <div className="p-5">
            <ErrorBox error={h.state.error} onRetry={h.reload} />
          </div>
        ) : !h.state.data.length ? (
          <div className="p-5">
            <Empty title={tr("لم تتغير الإعدادات بعد", "No changes yet")} body={tr("كل حفظ يُسجَّل هنا: من، ومتى، وما تغيّر.", "Every save is written here: who, when and what changed.")} />
          </div>
        ) : (
          <ol aria-label={tr("سجل التغييرات", "Change history")} className="divide-y divide-line">
            {h.state.data.map((x) => (
              <li key={x.id} className="px-5 py-4">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <b className="font-semibold">{lang === "en" && x.by.name_en ? x.by.name_en : x.by.name}</b>
                  <time dateTime={x.at} title={dateTime(x.at)} className="text-xs text-muted">
                    {dateTime(x.at)} · {ago(x.at)}
                  </time>
                  {x.how === "import" && <Pill tone="testing">{tr("من ملف", "From a file")}</Pill>}
                  {x.how === "reset" && <Pill tone="review">{tr("إرجاع الافتراضي", "Back to default")}</Pill>}
                  <span className="text-xs text-faint">{tr(`التغييرات: ${x.changes.length}`, `${x.changes.length} changes`)}</span>
                </p>
                <ChangeLines changes={x.changes} />
              </li>
            ))}
          </ol>
        )}
      </Part>

      <Dialog
        open={!!incoming}
        onClose={() => setIncoming(null)}
        title={tr("استيراد الإعدادات", "Import the settings")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIncoming(null)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button disabled={busy || !incomingChanges.length} onClick={() => incoming && apply(changedRules(incoming.rules), "import", tr("استُوردت الإعدادات، وتسري على الجميع الآن.", "Settings imported. They apply to everyone now."))}>
              {tr("استيراد", "Import")}
            </Button>
          </>
        }
      >
        {incoming && (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              {incomingChanges.length
                ? tr(`الملف «${incoming.name}» يغيّر إعدادات عددها ${incomingChanges.length}. يحلّ محل الإعدادات الحالية كلها، ويُكتب في السجل:`, `"${incoming.name}" changes ${incomingChanges.length} settings. It replaces all the current settings, and goes in the history:`)
                : tr(`الملف «${incoming.name}» مطابق للإعدادات الحالية، فلا شيء يتغير.`, `"${incoming.name}" matches the current settings: nothing changes.`)}
            </p>
            {roleWarning(losing(incoming.rules.roles).length)}
            {incomingChanges.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-line bg-card-2 px-4 py-2">
                <ChangeLines changes={incomingChanges} />
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={resetting}
        onClose={() => setResetting(false)}
        title={tr("إرجاع الإعدادات إلى الافتراضي", "Settings back to default")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetting(false)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button disabled={busy} onClick={() => apply({}, "reset", tr("عادت الإعدادات كما كانت أول مرة.", "The settings are back to default."))} className="bg-danger text-card hover:bg-danger/90">
              {tr("إرجاع الكل", "Reset all")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>
            {tr(
              `تعود الإعدادات المعدَّلة (${resetChanges.length}) كما كانت أول مرة، ومعها أرقام الدخول في إدارة النظام، ويختفي الإعلان ويتوقف وضع القراءة فقط. نزّل ملف الإعدادات أولاً إن أردت الرجوع إليها.`,
              `${resetChanges.length} settings return to how they first were, with the sign-in numbers of the administration; the banner goes and read-only mode stops. Download the settings file first to keep them.`,
            )}
          </p>
          {roleWarning(losing([]).length)}
          <div className="max-h-56 overflow-y-auto rounded-xl border border-line bg-card-2 px-4 py-2">
            <ChangeLines changes={resetChanges} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
