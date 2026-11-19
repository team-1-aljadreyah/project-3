// The performance feature's front door: other parts of the app import only from here.
export { performanceApi, type PerformanceApi } from "./api";
export { CriteriaPage } from "./pages/criteria-page";
export { PerformancePage } from "./pages/performance-page";
export { PersonPage } from "./pages/person-page";
export type * from "./types";
