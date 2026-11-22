import { useState } from "react";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { Button } from "@/shared/ui";
import { projectsApi } from "../../api";
import { useSave } from "../../hooks/use-save";
import type { Project } from "../../types";
import { FormError } from "../form-error";
import { MemberPicker } from "../member-picker";

/**
 * Who works on the project. The department manager is always in. Someone with open tasks here can't be removed until
 * the tasks are given to another member (the server answers with who, and the message shows below).
 */
export function MembersTab({ project, people }: { project: Project; people: User[] }) {
  const { tr } = useFmt();
  const [ids, setIds] = useState(project.member_ids);
  const { busy, errors, formError, save } = useSave();
  const changed = ids.length !== project.member_ids.length || ids.some((id) => !project.member_ids.includes(id));

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <MemberPicker people={people} value={ids} onChange={setIds} locked={[project.pm_id]} error={errors.member_ids} />
      <FormError text={formError} />
      <div>
        <Button
          disabled={busy || !changed}
          onClick={() => save(() => projectsApi.updateProject(project.id, { member_ids: ids }), tr("حُفظ الأعضاء.", "Members saved."))}
        >
          {busy ? tr("جارٍ الحفظ…", "Saving…") : tr("احفظ الأعضاء", "Save members")}
        </Button>
      </div>
    </div>
  );
}
