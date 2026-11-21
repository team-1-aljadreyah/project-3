// The CEO's advanced settings. Pages call `advancedApi`; the .env switch decides if it is the real server or the demo
// backend (./mock.ts). Both follow `AdvancedApi`.
import { http, lazyApi } from "@/shared/api";
import type { AdvancedData, AdvancedRules, SaveHow, SettingsChange, SiteLive } from "./types";

export interface AdvancedApi {
  /** The rules in force, defaults merged in (the CEO). */
  get(): Promise<AdvancedData>;
  /**
   * Save. `rules` holds only what differs from the defaults (rules.ts changedRules): anything missing is its default.
   * `how` marks an import from a file or a reset in the history.
   */
  save(rules: Partial<AdvancedRules>, how?: SaveHow): Promise<AdvancedData>;
  /** Every save, newest first (the CEO). */
  history(): Promise<SettingsChange[]>;
  /** What the signed-in person must obey: features, the banner for their job, read-only mode (everyone signed in). */
  live(): Promise<SiteLive>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const advancedHttp: AdvancedApi = {
  get: () => data(http.get<AdvancedData>("/ceo/advanced")),
  save: (rules, how) => data(http.put<AdvancedData>("/ceo/advanced", { rules, how })),
  history: () => data(http.get<SettingsChange[]>("/ceo/advanced/history")),
  live: () => data(http.get<SiteLive>("/site/live")),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const advancedApi: AdvancedApi = process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.advancedMock)) : advancedHttp;
