import Link from "next/link";
import { canManageProject, projectsApi } from "@/features/projects";
import { canTakePart } from "@/shared/lib/access";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { useRouteParam } from "@/shared/lib/route-param";
import { ErrorBox, LoadingBlock, Skeleton } from "@/shared/ui";
import { AttachmentsPanel } from "../components/attachments-panel";

/** A project's own files (the brief: "the files and attachments of the project"), for everyone in the project. */
export function ProjectFilesPage() {
  const id = Number(useRouteParam("projects"));
  const { tr, lang } = useFmt();
  const user = useUser();
  const load = useLoad(() => projectsApi.project(id), [id]);
  const project = load.data;
  const name = project ? (lang === "en" && project.name_en ? project.name_en : project.name) : "";
  usePageTitle(project ? tr(`ملفات ${name}`, `${name} files`) : undefined);

  if (load.state.status === "loading") {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Skeleton className="h-6 w-60" />
        <Skeleton className="h-40" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error" || !project) return <ErrorBox error={load.state.status === "error" ? load.state.error : null} onRetry={load.reload} />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
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
          <span>{tr("الملفات", "Files")}</span>
        </nav>
        <h1 className="text-2xl font-semibold">{tr("ملفات المشروع", "Project files")}</h1>
        <p className="text-sm text-muted">{tr("الملفات التي تخص المشروع كله. ملفات كل مهمة في صفحتها.", "Files for the whole project. Each task's files are on its page.")}</p>
      </div>
      <AttachmentsPanel owner={{ type: "project", id: project.id }} canAdd={canTakePart(user, project)} canManage={canManageProject(user, project)} />
    </div>
  );
}
