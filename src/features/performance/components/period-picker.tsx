import { useFmt } from "@/shared/lib/i18n";
import { Input, Select } from "@/shared/ui";
import { presetPeriods } from "../metrics";
import type { Period } from "../types";

type Preset = "d30" | "d90" | "year" | "custom";

/** Which period the numbers are for: the last 30 or 90 days, this year, or two chosen days. */
export function PeriodPicker({ value, onChange, today }: { value: Period; onChange: (p: Period) => void; today: string }) {
  const { tr } = useFmt();
  const presets = presetPeriods(today);
  const current = (Object.keys(presets) as (keyof typeof presets)[]).find((k) => presets[k].from === value.from && presets[k].to === value.to) ?? "custom";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label={tr("الفترة", "Period")}
        value={current}
        onChange={(e) => {
          const k = e.target.value as Preset;
          if (k !== "custom") onChange(presets[k]);
          else onChange({ ...value });
        }}
        className="h-9 w-auto"
      >
        <option value="d30">{tr("آخر 30 يوماً", "Last 30 days")}</option>
        <option value="d90">{tr("آخر 90 يوماً", "Last 90 days")}</option>
        <option value="year">{tr("هذه السنة", "This year")}</option>
        <option value="custom">{tr("فترة أخرى…", "Other period…")}</option>
      </Select>
      {current === "custom" && (
        <>
          <Input type="date" aria-label={tr("من", "From")} value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} className="h-9 w-auto" />
          <Input type="date" aria-label={tr("إلى", "To")} value={value.to} min={value.from} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} className="h-9 w-auto" />
        </>
      )}
    </div>
  );
}
