import { Flag } from "lucide-react";
import { useState } from "react";
import { canCloseSprint, canManageProject, currentSprint, isClosed, sprintNumbers, type Project, type Sprint } from "@/features/projects";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { Button, Empty, Pill, Select, Stat } from "@/shared/ui";
import type { Task } from "../types";
import { EndSprintDialog } from "./end-sprint-dialog";
import { Kanban } from "./kanban";

/**
 * The Scrum board (the brief: "a sprint's planned, done and left tasks"): one sprint at a time, its three numbers, its
 * tasks on the board, and "End sprint" for the project's managers. (The page's header shows the open sprint against the plan.)
 */
export function SprintBoard({
  project,
  sprints,
  tasks,
  users,
  user,
  today,
  onMove,
  reload,
}: {
  project: Project;
  sprints: Sprint[];
  tasks: Task[];
  users: User[];
  user: User;
  today: string;
  onMove: (task: Task, to: string) => void;
  reload: () => void;
}) {
  const { tr, num, pct, day } = useFmt();
  const [chosen, setChosen] = useState<number>();
  const [ending, setEnding] = useState<Sprint | null>(null);
  const sorted = [...sprints].sort((a, b) => a.start.localeCompare(b.start));
  const sprint = sorted.find((s) => s.id === chosen) ?? currentSprint(sprints, today);

  if (!sprint) {
    return (
      <Empty
        title={tr("لا توجد دورات بعد", "No sprints yet")}
        body={tr("يضيف مدير القسم الدورات من إعدادات المشروع، ثم تُنقل إليها المهام من قائمة الانتظار.", "The department manager adds sprints in the project settings, then moves tasks into them from the backlog.")}
      />
    );
  }

  const numbers = sprintNumbers(project, sprint, tasks);
  const closed = isClosed(sprint);
  const overdue = !closed && sprint.end < today;
  const mine = tasks.filter((t) => t.sprint_id === sprint.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select aria-label={tr("اختر الدورة", "Choose the sprint")} value={sprint.id} onChange={(e) => setChosen(Number(e.target.value))} className="h-9 w-auto">
          {sorted.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {isClosed(s) ? tr(" (منتهية)", " (ended)") : ""}
            </option>
          ))}
        </Select>
        <span className="text-[13px] text-muted">
          {day(sprint.start)} – {day(sprint.end)}
        </span>
        {closed && <Pill tone="done">{tr("منتهية", "Ended")}</Pill>}
        {overdue && <Pill tone="blocked">{tr("انتهى موعدها ولم تُغلق", "Past its end, not ended yet")}</Pill>}
        {canManageProject(user, project) && canCloseSprint(sprint, today) && (
          <Button variant="secondary" pill onClick={() => setEnding(sprint)} className="ms-auto">
            <Flag size={15} aria-hidden="true" />
            {tr("أنهِ الدورة", "End sprint")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label={tr("المخطط", "Planned")} value={num(numbers.planned)} note={tr("مهام الدورة", "tasks in the sprint")} />
        <Stat label={tr("المنجز", "Done")} value={num(numbers.done)} note={pct(numbers.ratio)} />
        <Stat
          label={tr("المتبقي", "Left")}
          value={num(numbers.left)}
          danger={overdue && numbers.left > 0}
          note={closed ? tr(`نُقلت ${num(sprint.result?.moved ?? 0)}`, `${sprint.result?.moved ?? 0} moved on`) : tr("لم تُنجز بعد", "not done yet")}
        />
      </div>

      {mine.length === 0 ? (
        <Empty
          title={tr("لا مهام في هذه الدورة", "No tasks in this sprint")}
          body={closed ? tr("نُقلت مهامها غير المنجزة عند إنهائها.", "Its unfinished tasks moved on when it ended.") : tr("أضف مهام إليها من قائمة الانتظار.", "Add tasks to it from the backlog.")}
        />
      ) : (
        <Kanban project={project} tasks={mine} allTasks={tasks} users={users} user={user} today={today} onMove={onMove} />
      )}

      <EndSprintDialog
        sprint={ending}
        sprints={sprints}
        numbers={ending ? sprintNumbers(project, ending, tasks) : undefined}
        onClose={() => setEnding(null)}
        onDone={() => {
          setEnding(null);
          reload();
        }}
      />
    </div>
  );
}
