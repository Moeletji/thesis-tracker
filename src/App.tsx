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

const resolvedBoardId =
  import.meta.env.VITE_FIREBASE_BOARD_ID?.trim() || "shared-board";

const columnConfig: ColumnConfig[] = [
  { id: "todo", title: "To Do" },
  { id: "inprogress", title: "In Progress" },
  { id: "done", title: "Done" },
];
const columnOrder: ColumnId[] = ["todo", "inprogress", "done"];

type ConnectionState = "connecting" | "online" | "error";

function App() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
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

  const boardRef = useMemo(
    () => doc(db, "boards", resolvedBoardId),
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
              if (Array.isArray(data.tasks)) {
                setTasks(data.tasks as Task[]);
              } else {
                await setDoc(boardRef, { tasks: initialTasks });
                setTasks(initialTasks);
              }
              if (typeof data.updatedAt === "number") {
                setLastUpdated(data.updatedAt);
              }
            } else {
              await setDoc(boardRef, { tasks: initialTasks });
              setTasks(initialTasks);
              setLastUpdated(Date.now());
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
  }, [boardRef]);

  const persistTasks = useCallback(
    async (nextTasks: Task[]) => {
      setIsSaving(true);
      try {
        const timestamp = Date.now();
        await setDoc(boardRef, {
          tasks: nextTasks,
          updatedBy: userId ?? "anonymous",
          updatedAt: timestamp,
        });
        setLastUpdated(timestamp);
      } catch (saveError) {
        console.error("Failed to write board", saveError);
        setError(
          "Unable to sync changes. We'll retry automatically when possible."
        );
      } finally {
        setIsSaving(false);
      }
    },
    [boardRef, userId]
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
      <TaskModal task={activeTask} onClose={() => setActiveTask(null)} />

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
          />
        ))}
      </main>
    </div>
  );
}

export default App;
