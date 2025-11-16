import type { Task } from "../types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WEEK_IN_MS = DAY_IN_MS * 7;

export interface SprintWindow {
  start: Date;
  end: Date;
  overflowEnd: Date;
}

export interface SprintScheduleEntry extends SprintWindow {
  index: number;
}

export interface SprintScheduleOptions {
  referenceDate?: Date;
  totalSprints?: number;
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

const startOfCurrentSprint = (referenceDate = new Date()) => {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const distanceFromMonday = (day + 6) % 7;
  start.setDate(start.getDate() - distanceFromMonday);
  return start;
};

export function buildSprintSchedule(
  options: SprintScheduleOptions = {}
): SprintScheduleEntry[] {
  const { referenceDate = new Date(), totalSprints = 4 } = options;
  const firstStart = startOfCurrentSprint(referenceDate);

  return Array.from({ length: totalSprints }, (_, idx) => {
    const start = new Date(firstStart.getTime() + idx * WEEK_IN_MS);
    const end = new Date(start.getTime() + 6 * DAY_IN_MS);
    end.setHours(23, 59, 59, 999);
    const overflowEnd = new Date(end.getTime() + WEEK_IN_MS);
    return { index: idx + 1, start, end, overflowEnd };
  });
}

export function getActiveSprint(
  schedule: SprintScheduleEntry[],
  referenceDate = new Date()
) {
  if (schedule.length === 0) {
    const fallback = buildSprintSchedule({ referenceDate, totalSprints: 1 });
    return fallback[0];
  }

  return (
    schedule.find(
      (sprint) =>
        referenceDate >= sprint.start && referenceDate <= sprint.overflowEnd
    ) ?? schedule[schedule.length - 1]
  );
}

export function resolveTaskSprintIndex(task: Task) {
  if (typeof task.sprintIndex === "number" && !Number.isNaN(task.sprintIndex)) {
    return Math.max(1, Math.floor(task.sprintIndex));
  }

  const sprintTag = task.tags?.find((tag) => /tag-week\d+/i.test(tag));
  if (sprintTag) {
    const match = sprintTag.match(/tag-week(\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return 1;
}

const resolveWindowForTask = (
  task: Task,
  schedule: SprintScheduleEntry[]
): SprintScheduleEntry => {
  const sprintIndex = resolveTaskSprintIndex(task);
  return (
    schedule.find((entry) => entry.index === sprintIndex) ??
    schedule[schedule.length - 1]
  );
};

export function ensureSprintDates(
  tasks: Task[],
  schedule: SprintScheduleEntry[]
) {
  let changed = false;

  const normalized = tasks.map((task) => {
    const sprintWindow = resolveWindowForTask(task, schedule);
    const nextTask: Task = {
      ...task,
      sprintIndex: resolveTaskSprintIndex(task),
      dueDate: sprintWindow.end.toISOString(),
      overflowDate: sprintWindow.overflowEnd.toISOString(),
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    };

    if (
      task.dueDate !== nextTask.dueDate ||
      task.overflowDate !== nextTask.overflowDate ||
      task.subtasks !== nextTask.subtasks ||
      task.sprintIndex !== nextTask.sprintIndex
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
