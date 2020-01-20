import { describe, it, expect } from 'vitest';
import { firstValueFrom, Subject, of, throwError, defer } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { reducer, initialState, TasksState } from '../src/app/state/tasks.reducer';
import { LoadSuccess, UpdateStatus, SyncSuccess, SyncConflict, SetFilter } from '../src/app/state/tasks.actions';
import { visibleTasks, shiftProgress, byAisle, pendingCount } from '../src/app/state/tasks.selectors';
import { drainOutbox, HttpError, syncOnReconnect } from '../src/app/core/outbox-sync';
import { StoreTask, PendingMutation } from '../src/app/state/models';

const NOW = 1_540_000_000_000;
const task = (id: string, extra: Partial<StoreTask> = {}): StoreTask => ({
  id, kind: 'replenish', title: `Task ${id}`, aisle: '5', priority: 2, assignee: 'eg', status: 'open', dueAt: NOW + 3600e3, version: 1, ...extra,
});
const loaded = (tasks: StoreTask[]): TasksState => reducer(initialState, new LoadSuccess({ tasks, at: NOW }));
const upd = (id: string, status: any, mutationId: string) => new UpdateStatus({ id, status, by: 'eg', at: NOW, mutationId });

describe('reducer', () => {
  it('applies updates optimistically and queues them', () => {
    const s = reducer(loaded([task('a')]), upd('a', 'in_progress', 'm1'));
    expect(s.entities.a.status).toBe('in_progress');
    expect(s.outbox).toEqual([expect.objectContaining({ mutationId: 'm1', taskId: 'a', baseVersion: 1 })]);
  });

  it('collapses repeated edits to one outbox entry', () => {
    let s = reducer(loaded([task('a')]), upd('a', 'in_progress', 'm1'));
    s = reducer(s, upd('a', 'done', 'm2'));
    expect(s.outbox).toHaveLength(1);
    expect(s.outbox[0]).toMatchObject({ mutationId: 'm2', status: 'done', baseVersion: 1 });
  });

  it('replays pending edits over a fresh server snapshot', () => {
    let s = reducer(loaded([task('a')]), upd('a', 'done', 'm1'));
    s = reducer(s, new LoadSuccess({ tasks: [task('a', { version: 1 }), task('b')], at: NOW + 1 }));
    expect(s.entities.a.status).toBe('done');
    expect(s.ids).toEqual(['a', 'b']);
  });

  it('sync success clears the entry; conflict takes the server copy and records it', () => {
    let s = reducer(loaded([task('a'), task('b')]), upd('a', 'done', 'm1'));
    s = reducer(s, upd('b', 'done', 'm2'));
    s = reducer(s, new SyncSuccess({ mutationId: 'm1', task: task('a', { status: 'done', version: 2 }) }));
    expect(pendingCount(s)).toBe(1);
    s = reducer(s, new SyncConflict({ mutationId: 'm2', task: task('b', { assignee: 'kim', version: 3 }), reason: 'reassigned' }));
    expect(s.outbox).toEqual([]);
    expect(s.entities.b.assignee).toBe('kim');
    expect(s.conflicts).toEqual([{ taskId: 'b', reason: 'reassigned' }]);
  });
});

describe('selectors', () => {
  const tasks = [
    task('late', { dueAt: NOW - 1, priority: 3, aisle: '12' }),
    task('p1', { priority: 1, aisle: '3' }),
    task('p2', { aisle: '10' }),
    task('done', { status: 'done' }),
    task('other', { assignee: 'kim' }),
    task('free', { assignee: null }),
  ];

  it('mine: overdue first, then priority; excludes done and others', () => {
    expect(visibleTasks(loaded(tasks), 'eg', NOW).map(t => t.id)).toEqual(['late', 'p1', 'p2']);
  });

  it('open includes unassigned', () => {
    const s = reducer(loaded(tasks), new SetFilter({ filter: 'open' }));
    expect(visibleTasks(s, 'eg', NOW).map(t => t.id)).toContain('free');
  });

  it('shift progress and aisle grouping', () => {
    const s = loaded(tasks);
    expect(shiftProgress(s, 'eg')).toEqual({ done: 1, total: 4, mustDoRemaining: 1 });
    expect(byAisle(visibleTasks(s, 'eg', NOW)).map(g => g.aisle)).toEqual(['3', '10', '12']);
  });
});

describe('outbox sync', () => {
  const m = (id: string): PendingMutation => ({ mutationId: id, taskId: id, status: 'done', baseVersion: 1, at: NOW });

  it('drains in order and maps 409 to conflict', async () => {
    const api = {
      patchTask: (x: PendingMutation) => x.mutationId === 'b'
        ? throwError(new HttpError(409, { task: task('b', { version: 5 }), reason: 'already done' }))
        : of(task(x.taskId, { status: 'done', version: 2 })),
    };
    const out = await firstValueFrom(drainOutbox([m('a'), m('b'), m('c')], api).pipe(toArray()));
    expect(out.map(r => `${r.mutationId}:${r.kind}`)).toEqual(['a:ok', 'b:conflict', 'c:ok']);
  });

  it('retries 5xx then defers and stops so later edits do not overtake', async () => {
    let calls = 0;
    const api = {
      patchTask: (x: PendingMutation) => defer(() => {
        if (x.mutationId === 'a') { calls++; return throwError(new HttpError(503)); }
        return of(task(x.taskId));
      }),
    };
    const out = await firstValueFrom(drainOutbox([m('a'), m('b')], api, { retries: 2, baseDelayMs: 1 }).pipe(toArray()));
    expect(calls).toBe(3);
    expect(out).toEqual([{ kind: 'deferred', mutationId: 'a' }]);
  });

  it('4xx other than 409 is not retried', async () => {
    let calls = 0;
    const api = { patchTask: () => defer(() => { calls++; return throwError(new HttpError(400)); }) };
    await firstValueFrom(drainOutbox([m('a')], api, { baseDelayMs: 1 }).pipe(toArray()));
    expect(calls).toBe(1);
  });

  it('syncs when connectivity returns', async () => {
    const online$ = new Subject<boolean>();
    const seen: string[] = [];
    syncOnReconnect(online$, () => [m('a')], { patchTask: () => of(task('a')) }).subscribe(r => seen.push(r.kind));
    online$.next(false);
    expect(seen).toEqual([]);
    online$.next(true);
    expect(seen).toEqual(['ok']);
  });
});
