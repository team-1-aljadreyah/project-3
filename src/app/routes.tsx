import { createBrowserRouter } from "react-router";
import { NotFoundPage } from "./not-found-page";
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
    children: [
      { path: "/login", lazy: () => import("@/features/auth").then((m) => ({ Component: m.LoginPage })) },
      {
        // No path: it only wraps its children with the sign-in check and the top bar.
        Component: SignedInLayout,
        children: [
          { index: true, lazy: () => import("@/features/projects").then((m) => ({ Component: m.ProjectsPage })) },
          { path: "/projects/:id", lazy: () => import("@/features/tasks").then((m) => ({ Component: m.BoardPage })) },
          { path: "/tasks/:id", lazy: () => import("@/features/tasks").then((m) => ({ Component: m.TaskPage })) },
        ],
      },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
