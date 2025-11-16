import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import type { Task } from "../types";
import { describeTaskDeadline, longDateFormatter } from "../utils/sprint";

interface TaskModalProps {
  task: Task | null;
  onClose: () => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

export function TaskModal({
  task,
  onClose,
  onAddSubtask,
  onToggleSubtask,
}: TaskModalProps) {
  const [newSubtask, setNewSubtask] = useState("");

  useEffect(() => {
    setNewSubtask("");
  }, [task?.id]);

  if (!task) return null;

  const safeHtml = DOMPurify.sanitize(task.desc, {
    USE_PROFILES: { html: true },
  });
  const deadlineDetails = describeTaskDeadline(task);
  const dueLabel = task.dueDate
    ? longDateFormatter.format(new Date(task.dueDate))
    : "Not assigned";
  const overflowLabel = task.overflowDate
    ? longDateFormatter.format(new Date(task.overflowDate))
    : "Not assigned";
  const subtasks = task.subtasks ?? [];
  const completed = subtasks.filter((subtask) => subtask.done).length;
  const progressLabel = useMemo(() => {
    if (subtasks.length === 0) return "No subtasks yet";
    return `${completed}/${subtasks.length} complete`;
  }, [completed, subtasks.length]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close task">
          ×
        </button>
        <h2 className="modal-title">{task.title}</h2>
        <div className="modal-deadlines">
          <div>
            <p className="label">Due</p>
            <p className="value">{dueLabel}</p>
          </div>
          <div>
            <p className="label">Overflow</p>
            <p className="value">{overflowLabel}</p>
          </div>
          <span className={`deadline-pill ${deadlineDetails.status}`}>
            {deadlineDetails.label}
          </span>
        </div>
        <div
          className="modal-body"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
        <section className="modal-subtasks">
          <header>
            <div>
              <p className="label">Subtasks</p>
              <p className="value">{progressLabel}</p>
            </div>
            <form
              className="subtask-add"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = newSubtask.trim();
                if (!trimmed) return;
                onAddSubtask(task.id, trimmed);
                setNewSubtask("");
              }}
            >
              <input
                value={newSubtask}
                onChange={(event) => setNewSubtask(event.target.value)}
                placeholder="Add subtask..."
              />
              <button type="submit">Add</button>
            </form>
          </header>
          <ul className="subtasks-list">
            {subtasks.length === 0 && (
              <li className="subtask-empty">No subtasks added yet.</li>
            )}
            {subtasks.map((subtask) => (
              <li key={subtask.id} className="subtask-item">
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
          </ul>
        </section>
      </div>
    </div>
  );
}
