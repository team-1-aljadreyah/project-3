import type { TaskStatus } from "../api/types";

/** The seven statuses every project starts with (the brief). A project may add its own. */
export const DEFAULT_STATUSES: TaskStatus[] = [
  { key: "new", name: "جديدة", name_en: "New", tone: "new" },
  { key: "todo", name: "قيد الانتظار", name_en: "To do", tone: "todo" },
  { key: "in_progress", name: "قيد التنفيذ", name_en: "In progress", tone: "progress" },
  { key: "in_review", name: "قيد المراجعة", name_en: "In review", tone: "review" },
  { key: "testing", name: "قيد الاختبار", name_en: "Testing", tone: "testing" },
  { key: "completed", name: "مكتملة", name_en: "Completed", tone: "done" },
  { key: "blocked", name: "متوقفة", name_en: "Blocked", tone: "blocked" },
];
