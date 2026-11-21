import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { useRef, useState } from "react";
import { StatusPill } from "@/shared/ui";
import { groupByStatus, lateDays, type Project } from "@/features/projects";
import type { TaskStatus, User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { canMoveTask, openDependencies, planMove, statusOf } from "../rules";
import type { Task } from "../types";
import { cn } from "@/shared/lib/utils";
import { cardClass, TaskCard, TaskCardBody } from "./task-card";

/** Column width (260) + the gap between columns (12): one arrow key = one column. */
const COLUMN_STEP = 272;
const byColumn: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
  if (event.code === "ArrowLeft") return { ...currentCoordinates, x: currentCoordinates.x - COLUMN_STEP };
  if (event.code === "ArrowRight") return { ...currentCoordinates, x: currentCoordinates.x + COLUMN_STEP };
  return undefined;
};

function Column({ status, count, children }: { status: TaskStatus; count: number; children: React.ReactNode }) {
  const { tr } = useFmt();
  const { setNodeRef, isOver } = useDroppable({ id: status.key });
  return (
    <section
      ref={setNodeRef}
      aria-label={tr(`عمود ${status.name}`, `${status.name_en} column`)}
      className={cn("flex w-[260px] shrink-0 flex-col gap-2 rounded-xl p-1 transition-colors", isOver && "bg-accent-soft/60 ring-2 ring-accent")}
    >
      <div className="flex items-center justify-between px-0.5">
        <h2>
          <StatusPill status={status} className="px-3 py-1 text-[13px] font-semibold" />
        </h2>
        <span className="num text-xs font-semibold text-muted">{count}</span>
      </div>
      {children}
    </section>
  );
}

/**
 * The Kanban board: one column per status of THIS project (never a fixed list, the brief lets projects add
 * their own). Cards move between columns by dragging; `onMove` decides what that means (a reason for "blocked",
 * approval for "done"). The card shows in its new column at once, then the saved data replaces it.
 * Many columns scroll sideways inside the board, so the page itself never scrolls sideways.
 */
export function Kanban({
  project,
  tasks,
  users,
  user,
  today,
  onMove,
  allTasks,
}: {
  project: Project;
  tasks: Task[];
  /** Every task of the project, to count what a card waits for (a shown task may wait for one not shown). */
  allTasks?: Task[];
  users: User[];
  user: User;
  today: string;
  onMove: (task: Task, to: string) => void;
}) {
  const { tr, lang } = useFmt();
  const byId = new Map(users.map((u) => [u.id, u]));
  const [dragging, setDragging] = useState<Task | null>(null);
  const lastDrop = useRef(0);

  // Where a card was dropped, until the new data arrives (then the server's answer wins).
  const [moved, setMoved] = useState<Record<number, string>>({});
  const [shownFor, setShownFor] = useState(tasks);
  if (shownFor !== tasks) {
    setShownFor(tasks);
    setMoved({});
  }
  const view = tasks.map((t) => (moved[t.id] ? { ...t, status: moved[t.id] } : t));
  const columns = groupByStatus(project, view);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // On a phone a long press starts the drag, so a normal swipe still scrolls the board.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // Space picks up and drops (Enter still opens the task), arrows move one column, Escape cancels.
    useSensor(KeyboardSensor, { coordinateGetter: byColumn, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] } }),
  );

  const statusName = (key: string | number | undefined) => {
    const s = key === undefined ? undefined : statusOf(project, String(key));
    return s ? (lang === "en" ? s.name_en : s.name) : "";
  };
  const codeOf = (id: string | number) => tasks.find((t) => t.id === id)?.code ?? "";

  // What screen readers hear while dragging.
  const announcements: Announcements = {
    onDragStart: ({ active }) => tr(`بدأ سحب ${codeOf(active.id)}.`, `Picked up ${codeOf(active.id)}.`),
    onDragOver: ({ over }) => (over ? tr(`فوق عمود ${statusName(over.id)}.`, `Over ${statusName(over.id)}.`) : ""),
    onDragEnd: ({ active, over }) =>
      over ? tr(`أُفلتت ${codeOf(active.id)} في عمود ${statusName(over.id)}.`, `Dropped in ${statusName(over.id)}.`) : tr("أُلغي السحب.", "Cancelled."),
    onDragCancel: () => tr("أُلغي السحب.", "Cancelled."),
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    lastDrop.current = Date.now();
    const task = tasks.find((t) => t.id === active.id);
    if (!task || !over || over.id === task.status) return;
    const to = String(over.id);
    // Show it in the new column at once, unless it needs a reason or an approval first.
    if (planMove(user, project, task, to) === "move") setMoved((m) => ({ ...m, [task.id]: to }));
    onMove(task, to);
  };

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: tr(
            "لنقل المهمة: اضغط المسافة، ثم السهمين يميناً ويساراً لاختيار العمود، ثم المسافة للإفلات، أو Escape للإلغاء. Enter يفتح المهمة.",
            "To move the task: press Space, use the left and right arrows to pick a column, then Space to drop, or Escape to cancel. Enter opens the task.",
          ),
        },
      }}
      onDragStart={({ active }) => setDragging(tasks.find((t) => t.id === active.id) ?? null)}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      {/* Room above the columns (pulled back up by -mt-1) so a column's drop ring isn't cut by the scroll area. */}
      <div className="-mx-3 -mt-1 overflow-x-auto px-3 pt-1 pb-2 sm:-mx-7 sm:px-7">
        <div className="flex min-w-max gap-3">
          {columns.map(({ status, tasks: list }) => (
            <Column key={status.key} status={status} count={list.length}>
              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line-strong px-3 py-6 text-center text-xs text-faint">{tr("لا توجد مهام", "No tasks")}</p>
              ) : (
                list.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    tone={status.tone}
                    assignee={task.assignee_id ? byId.get(task.assignee_id) : undefined}
                    late={lateDays(project, task, today)}
                    today={today}
                    waiting={openDependencies(project, task, allTasks ?? tasks).length}
                    canDrag={canMoveTask(user, project, task)}
                    justDragged={() => Date.now() - lastDrop.current < 300}
                  />
                ))
              )}
            </Column>
          ))}
        </div>
      </div>
      {/* The copy that follows the pointer while dragging. */}
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className={cn(cardClass, "w-[252px] rotate-2 cursor-grabbing shadow-xl")}>
            <TaskCardBody
              task={dragging}
              tone={statusOf(project, dragging.status)?.tone ?? "new"}
              assignee={dragging.assignee_id ? byId.get(dragging.assignee_id) : undefined}
              late={lateDays(project, dragging, today)}
              today={today}
              waiting={openDependencies(project, dragging, allTasks ?? tasks).length}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
