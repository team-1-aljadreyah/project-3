# Templates for a new feature

The example feature is **announcements** (company-wide news with "who has seen it", from the brief). Replace the
names and fields with the new feature's. The patterns (the switch, the helpers, the four states) stay the same.

## Contents

1. `types.ts`
2. `api.ts`
3. `mock.ts`
4. Demo data (`src/mock/seed.ts`, `src/mock/db.ts`)
5. `pages/announcements-page.tsx`
6. `index.ts`
7. Route and menu
8. `tests/unit/announcements.test.ts`
9. `tests/e2e/announcements.spec.ts`

## 1. `src/features/announcements/types.ts`

```ts
// The data shapes of announcements, shared by the real API, the demo backend and the pages.
// Dates are ISO 8601.

export interface Announcement {
  id: number;
  title: string;
  body: string;
  author_id: number;
  created_at: string;
  /** Has the signed-in person seen it? (the server works it out per person) */
  seen: boolean;
}

export interface AnnouncementInput {
  title: string;
  body: string;
}
```

## 2. `src/features/announcements/api.ts`

```ts
// Announcements. Pages call `announcementsApi`; the .env switch decides if it is the real server
// (`announcementsHttp`) or the demo backend (./mock.ts). Both follow `AnnouncementsApi`.
import { http, lazyApi } from "@/shared/api";
import type { Announcement, AnnouncementInput } from "./types";

export interface AnnouncementsApi {
  announcements(): Promise<Announcement[]>;
  create(input: AnnouncementInput): Promise<Announcement>;
  markSeen(id: number): Promise<void>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const announcementsHttp: AnnouncementsApi = {
  announcements: () => data(http.get<Announcement[]>("/announcements")),
  create: (input) => data(http.post<Announcement>("/announcements", input)),
  markSeen: (id) => data(http.post<void>(`/announcements/${id}/seen`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const announcementsApi: AnnouncementsApi =
  import.meta.env.VITE_USE_MOCK === "true"
    ? lazyApi(() => import("./mock").then((m) => m.announcementsMock))
    : announcementsHttp;
```

## 3. `src/features/announcements/mock.ts`

```ts
// The demo backend for announcements, with the rules the real server must keep. Only the demo build loads it.
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, nowIso, wait } from "@/mock/helpers";
import type { AnnouncementsApi } from "./api";

const LIMITS = { title: 160, body: 5000 };

export const announcementsMock: AnnouncementsApi = {
  async announcements() {
    const user = currentUser();
    const db = getDb();
    return wait(
      db.announcements.map((a) => ({ ...a, seen: db.announcement_reads.some((r) => r.announcement_id === a.id && r.user_id === user.id) })),
    );
  },

  async create(input) {
    const user = currentUser();
    // The brief: the CEO and the admin post company-wide announcements.
    if (user.role !== "ceo" && user.role !== "admin") return fail(403, "FORBIDDEN", "لا يحق لك نشر الإعلانات.", "You can't post announcements.");
    const title = input.title.trim();
    if (!title) return invalid("title", "اكتب عنوان الإعلان.", "Enter the announcement's title.");
    if (title.length > LIMITS.title) return invalid("title", "العنوان أطول من المسموح.", "The title is too long.");
    const db = getDb();
    const a = { id: ++db.seq.announcement, title, body: input.body.trim(), author_id: user.id, created_at: nowIso() };
    db.announcements.push(a);
    commit();
    return wait({ ...a, seen: false });
  },

  async markSeen(id) {
    const user = currentUser();
    const db = getDb();
    if (!db.announcements.some((a) => a.id === id)) return fail(404, "NOT_FOUND", "لم يُعثر على الإعلان.", "Announcement not found.");
    if (!db.announcement_reads.some((r) => r.announcement_id === id && r.user_id === user.id)) {
      db.announcement_reads.push({ announcement_id: id, user_id: user.id, at: nowIso() });
      commit();
    }
    return wait(undefined);
  },
};
```

## 4. Demo data

In `src/mock/seed.ts`, add the lists to `MockDb` and return them from `seed()`:

```ts
import type { Announcement } from "@/features/announcements";

export interface MockDb {
  // …the lists that are already there…
  announcements: Omit<Announcement, "seen">[];
  announcement_reads: { announcement_id: number; user_id: number; at: string }[];
  seq: { task: number; comment: number; event: number; announcement: number };
}
```

