// What every feature's fake backend (features/*/mock.ts) needs: a short wait like a real network, errors shaped
// like the real server's, the signed-in person, and the project lookup that hides what someone may not see.
// Only the demo build loads these files.
import { ApiError, type ErrorCode } from "@/shared/api";
import type { User } from "@/shared/api/types";
import { currentLocale } from "@/shared/lib/boot";
import { canSeeProject } from "@/shared/lib/access";
import { getToken } from "@/shared/lib/session";
import { getDb } from "./db";

/** A short wait, so loading states show in the demo like on a real network. */
export const wait = <T>(value: T, ms = 150) => new Promise<T>((r) => setTimeout(() => r(structuredClone(value)), ms));

export const msg = (ar: string, en: string) => (currentLocale() === "ar" ? ar : en);

export const fail = (status: number, code: ErrorCode, ar: string, en: string, errors?: Record<string, string>): never => {
  throw new ApiError(status, msg(ar, en), errors, code);
};

/** A form error: 422 with the message under the field. */
export const invalid = (field: string, ar: string, en: string): never => fail(422, "VALIDATION", ar, en, { [field]: msg(ar, en) });

export const nowIso = () => new Date().toISOString();

export function currentUser(): User {
  const token = getToken();
  const id = token?.startsWith("demo-") ? Number(token.slice(5)) : NaN;
  const user = getDb().users.find((u) => u.id === id && u.active);
  if (!user) return fail(401, "UNAUTHENTICATED", "انتهت الجلسة، سجّل الدخول من جديد.", "Your session ended. Please sign in again.");
  return user;
}

export function projectFor(user: User, id: number) {
  const project = getDb().projects.find((p) => p.id === id);
  // Not found and not allowed answer the same, so nobody learns which projects exist.
  if (!project || !canSeeProject(user, project)) return fail(404, "NOT_FOUND", "لم يُعثر على المشروع.", "Project not found.");
  return project;
}
