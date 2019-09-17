export type TaskStatus = 'open' | 'in_progress' | 'done' | 'blocked';
export type TaskKind = 'replenish' | 'price_change' | 'planogram' | 'recall' | 'cleanup';

export interface StoreTask {
  id: string;
  kind: TaskKind;
  title: string;
  aisle: string;
  priority: 1 | 2 | 3; // 1 = must finish this shift (recalls, price changes effective today)
  assignee: string | null;
  status: TaskStatus;
  dueAt: number;
  version: number;
  note?: string;
}

export interface PendingMutation {
  mutationId: string;
  taskId: string;
  status: TaskStatus;
  note?: string;
  baseVersion: number;
  at: number;
}
