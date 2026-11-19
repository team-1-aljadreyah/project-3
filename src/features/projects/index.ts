// The projects feature's front door: other parts of the app import only from here.
export { projectsApi, type ProjectsApi } from "./api";
export { PROJECT_STATE } from "./project-state";
export { countTasks, groupByStatus, isDone, keysOfTone, lateDays, plannedRatio, type ProjectCounts } from "./counts";
export { canChangePm, canCreateProject, canManageProject } from "./rules";
export { canCloseSprint, currentSprint, isClosed, moveTargets, sprintNumbers, type SprintNumbers } from "./sprints";
export { ProjectSettingsPage } from "./pages/project-settings-page";
export { ProjectsPage } from "./pages/projects-page";
export { TemplatesPage } from "./pages/templates-page";
export type * from "./types";
