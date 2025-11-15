import DOMPurify from "dompurify";
import type { Task } from "../types";

interface TaskModalProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskModal({ task, onClose }: TaskModalProps) {
  if (!task) return null;

  const safeHtml = DOMPurify.sanitize(task.desc, { USE_PROFILES: { html: true } });

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close task">
          ×
        </button>
        <h2 className="modal-title">{task.title}</h2>
        <div
          className="modal-body"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </div>
    </div>
  );
}
