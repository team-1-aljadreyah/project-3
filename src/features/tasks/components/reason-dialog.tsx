import { useState } from "react";
import { Button, Dialog, Field, Textarea } from "@/shared/ui";
import { useFmt } from "@/shared/lib/i18n";
import { LIMITS } from "../rules";

/**
 * Asks for a short text before an action: why a task is blocked, or why a completion is sent back.
 * `onSubmit` returns an error message to show under the field, or nothing when it worked.
 */
export function ReasonDialog({
  open,
  title,
  label,
  hint,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  hint?: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (text: string) => Promise<string | void>;
}) {
  const { tr } = useFmt();
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const close = () => {
    setText("");
    setError(undefined);
    onClose();
  };

  const submit = async () => {
    if (!text.trim()) {
      setError(tr("اكتب السبب أولاً.", "Write the reason first."));
      return;
    }
    setBusy(true);
    const err = await onSubmit(text.trim());
    setBusy(false);
    if (err) setError(err);
    else close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label={label} htmlFor="reason-text" error={error} hint={hint}>
          <Textarea
            id="reason-text"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- a dialog moves focus into itself when it opens (WAI-ARIA dialog pattern)
            autoFocus
            maxLength={LIMITS.reason}
            value={text}
            invalid={!!error}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
      </form>
    </Dialog>
  );
}
