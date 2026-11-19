// Signing in, the signed-in person, and the list of people. Pages call `authApi`; the .env switch decides if it is
// the real server (`authHttp`) or the demo backend (./mock.ts). Both follow `AuthApi`, so switching changes no page.
import { http, lazyApi } from "@/shared/api";
import type { Session, User } from "@/shared/api/types";

export interface AuthApi {
  login(identifier: string, password: string): Promise<Session>;
  me(): Promise<User>;
  users(): Promise<User[]>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const authHttp: AuthApi = {
  login: (identifier, password) => data(http.post<Session>("/auth/login", { identifier, password })),
  me: () => data(http.get<User>("/me")),
  users: () => data(http.get<User[]>("/users")),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const authApi: AuthApi =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.authMock)) : authHttp;
