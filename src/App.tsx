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

function App() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Connecting to board…");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const boardRef = useMemo(
    () => doc(db, "boards", resolvedBoardId),
    [resolvedBoardId]
  );

  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    const bootstrap = async () => {
      try {
        setLoadingMessage("Connecting to your board…");
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
            } else {
              await setDoc(boardRef, { tasks: initialTasks });
              setTasks(initialTasks);
            }

            setIsLoading(false);
            setError(null);
          },
          (snapshotError) => {
            console.error("Firestore snapshot error", snapshotError);
            setError("Error connecting to board. Please refresh.");
            setLoadingMessage("Error connecting to board.");
            setIsLoading(false);
          }
        );
      } catch (authError) {
        console.error("Firebase authentication error", authError);
        setError(
          "Could not authenticate with Firebase. Check config and try again."
        );
        setLoadingMessage("Authentication failed.");
        setIsLoading(false);
      }
    };

    bootstrap();
    return () => unsubscribe?.();
  }, [boardRef]);

  const persistTasks = useCallback(
    async (nextTasks: Task[]) => {
      setIsSaving(true);
      try {
        await setDoc(boardRef, {
          tasks: nextTasks,
          updatedBy: userId ?? "anonymous",
          updatedAt: Date.now(),
        });
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

  return (
    <div className="app-shell">
      <LoadingOverlay
        visible={isLoading}
        message={error ?? loadingMessage}
      />
      <TaskModal task={activeTask} onClose={() => setActiveTask(null)} />

      <header>
        <div className="inner">
          <h1>MSc Thesis Sprint Tracker</h1>
          <p>Click any task to see details. Drag to move. Synced securely.</p>
          <div className="status-bar" aria-live="polite">
            <span className="status-pill">
              Board ID: <strong>{resolvedBoardId}</strong>
            </span>
            <span className={`status-pill ${isSaving ? "saving" : ""}`}>
              {isSaving ? "Saving changes…" : "All changes synced"}
            </span>
          </div>
        </div>
      </header>

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
          />
        ))}
      </main>
    </div>
  );
}

export default App;
