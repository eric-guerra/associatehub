import { TaskActions, TaskActionTypes } from './tasks.actions';
import { PendingMutation, StoreTask } from './models';

export interface TasksState {
  ids: string[];
  entities: { [id: string]: StoreTask };
  /** Changes made offline (or in flight), oldest first. */
  outbox: PendingMutation[];
  online: boolean;
  loading: boolean;
  lastSyncedAt: number | null;
  error: string | null;
  conflicts: { taskId: string; reason: string }[];
  filter: 'mine' | 'open' | 'all';
}

export const initialState: TasksState = {
  ids: [], entities: {}, outbox: [], online: true, loading: false,
  lastSyncedAt: null, error: null, conflicts: [], filter: 'mine',
};

export function reducer(state = initialState, action: TaskActions): TasksState {
  switch (action.type) {
    case TaskActionTypes.Load:
      return { ...state, loading: true, error: null };

    case TaskActionTypes.LoadSuccess: {
      // Server snapshot replaces local, then pending local edits are replayed on top so an
      // associate's offline work doesn't visually "undo" itself when the list refreshes.
      const entities: { [id: string]: StoreTask } = {};
      for (const t of action.payload.tasks) entities[t.id] = t;
      for (const m of state.outbox) {
        const t = entities[m.taskId];
        if (t) entities[m.taskId] = { ...t, status: m.status, note: m.note !== undefined ? m.note : t.note };
      }
      return {
        ...state, loading: false, entities,
        ids: action.payload.tasks.map(t => t.id),
        lastSyncedAt: action.payload.at,
      };
    }

    case TaskActionTypes.LoadFailure:
      return { ...state, loading: false, error: action.payload.error };

    case TaskActionTypes.UpdateStatus: {
      const p = action.payload;
      const task = state.entities[p.id];
      if (!task) return state;
      const mutation: PendingMutation = { mutationId: p.mutationId, taskId: p.id, status: p.status, note: p.note, baseVersion: task.version, at: p.at };
      // Collapse repeated taps on the same task into the latest one, keeping the original base version.
      const prior = state.outbox.find(m => m.taskId === p.id);
      const outbox = prior
        ? state.outbox.map(m => (m.taskId === p.id ? { ...mutation, baseVersion: prior.baseVersion } : m))
        : [...state.outbox, mutation];
      return {
        ...state,
        outbox,
        entities: { ...state.entities, [p.id]: { ...task, status: p.status, note: p.note !== undefined ? p.note : task.note, assignee: task.assignee || p.by } },
      };
    }

    case TaskActionTypes.SyncSuccess:
      return {
        ...state,
        outbox: state.outbox.filter(m => m.mutationId !== action.payload.mutationId),
        entities: { ...state.entities, [action.payload.task.id]: withPending(action.payload.task, state.outbox, action.payload.mutationId) },
      };

    case TaskActionTypes.SyncConflict:
      return {
        ...state,
        outbox: state.outbox.filter(m => m.mutationId !== action.payload.mutationId),
        entities: { ...state.entities, [action.payload.task.id]: action.payload.task },
        conflicts: [...state.conflicts, { taskId: action.payload.task.id, reason: action.payload.reason }],
      };

    case TaskActionTypes.ConnectivityChanged:
      return { ...state, online: action.payload.online };

    case TaskActionTypes.SetFilter:
      return { ...state, filter: action.payload.filter };

    default:
      return state;
  }
}

/** If a newer local edit was queued while this one was in flight, keep showing it. */
function withPending(task: StoreTask, outbox: PendingMutation[], ackedId: string): StoreTask {
  const newer = outbox.find(m => m.taskId === task.id && m.mutationId !== ackedId);
  return newer ? { ...task, status: newer.status } : task;
}
