import { Bug, CornerDownLeft, FolderKanban, LayoutGrid, Megaphone, Search, SquareCheckBig, User as UserIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { navFor, personHref } from "@/shared/lib/access";
import { useFmt } from "@/shared/lib/i18n";
import { useUser } from "@/shared/lib/session";
import { cn, matches } from "@/shared/lib/utils";
import { searchApi } from "../api";
import type { SearchHit, SearchKind } from "../types";

interface Row {
  key: string;
  group: SearchKind | "page";
  title: string;
  code?: string;
  context?: string;
  href: string;
}

const ICON = { page: LayoutGrid, project: FolderKanban, task: SquareCheckBig, bug: Bug, announcement: Megaphone, person: UserIcon };
const GROUP = {
  page: { ar: "الصفحات", en: "Pages" },
  project: { ar: "المشاريع", en: "Projects" },
  task: { ar: "المهام", en: "Tasks" },
  bug: { ar: "الأخطاء البرمجية", en: "Bugs" },
  announcement: { ar: "الإعلانات", en: "Announcements" },
  person: { ar: "الأشخاص", en: "People" },
};
const HREF: Record<Exclude<SearchKind, "person">, string> = { project: "/projects/", task: "/tasks/", bug: "/bugs/", announcement: "/announcements/" };

/**
 * Quick search: a button in the top bar, and Ctrl+K (⌘K) or "/" anywhere. Type to jump to a page, a project, a task, a
 * bug, an announcement or a person (only what you may see). Arrow keys move, Enter opens, Escape closes.
 */
export function QuickSearch() {
  const { tr, lang } = useFmt();
  const user = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const asked = useRef("");
  const listId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setHits([]);
    button.current?.focus();
  }, []);

  // Ctrl+K / ⌘K anywhere; "/" when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // Ask the server a moment after typing stops; an older answer never replaces a newer one.
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) return; // Too short: the results below are hidden (see `found`).
    const t = setTimeout(() => {
      setLoading(true);
      asked.current = text;
      searchApi
        .search(text)
        .then((r) => {
          // A server answer of another shape must never break the page: no list, no results.
          if (asked.current === r.q) setHits(Array.isArray(r?.hits) ? r.hits : []);
        })
        .catch(() => setHits([]))
        .finally(() => {
          if (asked.current === text) setLoading(false);
        });
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  const name = (h: { title: string; title_en?: string }) => (lang === "en" && h.title_en ? h.title_en : h.title);
  const pages: Row[] = navFor(user.role)
    .filter((n) => n.ready && matches(q, n.ar, n.en))
    .slice(0, q ? 5 : 8)
    .map((n) => ({ key: `page-${n.key}`, group: "page", title: tr(n.ar, n.en), href: n.href }));
  const found: Row[] = (q.trim().length >= 2 ? hits : []).flatMap((h): Row[] => {
    const href = h.kind === "person" ? personHref(user, { id: h.id, role: h.role, team_id: h.team_id }) : HREF[h.kind] + h.id;
    if (!href) return []; // A person whose work this viewer may not open.
    const context = lang === "en" && h.context_en ? h.context_en : h.context;
    return [{ key: `${h.kind}-${h.id}`, group: h.kind, title: name(h), code: h.code, context, href }];
  });
  const rows = [...pages, ...found];
  const pick = Math.min(active, Math.max(0, rows.length - 1));

  const go = (row: Row | undefined) => {
    if (!row) return;
    close();
    router.push(row.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (rows.length ? (Math.min(i, rows.length - 1) + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (rows.length ? (Math.min(i, rows.length - 1) - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[pick]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tr("بحث سريع (Ctrl+K)", "Quick search (Ctrl+K)")}
        aria-haspopup="dialog"
        className="flex h-9 items-center gap-2 rounded-full px-2 text-sm text-muted hover:bg-chip hover:text-text xl:border xl:border-line xl:ps-3 xl:pe-2"
      >
        <Search size={17} aria-hidden="true" />
        <span className="hidden xl:inline">{tr("بحث", "Search")}</span>
        <kbd dir="ltr" className="hidden rounded border border-line px-1 font-sans text-[11px] text-faint xl:inline">
          Ctrl K
        </kbd>
      </button>

      {open && (
        // A press on the dimmed backdrop closes it, like Escape (the keyboard way).
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-3 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div role="dialog" aria-modal="true" aria-label={tr("بحث سريع", "Quick search")} className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-lg">
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search size={18} aria-hidden="true" className="shrink-0 text-muted" />
              <input
                ref={input}
                role="combobox"
                aria-expanded={rows.length > 0}
                aria-controls={listId}
                aria-activedescendant={rows[pick] ? `${listId}-${rows[pick].key}` : undefined}
                aria-autocomplete="list"
                aria-label={tr("ابحث عن صفحة أو مشروع أو مهمة أو شخص", "Search for a page, project, task or person")}
                placeholder={tr("ابحث عن صفحة، مشروع، مهمة، مشكلة، شخص…", "Search pages, projects, tasks, bugs, people…")}
                dir="auto"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                className="h-13 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
              />
              <button type="button" onClick={close} aria-label={tr("إغلاق", "Close")} className="rounded-lg p-1.5 text-muted hover:bg-chip hover:text-text">
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <ul id={listId} role="listbox" aria-label={tr("النتائج", "Results")} className="flex-1 overflow-y-auto p-2">
              {rows.map((r, i) => {
                const Icon = ICON[r.group];
                const first = i === 0 || rows[i - 1].group !== r.group;
                return (
                  <li key={r.key} role="presentation">
                    {first && <div className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-faint">{tr(GROUP[r.group].ar, GROUP[r.group].en)}</div>}
                    {/* The combobox pattern: focus stays in the field, the active option is announced through
                        aria-activedescendant and chosen with Enter, so the options themselves are not tab stops. */}
                    {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus, jsx-a11y/click-events-have-key-events */}
                    <div
                      id={`${listId}-${r.key}`}
                      role="option"
                      aria-selected={i === pick}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(r)}
                      className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm", i === pick ? "bg-accent-soft text-accent-ink" : "text-text")}
                    >
                      <Icon size={16} aria-hidden="true" className="shrink-0 opacity-70" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span dir="auto" className="truncate font-medium">
                          {r.title}
                        </span>
                        {r.context && (
                          <span dir="auto" className="truncate text-xs text-muted">
                            {r.context}
                          </span>
                        )}
                      </span>
                      {r.code && (
                        <span dir="ltr" className="shrink-0 font-mono text-[11px] text-faint">
                          {r.code}
                        </span>
                      )}
                      {i === pick && <CornerDownLeft size={14} aria-hidden="true" className="shrink-0 opacity-60" />}
                    </div>
                  </li>
                );
              })}
            </ul>

            <p role="status" className="border-t border-line px-4 py-2 text-xs text-faint">
              {loading
                ? tr("جارٍ البحث…", "Searching…")
                : q.trim().length >= 2 && found.length === 0
                  ? tr("لا نتائج غير الصفحات. جرّب كلمة أخرى أو رمزاً مثل TSK-118.", "No results besides pages. Try another word or a code like TSK-118.")
                  : tr("↑ ↓ للتنقل · Enter للفتح · Esc للإغلاق", "↑ ↓ to move · Enter to open · Esc to close")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

