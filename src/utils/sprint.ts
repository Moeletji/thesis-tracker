import type { Task } from "../types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface SprintWindow {
  start: Date;
  end: Date;
  overflowEnd: Date;
}

export type DeadlineStatus = "none" | "ontrack" | "overflow" | "late";

export interface DeadlineDescriptor {
  status: DeadlineStatus;
  label: string;
  targetDate: Date | null;
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  weekday: "short",
});

export const longDateFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function getSprintWindow(referenceDate = new Date()): SprintWindow {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const overflowEnd = new Date(end);
  overflowEnd.setDate(end.getDate() + 7);
  overflowEnd.setHours(23, 59, 59, 999);

  return { start, end, overflowEnd };
}

export function ensureSprintDates(tasks: Task[], window: SprintWindow) {
  let changed = false;

  const normalized = tasks.map((task) => {
    const nextTask: Task = {
      ...task,
      dueDate: task.dueDate ?? window.end.toISOString(),
      overflowDate: task.overflowDate ?? window.overflowEnd.toISOString(),
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    };

    if (
      task.dueDate !== nextTask.dueDate ||
      task.overflowDate !== nextTask.overflowDate ||
      task.subtasks !== nextTask.subtasks
    ) {
      changed = true;
    }

    return nextTask;
  });

  return { tasks: normalized, changed };
}

export function formatDisplayDate(date: Date | string | null) {
  if (!date) return "—";
  const parsed = typeof date === "string" ? new Date(date) : date;
  return dateFormatter.format(parsed);
}

export function describeTaskDeadline(
  task: Pick<Task, "dueDate" | "overflowDate">,
  now = new Date()
): DeadlineDescriptor {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const overflowDate = task.overflowDate ? new Date(task.overflowDate) : null;
  const nowMs = now.getTime();

  if (!dueDate) {
    return { status: "none", label: "No due date", targetDate: null };
  }

  if (nowMs <= dueDate.getTime()) {
    const daysLeft = Math.max(
      0,
      Math.ceil((dueDate.getTime() - nowMs) / DAY_IN_MS)
    );
    return {
      status: "ontrack",
      label: `${formatDisplayDate(dueDate)} · ${daysLeft}d remaining`,
      targetDate: dueDate,
    };
  }

  if (overflowDate && nowMs <= overflowDate.getTime()) {
    const daysLeft = Math.max(
      0,
      Math.ceil((overflowDate.getTime() - nowMs) / DAY_IN_MS)
    );
    return {
      status: "overflow",
      label: `Overflow buffer · ${formatDisplayDate(
        overflowDate
      )} (${daysLeft}d left)`,
      targetDate: overflowDate,
    };
  }

  return {
    status: "late",
    label: overflowDate
      ? `Past overflow · ${formatDisplayDate(overflowDate)}`
      : `Past due · ${formatDisplayDate(dueDate)}`,
    targetDate: overflowDate ?? dueDate,
  };
}

export function getOutstandingTasks(tasks: Task[]) {
  return tasks.filter((task) => task.column !== "done");
}

export function getNextReminderDate(referenceDate = new Date()) {
  const reference = new Date(referenceDate);
  const day = reference.getDay();
  let diff = (5 - day + 7) % 7;

  if (diff === 0 && reference.getHours() >= 9) {
    diff = 7;
  }

  const next = new Date(reference);
  next.setDate(reference.getDate() + diff);
  next.setHours(9, 0, 0, 0);
  return next;
}

export function isSameDay(dateA: Date, dateB: Date) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

export function formatDateRange(start: Date, end: Date) {
  return `${formatDisplayDate(start)} → ${formatDisplayDate(end)}`;
}

export function daysUntil(date: Date | string, reference = new Date()) {
  const parsed = typeof date === "string" ? new Date(date) : date;
  return Math.max(
    0,
    Math.ceil((parsed.getTime() - reference.getTime()) / DAY_IN_MS)
  );
}
