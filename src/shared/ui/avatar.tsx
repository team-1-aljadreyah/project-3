import type { User } from "@/shared/api/types";
import { cn, initialOf } from "@/shared/lib/utils";
import { avatarClass } from "./tones";

const SIZE = { sm: "size-6 text-[11px]", md: "size-8 text-[13px]", lg: "size-10 text-sm" };

/** A person's first letter in their own colour. The full name is the tooltip and what screen readers hear. */
export function Avatar({ user, size = "md", className }: { user: Pick<User, "id" | "name">; size?: keyof typeof SIZE; className?: string }) {
  return (
    <span
      role="img"
      aria-label={user.name}
      title={user.name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", SIZE[size], avatarClass(user.id), className)}
    >
      {initialOf(user.name)}
    </span>
  );
}

/** Several people, overlapping. Shows up to `max`, then "+N". */
export function AvatarStack({ users, max = 5 }: { users: Pick<User, "id" | "name">[]; max?: number }) {
  const shown = users.slice(0, max);
  const more = users.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((u) => (
        <Avatar key={u.id} user={u} className="-ms-1.5 border-2 border-bg first:ms-0" />
      ))}
      {more > 0 && <span className="-ms-1.5 inline-flex size-8 items-center justify-center rounded-full border-2 border-bg bg-chip text-xs font-semibold">+{more}</span>}
    </div>
  );
}
