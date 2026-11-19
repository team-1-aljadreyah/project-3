import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { authApi } from "@/features/auth";
import { ApiError } from "@/shared/api";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Copy } from "lucide-react";
import { Button, ErrorBox, LoadingBlock, Skeleton } from "@/shared/ui";
import { projectsApi } from "../api";
import { DetailsTab } from "../components/settings/details-tab";
import { MembersTab } from "../components/settings/members-tab";
import { PhasesTab } from "../components/settings/phases-tab";
import { SaveTemplateDialog } from "../components/save-template-dialog";
import { ProjectHistory } from "../components/settings/project-history";
import { SprintsTab } from "../components/settings/sprints-tab";
import { StatusesTab } from "../components/settings/statuses-tab";
import { canManageProject, canUseTemplates } from "../rules";
import type { Project, ProjectEvent, Sprint } from "../types";

const TABS = [
  { key: "details", ar: "البيانات", en: "Details" },
  { key: "members", ar: "الأعضاء", en: "Members" },
  { key: "statuses", ar: "الحالات", en: "Statuses" },
  { key: "phases", ar: "المراحل", en: "Phases" },
  { key: "sprints", ar: "الدورات", en: "Sprints" },
  { key: "history", ar: "سجل المشروع", en: "History" },
] as const;
type Tab = (typeof TABS)[number]["key"];

interface Loaded {
  project: Project;
  people: User[];
  sprints: Sprint[];
  history: ProjectEvent[];
}

/** A project's setup: details, members, statuses, phases, sprints and its history. For its PM and the CEO. */
export function ProjectSettingsPage() {
  const id = Number(useParams().id);
  const load = useLoad<Loaded>(async () => {
    const [project, people, sprints, history] = await Promise.all([
      projectsApi.project(id),
      authApi.users(),
      projectsApi.sprints(id),
      projectsApi.history(id),
    ]);
    return { project, people, sprints, history };
  }, [id]);

  if (load.state.status === "loading") {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Skeleton className="h-6 w-60" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-96" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  return <Settings {...load.state.data} />;
}

function Settings({ project, people, sprints, history }: Loaded) {
  const { tr, lang } = useFmt();
  const user = useUser();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("details");
  const name = lang === "en" && project.name_en ? project.name_en : project.name;
  usePageTitle(tr(`إعدادات ${name}`, `${name} settings`));

  if (!canManageProject(user, project)) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <ErrorBox
          error={new ApiError(403, tr("إعدادات المشروع لمدير المشروع والمدير التنفيذي فقط.", "Project settings are for its project manager and the CEO."))}
          backHref={`/projects/${project.id}`}
        />
      </div>
    );
  }

  const peopleById = new Map(people.map((u) => [u.id, u]));
  // Each tab starts from the saved data again when that data changes (after a save here, or in another tab).
  const keyOf = (part: unknown) => JSON.stringify(part);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <nav aria-label={tr("مسار الصفحة", "Breadcrumb")} className="text-[13px] text-muted">
          <Link href="/" className="hover:text-text hover:underline">
            {tr("المشاريع", "Projects")}
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/projects/${project.id}`} className="hover:text-text hover:underline">
            {name}
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{tr("الإعدادات", "Settings")}</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{tr("إعدادات المشروع", "Project settings")}</h1>
          {canUseTemplates(user) && (
            <Button variant="secondary" pill onClick={() => setSaving(true)}>
              <Copy size={15} aria-hidden="true" />
              {tr("احفظ كقالب", "Save as template")}
            </Button>
          )}
        </div>
      </div>
      {saving && <SaveTemplateDialog project={project} open onClose={() => setSaving(false)} />}

      <div role="tablist" aria-label={tr("أقسام الإعدادات", "Settings sections")} className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-controls={`panel-${t.key}`}
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-3 text-sm whitespace-nowrap",
              tab === t.key ? "border-accent font-semibold text-text" : "border-transparent text-muted hover:text-text",
            )}
          >
            {tr(t.ar, t.en)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "details" && <DetailsTab key={keyOf(project)} project={project} user={user} people={people} />}
        {tab === "members" && <MembersTab key={keyOf(project.member_ids)} project={project} people={people} />}
        {tab === "statuses" && <StatusesTab key={keyOf(project.statuses)} project={project} />}
        {tab === "phases" && <PhasesTab key={keyOf(project.phases)} project={project} />}
        {tab === "sprints" && <SprintsTab project={project} sprints={sprints} />}
        {tab === "history" && <ProjectHistory events={history} people={peopleById} />}
      </div>
    </div>
  );
}
