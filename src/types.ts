export type ColumnId = "todo" | "inprogress" | "done";

export type TaskType = "task-phase" | "task-micro" | "task-sprint";

export interface Task {
  id: string;
  title: string;
  desc: string;
  type: TaskType;
  tags: string[];
  column: ColumnId;
}

export interface ColumnConfig {
  id: ColumnId;
  title: string;
}

export interface BoardDocument {
  tasks: Task[];
  updatedAt?: number;
  updatedBy?: string;
}
