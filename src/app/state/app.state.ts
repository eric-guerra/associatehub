import { ActionReducerMap, MetaReducer, createFeatureSelector, createSelector } from '@ngrx/store';
import * as fromTasks from './tasks.reducer';
import * as sel from './tasks.selectors';

export interface AppState { tasks: fromTasks.TasksState; }

export const reducers: ActionReducerMap<AppState> = { tasks: fromTasks.reducer as any };

/** Persist the outbox to localStorage so offline edits survive the PWA being killed. */
export function persistOutbox(reducer: any) {
  return (state: AppState | undefined, action: any) => {
    if (state === undefined) {
      try {
        const saved = JSON.parse(localStorage.getItem('ah.outbox') || '[]');
        state = { tasks: { ...fromTasks.initialState, outbox: saved } };
      } catch (e) { /* fall back to defaults */ }
    }
    const next = reducer(state, action);
    if (!state || next.tasks.outbox !== state.tasks.outbox) localStorage.setItem('ah.outbox', JSON.stringify(next.tasks.outbox));
    return next;
  };
}
export const metaReducers: MetaReducer<AppState>[] = [persistOutbox];

export const selectTasks = createFeatureSelector<fromTasks.TasksState>('tasks');
export const selectPendingCount = createSelector(selectTasks, sel.pendingCount);
export const selectOnline = createSelector(selectTasks, s => s.online);
export const selectVisible = (me: string, now: number) => createSelector(selectTasks, s => sel.byAisle(sel.visibleTasks(s, me, now)));
export const selectProgress = (me: string) => createSelector(selectTasks, s => sel.shiftProgress(s, me));
