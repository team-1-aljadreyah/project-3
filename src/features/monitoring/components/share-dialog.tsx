import { useState } from "react";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { Button, Dialog, PeoplePicker, errorText, useToast } from "@/shared/ui";
import { monitoringApi } from "../api";
import type { MonitorNote } from "../types";

/** Send a note to more people (they find it under "Received from monitoring" and are told once). */
export function ShareDialog({ note, people, me, onClose, onDone }: { note: MonitorNote | null; people: User[]; me: number; onClose: () => void; onDone: (n: MonitorNote) => void }) {
  const { tr } = useFmt();
  const toast = useToast();
  const [ids, setIds] = useState<number[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [forId, setForId] = useState<number | null>(null);
  if ((note?.id ?? null) !== forId) {
    setForId(note?.id ?? null);
    setIds([]);
    setError(undefined);
  }
  const already = new Set(note?.shared_with?.map((s) => s.id) ?? []);
  const choices = people.filter((p) => p.active && p.id !== me && p.role !== "ceo" && !already.has(p.id));

  const go = async () => {
    if (!note) return;
    if (!ids.length) return setError(tr("اختر شخصاً واحداً على الأقل.", "Choose at least one person."));
    setBusy(true);
    try {
      const saved = await monitoringApi.share(note.id, ids);
      toast(tr("أُرسلت.", "Sent."));
      onDone(saved);
      onClose();
    } catch (e) {
      toast(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!note}
      onClose={onClose}
      title={tr("أرسلها إلى أشخاص آخرين", "Send it to other people")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={go} disabled={busy}>
            {busy ? tr("جارٍ الإرسال…", "Sending…") : tr("أرسل", "Send")}
          </Button>
        </>
      }
    >
      {note && (
        <div className="flex flex-col gap-3">
          <p dir="auto" className="text-sm font-medium">
            {note.title}
          </p>
          <PeoplePicker people={choices} value={ids} onChange={setIds} error={error} legend={{ ar: "إلى", en: "To" }} />
          <p className="text-xs text-muted">{tr("يجدونها في «طلباتي» تحت «وصلني من المتابعة»، وترى هنا من فتحها.", 'They find it in "My requests" under "Received from monitoring"; you see here who opened it.')}</p>
        </div>
      )}
    </Dialog>
  );
}
