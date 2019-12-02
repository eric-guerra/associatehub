import { TasksState } from './tasks.reducer';
import { StoreTask } from './models';

// Kept framework-free (plain functions over state) so they're unit-testable without TestBed;
// the components wrap them with `createSelector` in app.state.ts.

export function visibleTasks(state: TasksState, me: string, now: number): StoreTask[] {
  const all = state.ids.map(id => state.entities[id]);
  const filtered = all.filter(t => {
    if (state.filter === 'mine') return t.assignee === me && t.status !== 'done';
    if (state.filter === 'open') return t.status !== 'done' && (t.assignee === null || t.assignee === me);
    return true;
  });
  return filtered.sort((a, b) => rank(a, now) - rank(b, now) || a.aisle.localeCompare(b.aisle, undefined, { numeric: true }));
}

/** Overdue first, then priority, then due time. Done sinks to the bottom. */
function rank(t: StoreTask, now: number): number {
  if (t.status === 'done') return 1e15;
  const overdue = t.dueAt < now ? 0 : 1;
  return overdue * 1e14 + t.priority * 1e13 + t.dueAt;
}

export function pendingCount(state: TasksState): number {
  return state.outbox.length;
}

export function isPending(state: TasksState, taskId: string): boolean {
  return state.outbox.some(m => m.taskId === taskId);
}

export function shiftProgress(state: TasksState, me: string) {
  const mine = state.ids.map(id => state.entities[id]).filter(t => t.assignee === me);
  const done = mine.filter(t => t.status === 'done').length;
  const mustDo = mine.filter(t => t.priority === 1 && t.status !== 'done').length;
  return { done, total: mine.length, mustDoRemaining: mustDo };
}

/** Group by aisle for the walk-the-store view. */
export function byAisle(tasks: StoreTask[]): { aisle: string; tasks: StoreTask[] }[] {
  const map = new Map<string, StoreTask[]>();
  for (const t of tasks) {
    if (!map.has(t.aisle)) map.set(t.aisle, []);
    map.get(t.aisle)!.push(t);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([aisle, ts]) => ({ aisle, tasks: ts }));
}
