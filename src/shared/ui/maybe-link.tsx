import Link from "next/link";
import { cn } from "@/shared/lib/utils";

/**
 * A link when there is somewhere to go, else plain text: for names and labels that open a page only for some viewers
 * (a person's performance, a project). `cover` makes the link cover its nearest `relative` box (a whole row or card).
 */
export function MaybeLink({ href, cover, className, children }: { href?: string; cover?: boolean; className?: string; children: React.ReactNode }) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link href={href} className={cn("hover:underline", cover && "after:absolute after:inset-0", className)}>
      {children}
    </Link>
  );
}
