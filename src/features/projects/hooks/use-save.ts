import { useState } from "react";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { errorText, useToast } from "@/shared/ui";

/**
 * The saving part every settings form shares: `busy` while it saves, the server's errors under their fields
 * (`errors.name`), any other error as one message (`formError`), and a short message when it worked.
 *
 *   const { busy, errors, formError, save } = useSave();
 *   save(() => projectsApi.updateProject(id, patch), tr("حُفظ.", "Saved."));
 */
export function useSave() {
  const { tr } = useFmt();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  const save = async (call: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setErrors({});
    setFormError(undefined);
    try {
      await call();
      toast(done);
      return true;
    } catch (e) {
      // 422 errors belong to fields; anything else (403, 409, no network) is one message for the whole form.
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      else setFormError(errorText(e, tr));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, errors, setErrors, formError, save };
}

