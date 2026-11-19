// The reports feature's front door (the dashboard and the reports): other parts of the app import only from here.
export { reportsApi, type ReportsApi } from "./api";
export { DashboardPage } from "./pages/dashboard-page";
export { ReportsPage } from "./pages/reports-page";
export type * from "./types";
