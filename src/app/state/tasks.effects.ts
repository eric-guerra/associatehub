import { Injectable } from '@angular/core';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { Store, select } from '@ngrx/store';
import { fromEvent, merge, of, Observable } from 'rxjs';
import { catchError, map, mapTo, startWith, switchMap, withLatestFrom, filter } from 'rxjs/operators';
import { TasksApi } from '../core/tasks-api.service';
import { drainOutbox, SyncResult } from '../core/outbox-sync';
import { AppState } from './app.state';
import {
  TaskActionTypes, Load, LoadSuccess, LoadFailure, UpdateStatus, SyncSuccess, SyncConflict, ConnectivityChanged,
} from './tasks.actions';

@Injectable()
export class TaskEffects {
  constructor(private actions$: Actions, private api: TasksApi, private store: Store<AppState>) {}

  @Effect()
  load$ = this.actions$.pipe(
    ofType<Load>(TaskActionTypes.Load),
    switchMap(() => this.api.list().pipe(
      map(tasks => new LoadSuccess({ tasks, at: Date.now() })),
      catchError(e => of(new LoadFailure({ error: e.message }))),
    )),
  );

  @Effect()
  connectivity$: Observable<ConnectivityChanged> = merge(
    fromEvent(window, 'online').pipe(mapTo(true)),
    fromEvent(window, 'offline').pipe(mapTo(false)),
  ).pipe(startWith(navigator.onLine), map(online => new ConnectivityChanged({ online })));

  /** Push the outbox after each local edit (if online) and whenever we come back online. */
  @Effect()
  sync$ = this.actions$.pipe(
    ofType<UpdateStatus | ConnectivityChanged>(TaskActionTypes.UpdateStatus, TaskActionTypes.ConnectivityChanged),
    withLatestFrom(this.store.pipe(select(s => s.tasks))),
    filter(([, s]) => s.online && s.outbox.length > 0),
    switchMap(([, s]) => drainOutbox(s.outbox, this.api)),
    filter((r: SyncResult) => r.kind !== 'deferred'),
    map((r: any) => r.kind === 'ok'
      ? new SyncSuccess({ mutationId: r.mutationId, task: r.task })
      : new SyncConflict({ mutationId: r.mutationId, task: r.task, reason: r.reason })),
  );
}
