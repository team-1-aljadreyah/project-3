// The dashboard and the reports. Pages call `reportsApi`; the .env switch decides if it is the real server or the
// demo backend (./mock.ts). Both follow `ReportsApi`.
import { http, lazyApi } from "@/shared/api";
import type { Overview } from "./types";

export interface ReportsApi {
  /** Every number of the dashboard and the reports, over the projects this person may see. */
  overview(): Promise<Overview>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const reportsHttp: ReportsApi = {
  overview: () => data(http.get<Overview>("/reports/overview")),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const reportsApi: ReportsApi =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.reportsMock)) : reportsHttp;
