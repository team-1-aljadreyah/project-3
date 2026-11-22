import { useId } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * One part of an administration page: a framed box with a header bar (the title, a line about it, and tools such as a
 * search box on the other side) over its content. `id` lets links jump to it (/admin/security#locked).
 */
export function Panel({
  id,
  title,
  note,
  tools,
  className,
  children,
}: {
  id?: string;
  title: React.ReactNode;
  note?: React.ReactNode;
  tools?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <section id={id} aria-labelledby={titleId} className={cn("scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-card-2 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={titleId} className="font-semibold">
            {title}
          </h2>
          {note && <p className="text-xs text-muted">{note}</p>}
        </div>
        {tools}
      </div>
      {children}
    </section>
  );
}
