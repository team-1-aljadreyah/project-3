import { useId, useState } from "react";
import { roleName } from "@/shared/lib/site";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { matches } from "@/shared/lib/utils";
import { Avatar, Input } from "@/shared/ui";

/**
 * Pick the people in a project: a search box and one checkbox per person (the whole row is the label, so a click
 * anywhere on it ticks the box). `locked` people are always in (the department manager) and can't be unticked.
 */
export function MemberPicker({
  people,
  value,
  onChange,
  locked = [],
  error,
}: {
  people: User[];
  value: number[];
  onChange: (ids: number[]) => void;
  locked?: number[];
  error?: string;
}) {
  const { tr, lang } = useFmt();
  const [q, setQ] = useState("");
  const searchId = useId();
  const nameOf = (u: User) => (lang === "en" && u.name_en ? u.name_en : u.name);
  // The system admin manages accounts, not project work (the brief), so they are not offered.
  const shown = people.filter((u) => u.active && u.role !== "admin" && matches(q, u.name, u.name_en, u.title));
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${searchId}-error` : undefined}>
      <legend className="mb-1.5 text-sm font-medium">
        {tr(`الأعضاء (${value.length})`, `Members (${value.length})`)}
      </legend>
      <label htmlFor={searchId} className="sr-only">
        {tr("ابحث عن موظف", "Search people")}
      </label>
      <Input id={searchId} type="search" placeholder={tr("ابحث بالاسم أو الوظيفة…", "Search by name or job…")} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="flex max-h-72 flex-col overflow-y-auto rounded-lg border border-line">
        {shown.map((u) => {
          const isLocked = locked.includes(u.id);
          const checked = isLocked || value.includes(u.id);
          return (
            <li key={u.id} className="border-b border-line last:border-b-0">
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-card-2 has-[:disabled]:cursor-default">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={checked} disabled={isLocked} onChange={() => toggle(u.id)} />
                <Avatar user={u} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{nameOf(u)}</span>
                  <span className="truncate text-xs text-muted">
                    {u.title} · {roleName(u, lang)}
                    {isLocked && ` · ${tr("مدير القسم", "Department manager")}`}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">{tr("لا توجد نتائج.", "No results.")}</li>}
      </ul>
      {error && (
        <p id={`${searchId}-error`} className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