Inside `seed()`, build the rows with its date helpers (`d(days)` gives a day, `at(days, hour)` a moment, both
counted from today), then add them and the counter to the object `seed()` returns:

```ts
  const announcements: MockDb["announcements"] = [
    { id: 1, title: "اجتماع عام يوم الخميس", body: "يبدأ الاجتماع في العاشرة صباحاً.", author_id: 1, created_at: at(1, 9) },
    { id: 2, title: "تحديث سياسة الإجازات", body: "", author_id: 8, created_at: at(4, 11) },
  ];
  const announcement_reads: MockDb["announcement_reads"] = [{ announcement_id: 2, user_id: 5, at: at(3, 10) }];

  return {
    users, projects, sprints, tasks, comments, events, announcements, announcement_reads,
    seq: { task: id, comment: commentId, event: eventId, announcement: announcements.length },
  };
```

Use invented names and text only. Then in `src/mock/db.ts` raise `DB_VERSION` by one, so every browser
replaces its old saved demo data with the new seed.

## 5. `src/features/announcements/pages/announcements-page.tsx`

```tsx
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useLoad } from "@/shared/lib/use-load";
import { Empty, ErrorBox, LoadingBlock, Skeleton } from "@/shared/ui";
import { announcementsApi } from "../api";

/** Company announcements, newest first, with what this person hasn't seen yet. */
export function AnnouncementsPage() {
  const { tr, ago } = useFmt();
  usePageTitle(tr("الإعلانات", "Announcements"));
  const load = useLoad(() => announcementsApi.announcements());

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-semibold">{tr("الإعلانات", "Announcements")}</h1>

      {load.state.status === "loading" && (
        <LoadingBlock className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </LoadingBlock>
      )}

      {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}

      {load.data &&
        (load.data.length === 0 ? (
          <Empty title={tr("لا توجد إعلانات بعد", "No announcements yet")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {load.data.map((a) => (
              <li key={a.id} className="rounded-xl border border-line bg-card p-4">
                <p className="font-semibold">{a.title}</p>
                <p className="mt-1 text-sm text-muted">{ago(a.created_at)}</p>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
```

## 6. `src/features/announcements/index.ts`

```ts
// The announcements feature's front door: other parts of the app import only from here.
export { announcementsApi, type AnnouncementsApi } from "./api";
export { AnnouncementsPage } from "./pages/announcements-page";
export type * from "./types";
```

## 7. Route and menu

`src/app/routes.tsx`, inside the `SignedInLayout` children:

```tsx
{ path: "/announcements", lazy: () => import("@/features/announcements").then((m) => ({ Component: m.AnnouncementsPage })) },
```

`src/shared/lib/access.ts`, in `NAV`: set `ready: true` on the `announcements` item (it is already in the menu,
greyed out). For a new item, add `{ key, ar, en, href, roles, ready: true }`.

## 8. `tests/unit/announcements.test.ts`

```ts
// The demo backend's rules for announcements: the same rules the real backend must keep.
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/errors";

// The demo backend reads the session from localStorage: a small in-memory one for Node.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { announcementsMock: api } = await import("@/features/announcements/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("posting announcements", () => {
  it("the CEO can post one", async () => {
    as(1);
    const a = await api.create({ title: "اجتماع عام يوم الخميس", body: "" });
    expect(a.title).toBe("اجتماع عام يوم الخميس");
  });

  it("an employee can't (403)", async () => {
    as(5);
    const e = await api.create({ title: "x", body: "" }).catch((err: ApiError) => err);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(403);
  });
});
```

## 9. `tests/e2e/announcements.spec.ts`

```ts
import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("announcements open from the menu and list the newest first", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الإعلانات" }).click();
  await expect(page).toHaveURL(/\/announcements$/);
  await expect(page.getByRole("heading", { level: 1, name: "الإعلانات" })).toBeVisible();
});
```

The demo accounts (one tap on the login page): مريم العبيدي (CEO), أحمد كريم (PM), هدى ناصر (M&E),
مصطفى جواد (team leader), سارة علي (employee), حسن رعد (admin).
