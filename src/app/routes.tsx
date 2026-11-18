import { createBrowserRouter } from "react-router";
import { NotFoundPage } from "./not-found-page";
import { PageLoading } from "./page-loading";
import { RootLayout } from "./root-layout";
import { RouteError } from "./route-error";
import { SignedInLayout } from "./signed-in-layout";

// Every address of the site, and the page it shows. app/ only routes: the pages live in their features.
//
// `lazy` loads a feature's code only when one of its pages is opened, so the first page downloads less.
// Each feature is one download (its index.ts), shared by all its pages.
export const router = createBrowserRouter([
  {
    Component: RootLayout,
    ErrorBoundary: RouteError,
    // While the first page's code downloads (lazy, below), this shows instead. Without it the router warns.
    HydrateFallback: PageLoading,
    children: [
      { path: "/login", lazy: () => import("@/features/auth").then((m) => ({ Component: m.LoginPage })) },
      {
        // No path: it only wraps its children with the sign-in check and the top bar.
        Component: SignedInLayout,
        children: [
          { index: true, lazy: () => import("@/features/projects").then((m) => ({ Component: m.ProjectsPage })) },
          { path: "/projects/:id", lazy: () => import("@/features/tasks").then((m) => ({ Component: m.BoardPage })) },
          { path: "/projects/:id/files", lazy: () => import("@/features/attachments").then((m) => ({ Component: m.ProjectFilesPage })) },
          { path: "/projects/:id/settings", lazy: () => import("@/features/projects").then((m) => ({ Component: m.ProjectSettingsPage })) },
          { path: "/tasks/:id", lazy: () => import("@/features/tasks").then((m) => ({ Component: m.TaskPage })) },
          { path: "/my-tasks", lazy: () => import("@/features/tasks").then((m) => ({ Component: m.MyTasksPage })) },
          { path: "/announcements", lazy: () => import("@/features/announcements").then((m) => ({ Component: m.AnnouncementsPage })) },
          { path: "/announcements/:id", lazy: () => import("@/features/announcements").then((m) => ({ Component: m.AnnouncementPage })) },
          { path: "/bugs", lazy: () => import("@/features/bugs").then((m) => ({ Component: m.BugsPage })) },
          { path: "/bugs/:id", lazy: () => import("@/features/bugs").then((m) => ({ Component: m.BugPage })) },
          { path: "/notifications", lazy: () => import("@/features/notifications").then((m) => ({ Component: m.NotificationsPage })) },
        ],
      },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
