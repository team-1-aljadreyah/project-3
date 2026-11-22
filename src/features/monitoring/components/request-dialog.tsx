import { useState } from "react";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { Button, Dialog, Field, Textarea, errorText, useToast } from "@/shared/ui";
import { monitoringApi } from "../api";
import { NOTE_LIMITS as L } from "../rules";
import type { MonitorNote } from "../types";

/**
 * The monitoring officer handles a request that reached her: send it on to the CEO (with an optional note the CEO
 * sees), or answer it herself (the person who asked sees her answer, and it does not go to the CEO).
 */
export function RequestDialog({ note, mode, onClose, onDone }: { note: MonitorNote | null; mode: "forward" | "answer"; onClose: () => void; onDone: (n: MonitorNote) => void }) {
  const { tr } = useFmt();
  const toast = useToast();
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [forId, setForId] = useState<number | null>(null);
  // A new request (or the other button): start empty.
  const key = note ? note.id * 2 + (mode === "answer" ? 1 : 0) : null;
  if (key !== forId) {
    setForId(key);
    setText("");
    setError(undefined);
  }

  const forward = mode === "forward";
  const go = async () => {
    if (!note) return;
    if (!forward && !text.trim()) return setError(tr("اكتب ردك.", "Write your answer."));
    setBusy(true);
    try {
      const saved = forward ? await monitoringApi.forwardRequest(note.id, text.trim() || undefined) : await monitoringApi.answerRequest(note.id, text.trim());
      toast(forward ? tr("أُرسل الطلب إلى المدير التنفيذي.", "The request was sent on to the CEO.") : tr("أُرسل ردك إلى صاحب الطلب.", "Your answer was sent to the person who asked."));
      onDone(saved);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.errors) setError(e.errors.reply ?? e.errors.note);
      else toast(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!note}
      onClose={onClose}
      title={forward ? tr("أرسل الطلب إلى المدير التنفيذي", "Send the request on to the CEO") : tr("أجب عن الطلب بنفسك", "Answer the request yourself")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={go} disabled={busy}>
            {busy ? tr("جارٍ الإرسال…", "Sending…") : forward ? tr("أرسل إلى المدير التنفيذي", "Send to the CEO") : tr("أرسل الرد", "Send the answer")}
          </Button>
        </>
      }
    >
      {note && (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <div className="rounded-lg bg-card-2 px-3 py-2 text-sm">
            <b dir="auto" className="block">
              {note.title}
            </b>
            <p dir="auto" className="mt-1 line-clamp-4 whitespace-pre-line text-muted">
              {note.body}
            </p>
          </div>
          <Field
            label={forward ? tr("ملاحظة للمدير التنفيذي (اختيارية)", "A note for the CEO (optional)") : tr("ردك", "Your answer")}
            hint={forward ? tr("يراها المدير التنفيذي وحده، لا صاحب الطلب.", "Only the CEO sees it, not the person who asked.") : tr("يصل إلى صاحب الطلب، ولا يذهب الطلب إلى المدير التنفيذي.", "It reaches the person who asked; the request does not go to the CEO.")}
            htmlFor="request-text"
            error={error}
          >
            <Textarea id="request-text" dir="auto" rows={4} maxLength={L.reply} value={text} invalid={!!error} onChange={(e) => setText(e.target.value)} />
          </Field>
        </form>
      )}
    </Dialog>
  );
}
