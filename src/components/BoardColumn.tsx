import type { ColumnId, Task } from "../types";
import { previewText } from "../utils/text";

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
}: BoardColumnProps) {
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
