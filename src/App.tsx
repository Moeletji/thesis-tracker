import { useCallback, useEffect, useMemo, useState } from "react";
import { signInAnonymously } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";

import { BoardColumn } from "./components/BoardColumn";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { TaskModal } from "./components/TaskModal";
import { initialTasks } from "./data/initialTasks";
import { auth, db } from "./lib/firebase";
import type { ColumnConfig, ColumnId, Task } from "./types";
import {
  buildSprintSchedule,
  ensureSprintDates,
  formatDateRange,
  getActiveSprint,
  getNextReminderDate,
  getOutstandingTasks,
  longDateFormatter,
  daysUntil,
  resolveTaskSprintIndex,
} from "./utils/sprint";

const resolvedBoardId =
  import.meta.env.VITE_FIREBASE_BOARD_ID?.trim() || "shared-board";

const columnConfig: ColumnConfig[] = [
  { id: "todo", title: "To Do" },
  { id: "inprogress", title: "In Progress" },
  { id: "done", title: "Done" },
];
const columnOrder: ColumnId[] = ["todo", "inprogress", "done"];
const seededSprintCount = Math.max(
  1,
  ...initialTasks.map((task) => resolveTaskSprintIndex(task))
);

const reminderEmail =
  import.meta.env.VITE_NOTIFICATION_EMAIL?.trim() || null;

const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

type ConnectionState = "connecting" | "online" | "error";

interface ReminderTaskSummary {
  id: string;
  title: string;
  column: ColumnId;
  dueDate?: string;
  overflowDate?: string;
}

interface ReminderSnapshot {
  generatedAt: number;
  sprintIndex?: number;
  sprintStart: string;
  sprintEnd: string;
  overflowEnd: string;
  outstandingCount: number;
  outstandingTasks: ReminderTaskSummary[];
}

interface ReminderDocument {
  lastNotifiedAt?: number;
  email?: string;
  snapshot?: ReminderSnapshot;
}

