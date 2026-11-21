import { useId, useState } from "react";
import type { User } from "@/shared/api/types";
import { ROLES } from "@/shared/lib/access";
import { useFmt } from "@/shared/lib/i18n";
import { matches } from "@/shared/lib/utils";
import { Avatar } from "./avatar";
import { Input } from "./field";

/**
 * Pick several people: a search box and one checkbox per person. The whole row is the label, so a click anywhere on it
 * ticks the box. `people` is already the list that may be picked (the page leaves out who can't). `legend` names the
 * list (it gets the number picked); by default "Members".
 */
export function PeoplePicker({
  people,
  value,
  onChange,
  error,
  legend,
}: {
  people: User[];
  value: number[];
  onChange: (ids: number[]) => void;
  error?: string;
  legend?: { ar: string; en: string };
}) {
  const { tr, lang, num } = useFmt();
  const [q, setQ] = useState("");
  const searchId = useId();
  const nameOf = (u: User) => (lang === "en" && u.name_en ? u.name_en : u.name);
  const shown = people.filter((u) => matches(q, u.name, u.name_en, u.email, u.title));
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${searchId}-error` : undefined}>
      <legend className="mb-1.5 text-sm font-medium">{tr(`${legend?.ar ?? "الأعضاء"} (اخترت ${num(value.length)})`, `${legend?.en ?? "Members"} (${num(value.length)} picked)`)}</legend>
      <label htmlFor={searchId} className="sr-only">
        {tr("ابحث عن زميل", "Search for a colleague")}
      </label>
      <Input id={searchId} type="search" placeholder={tr("ابحث بالاسم أو الوظيفة", "Search by name or job")} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="flex max-h-64 flex-col overflow-y-auto rounded-lg border border-line">
        {shown.map((u) => (
          <li key={u.id} className="border-b border-line last:border-b-0">
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-card-2">
              <input type="checkbox" className="size-4 shrink-0 accent-[var(--accent)]" checked={value.includes(u.id)} onChange={() => toggle(u.id)} />
              <Avatar user={u} size="sm" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{nameOf(u)}</span>
                <span className="truncate text-xs text-muted">
                  {u.title} · {tr(ROLES[u.role].ar, ROLES[u.role].en)}
                </span>
              </span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">{tr("لا أحد بهذا الاسم.", "Nobody by that name.")}</li>}
      </ul>
      {error && (
        <p id={`${searchId}-error`} className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
