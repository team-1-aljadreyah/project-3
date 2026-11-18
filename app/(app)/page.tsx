"use client";

import { ProjectCard } from "@/components/projects/project-card";
import { Empty, ErrorBox, LoadingBlock, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { useFmt } from "@/lib/i18n";
import { useLoad } from "@/lib/use-load";

/** The projects this person may see (the server decides which), as cards. */
export default function ProjectsPage() {
  const { tr } = useFmt();
  const projects = useLoad(() => Promise.all([api.projects(), api.users()]));

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{tr("المشاريع", "Projects")}</h1>
        {projects.data && (
          <p className="text-sm text-muted">{tr(`عدد المشاريع: ${projects.data[0].length}`, `Projects: ${projects.data[0].length}`)}</p>
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
    </div>
  );
}
