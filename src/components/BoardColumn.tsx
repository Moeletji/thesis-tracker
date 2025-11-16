import { useState } from "react";

import type { ColumnId, Task } from "../types";
import { previewText } from "../utils/text";
import { describeTaskDeadline } from "../utils/sprint";

const columnOrder: ColumnId[] = ["todo", "inprogress", "done"];

interface BoardColumnProps {
  columnId: ColumnId;
  title: string;
  count: number;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDropTask: (columnId: ColumnId) => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onMoveTask: (taskId: string, direction: "back" | "forward") => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

export function BoardColumn({
  columnId,
  title,
  count,
  tasks,
  onTaskClick,
  onDropTask,
  onDragStart,
  onDragEnd,
  onMoveTask,
  onAddSubtask,
  onToggleSubtask,
}: BoardColumnProps) {
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>(
    {}
  );

  const handleDraftChange = (taskId: string, value: string) => {
    setSubtaskDrafts((prev) => ({ ...prev, [taskId]: value }));
  };

  const handleDraftSubmit = (taskId: string) => {
    const value = subtaskDrafts[taskId]?.trim();
    if (!value) return;
    onAddSubtask(taskId, value);
    setSubtaskDrafts((prev) => ({ ...prev, [taskId]: "" }));
  };

  return (
    <section
      className="kanban-column"
      data-column-id={columnId}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropTask(columnId);
      }}
    >
      <header>
        <h2>
          {title}
          <span>{count}</span>
        </h2>
      </header>
      <ul className="kanban-tasks">
        {tasks.map((task) => {
          const currentIndex = columnOrder.indexOf(task.column);
          const canMoveBack = currentIndex > 0;
          const canMoveForward = currentIndex < columnOrder.length - 1;
          const deadlineDetails = describeTaskDeadline(task);
          const subtasks = task.subtasks ?? [];
          const completedSubtasks = subtasks.filter((sub) => sub.done).length;
          const allSubtasksComplete =
            subtasks.length > 0 && completedSubtasks === subtasks.length;
          const subtaskDraft = subtaskDrafts[task.id] ?? "";

          return (
            <li
              key={task.id}
              id={task.id}
              className={`kanban-task ${task.type}`}
              draggable
              onDragStart={() => onDragStart(task.id)}
              onDragEnd={onDragEnd}
              onClick={() => onTaskClick(task)}
            >
              <p className="task-title">{task.title}</p>
              <p className="desc-preview">{previewText(task.desc)}</p>
              <div className="tags">
                {task.tags.map((tag) => (
                  <span key={tag} className={`tag ${tag}`}>
                    {tag.split("-")[1]?.toUpperCase() ?? tag}
                  </span>
                ))}
              </div>
              <div className="task-deadline">
                <span className={`deadline-pill ${deadlineDetails.status}`}>
                  {deadlineDetails.label}
                </span>
                <span className="sprint-label">
                  Sprint ends{" "}
                  {task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString("en", {
                        month: "short",
                        day: "numeric",
                      })
                    : "TBD"}
                </span>
              </div>
              {subtasks.length > 0 && (
                <div className="task-subtasks-progress">
                  <div className="subtask-progress-bar">
                    <div
                      className="subtask-progress-value"
                      style={{
                        width: `${
                          subtasks.length === 0
                            ? 0
                            : Math.round(
                                (completedSubtasks / subtasks.length) * 100
                              )
                        }%`,
                      }}
                    />
                  </div>
                  <span>
                    {completedSubtasks}/{subtasks.length} subtasks
                  </span>
                </div>
              )}
              <ul
                className="task-inline-subtasks"
                onClick={(event) => event.stopPropagation()}
              >
                {subtasks.map((subtask) => (
                  <li key={subtask.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={subtask.done}
                        onChange={() => onToggleSubtask(task.id, subtask.id)}
                      />
                      <span className={subtask.done ? "done" : ""}>
                        {subtask.title}
                      </span>
                    </label>
                  </li>
                ))}
                <li>
                  <form
                    className="inline-subtask-add"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleDraftSubmit(task.id);
                    }}
                  >
                    <input
                      value={subtaskDraft}
                      onChange={(event) =>
                        handleDraftChange(task.id, event.target.value)
                      }
                      placeholder="Add subtask..."
                    />
                    <button type="submit" disabled={!subtaskDraft.trim()}>
                      Add
                    </button>
                  </form>
                </li>
              </ul>
              <div className="task-actions">
                <button
                  className="task-action"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveTask(task.id, "back");
                  }}
                  disabled={!canMoveBack}
                >
                  ← Back
                </button>
                <button
                  className="task-action"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveTask(task.id, "forward");
                  }}
                  disabled={!canMoveForward}
                >
                  Forward →
                </button>
                <button
                  className="task-action solid"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (allSubtasksComplete && task.column !== "done") {
                      onMoveTask(task.id, "forward");
                    }
                  }}
                  disabled={!allSubtasksComplete || task.column === "done"}
                  title="Auto-progress to Done when every subtask is complete."
                >
                  Mark Done
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
