import type { User } from "@/shared/api/types";
import { personHref } from "@/shared/lib/access";
import { useFmt } from "@/shared/lib/i18n";
import { useSession } from "@/shared/lib/session";
import { MaybeLink } from "./maybe-link";

/**
 * A person's name that opens their performance page when the signed-in person may open it (personHref), else plain
 * text. `projects`: the projects around it (a project manager's links need them). `cover`: the link covers the nearest
 * `relative` box (a whole row).
 */
export function PersonName({
  person,
  projects,
  cover,
  className,
  children,
}: {
  person: Pick<User, "id" | "name" | "name_en" | "role" | "team_id">;
  projects?: { pm_id: number; member_ids: number[] }[];
  cover?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const viewer = useSession()?.user;
  const { lang } = useFmt();
  const name = children ?? (lang === "en" && person.name_en ? person.name_en : person.name);
  return (
    <MaybeLink href={viewer && personHref(viewer, person, projects)} cover={cover} className={className}>
      {name}
    </MaybeLink>
  );
}
