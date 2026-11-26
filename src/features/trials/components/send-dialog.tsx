import { Send } from "lucide-react";
import { useState } from "react";
import { monitoringApi } from "@/features/monitoring";
import { useFmt } from "@/shared/lib/i18n";
import { Button, Dialog, errorText, Field, Textarea, useToast } from "@/shared/ui";
import { trialReport } from "../report";
import type { TrialTeamDetail } from "../types";

/**
 * "Send to the CEO": her own words on top (optional), and the report as the CEO will read it. It arrives in the CEO's
 * inbox as a monitoring report (answered there); the trial team itself stays private.
 */
export function SendToCeoDialog({ detail, onClose }: { detail: TrialTeamDetail; onClose: () => void }) {
  const { tr, day } = useFmt();
  const toast = useToast();
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const report = trialReport(detail, { tr, day, extra });

  const send = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await monitoringApi.create({ kind: "report", title: report.title, body: report.body, about: { type: "general" }, send: true });
      toast(tr("أُرسل التقرير إلى المدير التنفيذي. تجده في «المتابعة» مع الرد عليه.", "The report was sent to the CEO. You will find it, with the answer, in Monitoring."));
      onClose();
    } catch (e) {
      setError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={tr("أرسل التقرير إلى المدير التنفيذي", "Send the report to the CEO")}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={send} disabled={busy}>
            <Send size={15} aria-hidden="true" />
            {busy ? tr("جارٍ الإرسال…", "Sending…") : tr("أرسل", "Send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={tr("كلمة منك في أوّله (اختيارية)", "Your own words on top (optional)")} htmlFor="ts-extra">
          <Textarea id="ts-extra" rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={tr("مثلاً: أقترح قبول ثلاثة منهم.", "For example: I suggest keeping three of them.")} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">{tr("ما سيصل إلى المدير التنفيذي", "What the CEO will get")}</p>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-line bg-card-2 p-4">
            <p className="mb-2 font-semibold">{report.title}</p>
            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line text-muted">
              {report.body}
            </p>
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
