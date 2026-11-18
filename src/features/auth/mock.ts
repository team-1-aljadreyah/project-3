// The demo backend for signing in and people. Only the demo build loads it (see ./api.ts).
import { getDb } from "@/mock/db";
import { currentUser, fail, wait } from "@/mock/helpers";
import { DEMO_PASSWORD } from "@/mock/seed";
import type { AuthApi } from "./api";

export const authMock: AuthApi = {
  async login(identifier, password) {
    const id = identifier.trim().toLowerCase();
    const user = getDb().users.find((u) => u.email === id || u.phone === id);
    if (!user || password !== DEMO_PASSWORD) return fail(422, "VALIDATION", "البريد أو كلمة المرور غير صحيحة.", "Wrong email or password.");
    if (!user.active) return fail(403, "FORBIDDEN", "تم إيقاف هذا الحساب.", "This account is stopped.");
    return wait({ token: `demo-${user.id}`, user });
  },

  async me() {
    return wait(currentUser());
  },

  async users() {
    currentUser();
    return wait(getDb().users);
  },
};
