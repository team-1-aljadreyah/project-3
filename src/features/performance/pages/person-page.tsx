import Link from "next/link";
import { useFmt } from "@/shared/lib/i18n";
import { useRouteParam } from "@/shared/lib/route-param";
import { useUser } from "@/shared/lib/session";
import { PrintButton } from "@/shared/ui";
import { PersonView } from "../components/person-view";

/** /performance/5: one person's performance, for those who may see it (the server answers 404 otherwise). */
export function PersonPage() {
  const { tr } = useFmt();
  const me = useUser();
  const id = Number(useRouteParam("performance"));
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <nav aria-label={tr("مسار الصفحة", "Breadcrumb")} className="text-[13px] text-muted print:hidden">
          <Link href="/performance" className="hover:text-text hover:underline">
            {tr("الأداء", "Performance")}
          </Link>
        </nav>
        <PrintButton target={() => null} />
      </div>
      <PersonView key={id} userId={id} me={me} />
    </div>
  );
}
