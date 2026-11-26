import { Eye, EyeOff, Wand2 } from "lucide-react";
import { useState } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { makePassword } from "@/shared/lib/password";
import { cn } from "@/shared/lib/utils";
import { Input } from "./field";

/**
 * A password box with an eye to show or hide what is typed, and (for an account someone else will use) a button that
 * makes a strong random one and shows it, so it can be copied and given to the person.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  invalid,
  generate,
  autoComplete = "new-password",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  generate?: boolean;
  autoComplete?: "new-password" | "current-password";
}) {
  const { tr } = useFmt();
  const [shown, setShown] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          dir="ltr"
          autoComplete={autoComplete}
          value={value}
          invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
          className="pe-11"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? tr("أخفِ كلمة المرور", "Hide the password") : tr("أظهر كلمة المرور", "Show the password")}
          aria-pressed={shown}
          className="absolute inset-y-0 end-1 my-auto flex size-9 items-center justify-center rounded-lg text-muted hover:bg-chip hover:text-text"
        >
          {shown ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </div>
      {generate && (
        <button
          type="button"
          onClick={() => {
            onChange(makePassword());
            setShown(true);
          }}
          className={cn("flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-muted hover:border-accent hover:text-text")}
        >
          <Wand2 size={15} aria-hidden="true" />
          {tr("أنشئ كلمة مرور", "Make one")}
        </button>
      )}
    </div>
  );
}
