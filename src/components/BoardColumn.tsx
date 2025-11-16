import { useState, type FormEvent } from "react";

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
  onAddTask: (columnId: ColumnId, title: string, desc: string) => void;
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
  onAddTask,
}: BoardColumnProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask(columnId, newTitle.trim(), newDesc.trim());
    setNewTitle("");
    setNewDesc("");
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
      <form className="new-task-card" onSubmit={handleSubmit}>
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="Quick add task..."
          aria-label={`Add task to ${title}`}
        />
        <textarea
          value={newDesc}
          onChange={(event) => setNewDesc(event.target.value)}
          placeholder="Optional description"
          rows={2}
        />
        <button type="submit">Add Task</button>
      </form>
      <ul className="kanban-tasks">
        {tasks.map((task) => {
          const currentIndex = columnOrder.indexOf(task.column);
          const canMoveBack = currentIndex > 0;
          const canMoveForward = currentIndex < columnOrder.length - 1;
          const deadlineDetails = describeTaskDeadline(task);
          const subtasks = task.subtasks ?? [];
          const completedSubtasks = subtasks.filter((sub) => sub.done).length;

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
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
