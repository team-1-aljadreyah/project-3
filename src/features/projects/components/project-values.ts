import type { Priority } from "@/shared/api/types";
import type { Project, ProjectState } from "../types";

/** What the project form holds while someone types (everything as text, like the inputs). */
export interface ProjectValues {
  name: string;
  name_en: string;
  description: string;
  pm_id: string;
  start: string;
  end: string;
  priority: Priority;
  uses_sprints: boolean;
  state: ProjectState;
}

export const valuesOf = (p?: Project, pmId?: number): ProjectValues => ({
  name: p?.name ?? "",
  name_en: p?.name_en ?? "",
  description: p?.description ?? "",
  pm_id: String(p?.pm_id ?? pmId ?? ""),
  start: p?.start ?? "",
  end: p?.end ?? "",
  priority: p?.priority ?? "medium",
  uses_sprints: p?.uses_sprints ?? false,
  state: p?.state ?? "planned",
});