function App() {
  const sprintSchedule = useMemo(
    () => buildSprintSchedule({ totalSprints: seededSprintCount }),
    []
  );
  const activeSprint = useMemo(
    () => getActiveSprint(sprintSchedule),
    [sprintSchedule]
  );
  const [tasks, setTasks] = useState<Task[]>(() =>
    ensureSprintDates(initialTasks, sprintSchedule).tasks
  );
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Connecting to board…");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [reminderLog, setReminderLog] = useState<{
    lastNotifiedAt: number | null;
    email: string | null;
  }>({
    lastNotifiedAt: null,
    email: reminderEmail,
  });
  const [reminderSnapshot, setReminderSnapshot] =
    useState<ReminderSnapshot | null>(null);

  const boardRef = useMemo(
    () => doc(db, "boards", resolvedBoardId),
    [resolvedBoardId]
  );
  const reminderRef = useMemo(
    () => doc(db, "reminders", resolvedBoardId),
    [resolvedBoardId]
  );

  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    const bootstrap = async () => {
      try {
        setConnectionState("connecting");
        setLoadingMessage("Connecting to your board...");
        const user =
          auth.currentUser ?? (await signInAnonymously(auth)).user;
        setUserId(user.uid);

        unsubscribe = onSnapshot(
          boardRef,
          async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              const sourceTasks = Array.isArray(data.tasks)
                ? (data.tasks as Task[])
                : initialTasks;
              const { tasks: normalized, changed } = ensureSprintDates(
                sourceTasks,
                sprintSchedule
              );
              setTasks(normalized);
              if (changed) {
                await setDoc(
                  boardRef,
                  {
                    tasks: normalized,
                    updatedBy: user.uid,
                    updatedAt: Date.now(),
                  },
                  { merge: true }
                );
              }
              if (typeof data.updatedAt === "number") {
                setLastUpdated(data.updatedAt);
              }
            } else {
              const { tasks: seeded } = ensureSprintDates(
                initialTasks,
                sprintSchedule
              );
              const timestamp = Date.now();
              await setDoc(boardRef, {
                tasks: seeded,
                updatedBy: user.uid,
                updatedAt: timestamp,
              });
              setTasks(seeded);
              setLastUpdated(timestamp);
            }

            setIsLoading(false);
            setError(null);
            setConnectionState("online");
          },
          (snapshotError) => {
            console.error("Firestore snapshot error", snapshotError);
            setError("Error connecting to board. Please refresh.");
            setLoadingMessage("Error connecting to board.");
            setIsLoading(false);
            setConnectionState("error");
          }
        );
      } catch (authError) {
        console.error("Firebase authentication error", authError);
        setError(
          "Could not authenticate with Firebase. Check config and try again."
        );
        setLoadingMessage("Authentication failed.");
        setIsLoading(false);
        setConnectionState("error");
      }
    };

    bootstrap();
    return () => unsubscribe?.();
  }, [boardRef, sprintSchedule]);

  const syncReminderSnapshot = useCallback(
    async (tasksToSync: Task[], timestamp: number) => {
      if (!activeSprint) return;
      const outstanding = tasksToSync.filter((task) => task.column !== "done");
      const snapshotPayload: ReminderSnapshot = {
        generatedAt: timestamp,
        sprintIndex: activeSprint.index,
        sprintStart: activeSprint.start.toISOString(),
        sprintEnd: activeSprint.end.toISOString(),
        overflowEnd: activeSprint.overflowEnd.toISOString(),
        outstandingCount: outstanding.length,
        outstandingTasks: outstanding.map((task) => ({
          id: task.id,
          title: task.title,
          column: task.column,
          dueDate: task.dueDate,
          overflowDate: task.overflowDate,
        })),
      };

      await setDoc(
        reminderRef,
        {
          snapshot: snapshotPayload,
          email: reminderEmail,
        },
        { merge: true }
      );
      setReminderSnapshot(snapshotPayload);
    },
    [activeSprint, reminderEmail, reminderRef]
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(
      reminderRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as ReminderDocument;
          setReminderLog({
            lastNotifiedAt:
              typeof data.lastNotifiedAt === "number"
                ? data.lastNotifiedAt
                : null,
            email: data.email ?? reminderEmail,
          });
          setReminderSnapshot(data.snapshot ?? null);
        } else {
          setReminderLog((prev) => ({
            ...prev,
            email: reminderEmail ?? prev.email,
          }));
          setReminderSnapshot(null);
        }
      },
      (reminderError) => {
        console.error("Reminder document subscription error", reminderError);
      }
    );

    return () => unsubscribe();
  }, [reminderRef, reminderEmail]);

  useEffect(() => {
    if (isLoading) return;
    if (tasks.length === 0) return;
    if (reminderSnapshot) return;
    const timestamp = Date.now();
    void syncReminderSnapshot(tasks, timestamp);
  }, [activeSprint, isLoading, reminderSnapshot, syncReminderSnapshot, tasks]);

  const persistTasks = useCallback(
    async (nextTasks: Task[]) => {
      setIsSaving(true);
      try {
        const timestamp = Date.now();
        const { tasks: normalized } = ensureSprintDates(
          nextTasks,
          sprintSchedule
        );
        await setDoc(boardRef, {
          tasks: normalized,
          updatedBy: userId ?? "anonymous",
          updatedAt: timestamp,
        });
        setLastUpdated(timestamp);
        await syncReminderSnapshot(normalized, timestamp);
      } catch (saveError) {
        console.error("Failed to write board", saveError);
        setError(
          "Unable to sync changes. We'll retry automatically when possible."
        );
      } finally {
        setIsSaving(false);
      }
    },
    [boardRef, sprintSchedule, syncReminderSnapshot, userId]
  );

  const outstandingTasks = useMemo(
    () => getOutstandingTasks(tasks),
    [tasks]
  );
  const outstandingSprintTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.type === "task-sprint" &&
          task.column !== "done" &&
          resolveTaskSprintIndex(task) === activeSprint.index
      ),
    [activeSprint.index, tasks]
  );

  const handleAddSubtask = useCallback(
    (taskId: string, title: string) => {
      setTasks((prev) => {
        const next = prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                subtasks: [
                  ...(task.subtasks ?? []),
                  { id: generateId(), title, done: false },
                ],
              }
            : task
        );
        void persistTasks(next);
        return next;
      });
    },
    [persistTasks]
  );

  const handleToggleSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
      setTasks((prev) => {
        const next = prev.map((task) => {
          if (task.id !== taskId) return task;
          const nextSubtasks = (task.subtasks ?? []).map((subtask) =>
            subtask.id === subtaskId
              ? { ...subtask, done: !subtask.done }
              : subtask
          );
          const allComplete =
            nextSubtasks.length > 0 &&
            nextSubtasks.every((subtask) => subtask.done);
          const nextColumn =
            allComplete && task.column === "inprogress"
              ? "done"
              : task.column;
          return { ...task, subtasks: nextSubtasks, column: nextColumn };
        });
        void persistTasks(next);
        return next;
      });
    },
    [persistTasks]
  );

  const handleDrop = useCallback(
    (columnId: ColumnId) => {
      if (!draggingTaskId) return;
      setTasks((prev) => {
        const next = prev.map((task) =>
          task.id === draggingTaskId ? { ...task, column: columnId } : task
        );
        void persistTasks(next);
        return next;
      });
      setDraggingTaskId(null);
    },
    [draggingTaskId, persistTasks]
  );

  const groupedTasks = useMemo(() => {
    return columnConfig.reduce<Record<ColumnId, Task[]>>(
      (acc, column) => ({
        ...acc,
        [column.id]: tasks.filter((task) => task.column === column.id),
      }),
      { todo: [], inprogress: [], done: [] }
    );
  }, [tasks]);

  const moveTask = useCallback(
    (taskId: string, direction: "back" | "forward" | ColumnId) => {
      setTasks((prev) => {
        const targetTasks = [...prev];
        const idx = targetTasks.findIndex((task) => task.id === taskId);
        if (idx === -1) return prev;
        const currentColumn = targetTasks[idx].column;
        let nextColumn: ColumnId = currentColumn;
        if (direction === "back" || direction === "forward") {
          const currentIndex = columnOrder.indexOf(currentColumn);
          const offset = direction === "back" ? -1 : 1;
          const newIndex = currentIndex + offset;
          if (columnOrder[newIndex]) {
            nextColumn = columnOrder[newIndex];
          }
        } else {
          nextColumn = direction;
        }
        if (nextColumn === currentColumn) {
          return prev;
        }
        targetTasks[idx] = { ...targetTasks[idx], column: nextColumn };
        void persistTasks(targetTasks);
        return targetTasks;
      });
    },
    [persistTasks]
  );

  const columnCounts = useMemo(
    () => ({
      todo: groupedTasks.todo.length,
      inprogress: groupedTasks.inprogress.length,
      done: groupedTasks.done.length,
    }),
    [groupedTasks]
  );

  const totalTasks = tasks.length;
  const completionPercent =
    totalTasks > 0 ? Math.round((columnCounts.done / totalTasks) * 100) : 0;
  const now = new Date();
  const daysRemaining = daysUntil(activeSprint.end, now);
  const overflowDaysRemaining = daysUntil(activeSprint.overflowEnd, now);
  const isOverflowActive = now.getTime() > activeSprint.end.getTime();
  const sprintRangeLabel = formatDateRange(
    activeSprint.start,
    activeSprint.end
  );
  const overflowLabel = longDateFormatter.format(activeSprint.overflowEnd);
  const nextReminderDate = useMemo(() => getNextReminderDate(), []);
  const nextReminderLabel = longDateFormatter.format(nextReminderDate);
  const lastReminderLabel = reminderLog.lastNotifiedAt
    ? longDateFormatter.format(new Date(reminderLog.lastNotifiedAt))
    : "None yet";
  const reminderEmailDisplay =
    reminderLog.email ?? reminderEmail ?? "Not configured";
  const reminderSnapshotLabel = reminderSnapshot?.generatedAt
    ? longDateFormatter.format(new Date(reminderSnapshot.generatedAt))
    : "Awaiting snapshot";
  const reminderSnapshotCount =
    reminderSnapshot?.outstandingCount ?? outstandingSprintTasks.length;
  const lastUpdatedLabel = lastUpdated
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(lastUpdated)
    : "Awaiting first sync";

  const summaryCards = [
    {
      label: "Backlog",
      value: columnCounts.todo,
      hint: "Awaiting kickoff",
    },
    {
      label: "In Flight",
      value: columnCounts.inprogress,
      hint: "Actively being executed",
    },
    {
      label: "Done",
      value: columnCounts.done,
      hint: "Validated steps",
    },
    {
      label: "Velocity",
      value: `${completionPercent}%`,
      hint: "Board completion",
    },
  ];

  const connectionLabel =
    connectionState === "online"
      ? "Live"
      : connectionState === "error"
      ? "Offline"
      : "Connecting";

  return (
    <div className="app-shell">
      <LoadingOverlay
        visible={isLoading}
        message={error ?? loadingMessage}
      />
      <TaskModal
        task={activeTask}
        onClose={() => setActiveTask(null)}
        onAddSubtask={handleAddSubtask}
        onToggleSubtask={handleToggleSubtask}
      />

      <section className="board-hero">
        <div className="board-header">
          <div>
            <p className="eyebrow">MSc Thesis Program</p>
            <h1>Thesis Sprint Command Center</h1>
            <p className="subtitle">
              Operate with confidence. Each move syncs across every device in
              real time.
            </p>
          </div>
          <div className="board-badges" aria-live="polite">
            <span className={`connection-pill ${connectionState}`}>
              <span className="dot" /> {connectionLabel}
            </span>
            <span className={`connection-pill ${isSaving ? "saving" : ""}`}>
              {isSaving ? "Syncing changes…" : "All changes saved"}
            </span>
          </div>
        </div>

        <div className="board-meta">
          <div>
            <p className="label">Board ID</p>
            <p className="value">{resolvedBoardId}</p>
          </div>
          <div>
            <p className="label">Last Sync</p>
            <p className="value">{lastUpdatedLabel}</p>
          </div>
          <div className="progress-tile">
            <p className="label">Completion</p>
            <div className="progress-meter">
              <div
                className="progress-value"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="value">{completionPercent}%</p>
          </div>
        </div>

        <div className="sprint-ops-grid">
          <article className="sprint-card">
            <p className="label">Sprint Window</p>
            <p className="value">{sprintRangeLabel}</p>
            <p className="hint">
              {isOverflowActive
                ? `Overflow active · ${overflowDaysRemaining}d left`
                : `${daysRemaining}d until lock`}
            </p>
            <p className="meta">Overflow ends {overflowLabel}</p>
          </article>
          <article className="sprint-card">
            <p className="label">Outstanding Sprint Work</p>
            <p className="value">{outstandingSprintTasks.length}</p>
            <p className="hint">
              {outstandingTasks.length} open tasks across the board
            </p>
            <p className="meta">
              Sprint {activeSprint.index} · Ends{" "}
              {longDateFormatter.format(activeSprint.end)}
            </p>
          </article>
          <article className="sprint-card reminder">
            <p className="label">Friday Reminder</p>
            <p className="value">{reminderEmailDisplay}</p>
            <p className="hint">
              Next: {nextReminderLabel} · Last: {lastReminderLabel}
            </p>
            <p className="meta">
              Snapshot: Sprint{" "}
              {reminderSnapshot?.sprintIndex ?? activeSprint.index} ·{" "}
              {reminderSnapshotLabel} · {reminderSnapshotCount} open tasks
              queued
            </p>
            <p className="meta">
              GitHub Actions sends the digest every Friday at 09:00 based on the
              latest Firestore snapshot.
            </p>
            {!reminderLog.email && !reminderEmail && (
              <p className="meta warning-text">
                Set VITE_NOTIFICATION_EMAIL to enable email alerts.
              </p>
            )}
          </article>
        </div>

        <div className="stat-grid">
          {summaryCards.map((stat) => (
            <article key={stat.label} className="stat-card">
              <p className="stat-label">{stat.label}</p>
              <p className="stat-value">{stat.value}</p>
              <p className="stat-hint">{stat.hint}</p>
            </article>
          ))}
        </div>
      </section>

      {error && !isLoading && <div className="banner error">{error}</div>}

      <main className="kanban-board">
        {columnConfig.map((column) => (
          <BoardColumn
            key={column.id}
            columnId={column.id}
            title={column.title}
            tasks={groupedTasks[column.id]}
            count={groupedTasks[column.id].length}
            onTaskClick={setActiveTask}
            onDropTask={handleDrop}
            onDragStart={(taskId) => setDraggingTaskId(taskId)}
            onDragEnd={() => setDraggingTaskId(null)}
            onMoveTask={moveTask}
            onAddSubtask={handleAddSubtask}
            onToggleSubtask={handleToggleSubtask}
          />
        ))}
      </main>
    </div>
  );
}

export default App;
