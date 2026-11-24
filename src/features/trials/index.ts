// The trial teams feature's front door (the monitoring officer's new teams under test): other parts of the app import
// only from here.
export { trialsApi, type TrialsApi } from "./api";
export { canUseTrials } from "./rules";
export { TrialsPage } from "./pages/trials-page";
export type * from "./types";
