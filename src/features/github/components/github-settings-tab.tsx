import { Plus, X } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { useLoad } from "@/shared/lib/use-load";
import { Button, ErrorBox, IconButton, Input, Skeleton, errorText, useToast } from "@/shared/ui";
import { githubApi } from "../api";
import { GITHUB_LIMITS, isRepoName } from "../rules";
import type { GithubSettings } from "../types";

/**
 * A project's GitHub setting (the brief: turned on per project): on or off, and its repositories. The real connection
 * (the company's GitHub App) is made on the server by DevOps; nobody types a GitHub key here.
 */
export function GithubSettingsTab({ projectId, canEdit }: { projectId: number; canEdit: boolean }) {
  const { tr } = useFmt();
  const load = useLoad(() => githubApi.settings(projectId), [projectId]);
  if (load.state.status === "loading") return <Skeleton className="h-48" />;
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  return <Editor key={JSON.stringify(load.state.data)} saved={load.state.data} canEdit={canEdit} onSaved={load.reload} tr={tr} />;
}

function Editor({ saved, canEdit, onSaved, tr }: { saved: GithubSettings; canEdit: boolean; onSaved: () => void; tr: (ar: string, en: string) => string }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(saved.enabled);
  const [repos, setRepos] = useState(saved.repos);
  const [next, setNext] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const add = () => {
    const r = next.trim();
    if (!isRepoName(r)) return setError(tr("اكتب المستودع هكذا: المالك/الاسم (مثل aljadreyah/booking-web).", "Write the repository as owner/name (like aljadreyah/booking-web)."));
    if (repos.length >= GITHUB_LIMITS.repos) return setError(tr(`${GITHUB_LIMITS.repos} مستودعات على الأكثر.`, `At most ${GITHUB_LIMITS.repos} repositories.`));
    setError(undefined);
    setRepos((l) => (l.includes(r) ? l : [...l, r]));
    setNext("");
  };
  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await githubApi.saveSettings(saved.project_id, { enabled, repos });
      toast(tr("حُفظ إعداد GitHub.", "GitHub setting saved."));
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError && e.errors ? Object.values(e.errors)[0] : errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex items-start gap-3 rounded-xl border border-line bg-card p-4">
        <input id="gh-enabled" type="checkbox" checked={enabled} disabled={!canEdit} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span className="flex flex-col gap-1">
          <label htmlFor="gh-enabled" className="text-sm font-bold">
            {tr("اربط هذا المشروع بـ GitHub", "Link this project to GitHub")}
          </label>
          <span className="text-sm text-muted">
            {tr(
              "تظهر طلبات السحب والإيداعات التي تذكر رمز المهمة (مثل TSK-104) أو الخطأ (BUG-3) في صفحتها. للعرض فقط: لا تتغير حالة أي مهمة تلقائياً.",
              "Pull requests and commits that mention a task's code (like TSK-104) or a bug's (BUG-3) show on its page. Showing only: no task changes status by itself.",
            )}
          </span>
        </span>
      </div>

      <section aria-labelledby="repos-title" className="flex flex-col gap-2">
        <h3 id="repos-title" className="text-sm font-semibold">
          {tr("المستودعات", "Repositories")}
        </h3>
        {repos.length === 0 && <p className="text-sm text-faint">{tr("لا مستودعات بعد.", "No repositories yet.")}</p>}
        <ul className="flex flex-col gap-1.5">
          {repos.map((r) => (
            <li key={r} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm">
              <span dir="ltr">{r}</span>
              {canEdit && (
                <IconButton label={tr(`أزل ${r}`, `Remove ${r}`)} onClick={() => setRepos((l) => l.filter((x) => x !== r))} className="bg-transparent">
                  <X size={14} aria-hidden="true" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <div className="flex gap-2">
            <Input
              dir="ltr"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="owner/name"
              aria-label={tr("مستودع جديد (المالك/الاسم)", "New repository (owner/name)")}
              className="h-10"
            />
            <Button variant="secondary" onClick={add}>
              <Plus size={15} aria-hidden="true" />
              {tr("أضف", "Add")}
            </Button>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {canEdit && (
        <Button onClick={save} disabled={busy} className="self-start">
          {tr("احفظ إعداد GitHub", "Save GitHub setting")}
        </Button>
      )}
      <p className="text-xs text-faint">
        {tr("الاتصال الفعلي بحساب الشركة في GitHub يُضبط على الخادم (تطبيق GitHub). لا يُكتب أي مفتاح سري هنا.", "The real connection to the company's GitHub is set up on the server (a GitHub App). No secret key is typed here.")}
      </p>
    </div>
  );
}
