import { Copy, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { authApi } from "@/features/auth";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { Button, Dialog, Empty, ErrorBox, IconButton, LoadingBlock, Pill, Skeleton } from "@/shared/ui";
import { projectsApi } from "../api";
import { useSave } from "../hooks/use-save";
import { canRemoveTemplate, canUseTemplates } from "../rules";
import type { ProjectTemplate } from "../types";

/**
 * The project templates (the brief: templates for recurring projects). A template is made from a project's settings
 * ("Save as template") and used in "New project". Here they are listed, and removed by who made them or the CEO.
 */
export function TemplatesPage() {
  const { tr, lang, day, num } = useFmt();
  usePageTitle(tr("قوالب المشاريع", "Project templates"));
  const user = useUser();
  const allowed = canUseTemplates(user);
  const load = useLoad(() => (allowed ? Promise.all([projectsApi.templates(), authApi.users()]) : Promise.resolve(null)), [allowed]);
  const [removing, setRemoving] = useState<ProjectTemplate | null>(null);
  const remover = useSave();

  if (!allowed) {
    return <Empty title={tr("القوالب لمن ينشئ المشاريع", "Templates are for the people who create projects")} body={tr("المدير التنفيذي ومديرو الأقسام.", "The CEO and the department managers.")} />;
  }

  const people = new Map((load.data?.[1] ?? []).map((u) => [u.id, u]));
  const nameOf = (id: number) => {
    const u = people.get(id);
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-";
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <nav aria-label={tr("مسار الصفحة", "Breadcrumb")} className="text-[13px] text-muted">
          <Link href="/" className="hover:text-text hover:underline">
            {tr("المشاريع", "Projects")}
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{tr("القوالب", "Templates")}</span>
        </nav>
        <h1 className="text-2xl font-semibold">{tr("قوالب المشاريع", "Project templates")}</h1>
        <p className="text-sm text-muted">
          {tr("يُنشأ القالب من إعدادات أي مشروع («احفظ كقالب»)، ويُستعمل عند إنشاء مشروع جديد.", 'A template is made in any project\'s settings ("Save as template") and used when creating a new project.')}
        </p>
      </div>

      {load.state.status === "loading" && (
        <LoadingBlock className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </LoadingBlock>
      )}
      {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}
      {load.data && load.data[0].length === 0 && <Empty title={tr("لا توجد قوالب بعد", "No templates yet")} body={tr("افتح إعدادات مشروع واحفظه كقالب.", "Open a project's settings and save it as a template.")} />}
      {load.data && load.data[0].length > 0 && (
        <ul className="flex flex-col gap-3">
          {load.data[0].map((x) => (
            <li key={x.id} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 dir="auto" className="flex items-center gap-2 font-semibold">
                    <Copy size={15} aria-hidden="true" className="shrink-0 text-muted" />
                    {x.name}
                  </h2>
                  {x.description && (
                    <p dir="auto" className="text-sm text-muted">
                      {x.description}
                    </p>
                  )}
                </div>
                {canRemoveTemplate(user, x) && (
                  <IconButton label={tr(`احذف القالب ${x.name}`, `Remove the template ${x.name}`)} onClick={() => setRemoving(x)} className="bg-transparent text-muted hover:text-danger">
                    <Trash2 size={16} aria-hidden="true" />
                  </IconButton>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Pill tone="new">{tr(`${num(x.statuses.length)} حالات`, `${x.statuses.length} statuses`)}</Pill>
                <Pill tone="new">{tr(`${num(x.phases.length)} مراحل`, `${x.phases.length} phases`)}</Pill>
                <Pill tone="new">{tr(`${num(x.tasks.length)} مهام`, `${x.tasks.length} tasks`)}</Pill>
                {x.uses_sprints && <Pill tone="progress">{tr("يعمل بالدورات", "Uses sprints")}</Pill>}
              </div>
              <p className="text-xs text-faint">
                {tr(`أنشأه ${nameOf(x.created_by)} في ${day(x.created_at)}`, `Made by ${nameOf(x.created_by)} on ${day(x.created_at)}`)}
                {x.from_project && <span dir="auto">{tr(` · من «${x.from_project}»`, ` · from "${x.from_project}"`)}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={tr("حذف القالب", "Remove the template")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button
              className="bg-danger hover:bg-danger"
              disabled={remover.busy}
              onClick={async () => {
                if (!removing) return;
                if (await remover.save(() => projectsApi.deleteTemplate(removing.id), tr("حُذف القالب.", "Template removed."))) setRemoving(null);
              }}
            >
              {tr("احذف", "Remove")}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {tr(`يُحذف «${removing?.name}». المشاريع التي أُنشئت منه لا تتغير.`, `"${removing?.name}" will be removed. Projects made from it don't change.`)}
        </p>
      </Dialog>
    </div>
  );
}
