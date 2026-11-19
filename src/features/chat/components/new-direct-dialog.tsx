import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { matches } from "@/shared/lib/utils";
import { Avatar, Dialog, errorText, Input } from "@/shared/ui";
import { chatApi } from "../api";

/** Choosing a colleague for a private chat. If the two already have one, it opens it; otherwise it starts one. */
export function NewDirectDialog({ open, onClose, people, me }: { open: boolean; onClose: () => void; people: User[]; me: number }) {
  const { tr, lang } = useFmt();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const shown = people.filter((u) => u.active && u.id !== me && matches(q, u.name, u.name_en, u.email));

  const start = async (u: User) => {
    setBusy(true);
    setError(undefined);
    try {
      const c = await chatApi.startDirect(u.id);
      onClose();
      setQ("");
      router.push(`/chat/${c.key}`);
    } catch (e) {
      setError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={tr("محادثة خاصة جديدة", "New private chat")}>
      <div className="flex flex-col gap-3">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr("ابحث بالاسم أو البريد", "Search by name or email")}
          aria-label={tr("ابحث عن زميل", "Search for a colleague")}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
          {shown.map((u) => (
            <li key={u.id}>
              <button type="button" disabled={busy} onClick={() => start(u)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start hover:bg-chip disabled:opacity-60">
                <Avatar user={u} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{lang === "en" && u.name_en ? u.name_en : u.name}</span>
                  <span className="truncate text-xs text-muted" dir="ltr">
                    {u.email}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="p-4 text-center text-sm text-muted">{tr("لا أحد بهذا الاسم.", "Nobody by that name.")}</li>}
        </ul>
      </div>
    </Dialog>
  );
}
