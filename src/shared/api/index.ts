// The parts every feature's api.ts uses: the HTTP client, the error type, the demo switch helpers and the shared types.
export { http } from "./axios";
export { ApiError, NETWORK_ERROR, type ErrorCode } from "./errors";
export { lazyApi, resetDemoData } from "./demo";
export type * from "./types";
