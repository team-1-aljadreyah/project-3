import { useState } from "react";
import type { User } from "@/shared/api/types";
import { cn, initialOf } from "@/shared/lib/utils";
import { avatarClass } from "./tones";

const SIZE = {
  sm: "size-6 text-[11px]",
  md: "size-8 text-[13px]",
  lg: "size-10 text-sm",
  xl: "size-14 text-xl",
  xxl: "size-24 text-4xl",
};
/** The picture's own width and height in pixels, so the page never jumps while it loads. */
const PX = { sm: 24, md: 32, lg: 40, xl: 56, xxl: 96 };

type Person = Pick<User, "id" | "name"> & { avatar_url?: string };

/**
 * A person's picture, or their first letter in their own colour when they have none (or it fails to load). The full
 * name is the tooltip and what screen readers hear; the picture itself has an empty alt, because the name is said once.
 */
export function Avatar({ user, size = "md", className }: { user: Person; size?: keyof typeof SIZE; className?: string }) {
  // A picture that fails to load (an old link) falls back to the letter. Keyed by the address, so a new one is tried.
  const [broken, setBroken] = useState<string | null>(null);
  const src = user.avatar_url && user.avatar_url !== broken ? user.avatar_url : null;
  return (
    <span
      role="img"
      aria-label={user.name}
      title={user.name}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        SIZE[size],
        avatarClass(user.id),
        className,
      )}
    >
      {src ? (
        // A plain <img>: the picture is already small (256×256) and may be a "data:" link in the demo.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={PX[size]}
          height={PX[size]}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setBroken(src)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        initialOf(user.name)
      )}
    </span>
  );
}

/** Several people, overlapping. Shows up to `max`, then "+N". */
export function AvatarStack({ users, max = 5 }: { users: Person[]; max?: number }) {
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
