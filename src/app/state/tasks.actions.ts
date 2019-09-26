import { Action } from '@ngrx/store';
import { StoreTask, TaskStatus } from './models';

export enum TaskActionTypes {
  Load = '[Tasks] Load',
  LoadSuccess = '[Tasks API] Load Success',
  LoadFailure = '[Tasks API] Load Failure',
  UpdateStatus = '[Tasks] Update Status',
  SyncSuccess = '[Outbox] Sync Success',
  SyncConflict = '[Outbox] Sync Conflict',
  ConnectivityChanged = '[App] Connectivity Changed',
  SetFilter = '[Tasks] Set Filter',
}

export class Load implements Action {
  readonly type = TaskActionTypes.Load;
}
export class LoadSuccess implements Action {
  readonly type = TaskActionTypes.LoadSuccess;
  constructor(public payload: { tasks: StoreTask[]; at: number }) {}
}
export class LoadFailure implements Action {
  readonly type = TaskActionTypes.LoadFailure;
  constructor(public payload: { error: string }) {}
}
/** Optimistic: applied locally right away, queued in the outbox for the server. */
export class UpdateStatus implements Action {
  readonly type = TaskActionTypes.UpdateStatus;
  constructor(public payload: { id: string; status: TaskStatus; note?: string; by: string; at: number; mutationId: string }) {}
}
export class SyncSuccess implements Action {
  readonly type = TaskActionTypes.SyncSuccess;
  constructor(public payload: { mutationId: string; task: StoreTask }) {}
}
/** Server rejected the change (task reassigned / already done). Server copy wins. */
export class SyncConflict implements Action {
  readonly type = TaskActionTypes.SyncConflict;
  constructor(public payload: { mutationId: string; task: StoreTask; reason: string }) {}
}
export class ConnectivityChanged implements Action {
  readonly type = TaskActionTypes.ConnectivityChanged;
  constructor(public payload: { online: boolean }) {}
}
export class SetFilter implements Action {
  readonly type = TaskActionTypes.SetFilter;
  constructor(public payload: { filter: 'mine' | 'open' | 'all' }) {}
}

export type TaskActions =
  | Load | LoadSuccess | LoadFailure | UpdateStatus | SyncSuccess | SyncConflict | ConnectivityChanged | SetFilter;
