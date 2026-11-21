import { Copy, Plus } from "lucide-react";
import { useState } from "react";
import { authApi } from "@/features/auth";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useMay } from "@/shared/lib/site";
import { useLoad } from "@/shared/lib/use-load";
import { Button, ButtonLink, Empty, ErrorBox, LoadingBlock, Skeleton } from "@/shared/ui";
import { projectsApi } from "../api";
import { NewProjectDialog } from "../components/new-project-dialog";
import { ProjectCard } from "../components/project-card";
import { canCreateProject } from "../rules";

/** The projects this person may see (the server decides which), as cards. */
export function ProjectsPage() {
  const { tr } = useFmt();
  usePageTitle(tr("المشاريع", "Projects"));
  const user = useUser();
  // A custom role (advanced settings) may have "create a project" switched off.
  const may = useMay();
  const projects = useLoad(() => Promise.all([projectsApi.projects(), authApi.users()]));
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tr("المشاريع", "Projects")}</h1>
          {projects.data && (
            <p className="text-sm text-muted">{tr(`عدد المشاريع: ${projects.data[0].length}`, `Projects: ${projects.data[0].length}`)}</p>
          )}
        </div>
        {canCreateProject(user) && may(user, "create_project") && projects.data && (
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/templates" variant="secondary" pill>
              <Copy size={15} aria-hidden="true" />
              {tr("القوالب", "Templates")}
            </ButtonLink>
            <Button pill onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" />
              {tr("مشروع جديد", "New project")}
            </Button>
          </div>
        )}
      </div>

      {projects.state.status === "loading" && (
        <LoadingBlock className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-60 rounded-xl" />
          ))}
        </LoadingBlock>
      )}

      {projects.state.status === "error" && <ErrorBox error={projects.state.error} onRetry={projects.reload} />}

      {projects.data &&
        (projects.data[0].length === 0 ? (
          <Empty
            title={tr("لا توجد مشاريع بعد", "No projects yet")}
            body={tr("حين يضيفك مدير مشروع إلى مشروع، يظهر هنا.", "When a project manager adds you to a project, it shows here.")}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.data[0].map((p) => (
              <li key={p.id} className="flex">
                <ProjectCard project={p} pm={projects.data?.[1].find((u) => u.id === p.pm_id)} />
              </li>
            ))}
          </ul>
        ))}
      {projects.data && <NewProjectDialog open={creating} onClose={() => setCreating(false)} user={user} people={projects.data[1]} />}
    </div>
  );
}
