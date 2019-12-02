import { Observable, from, of, timer, EMPTY, concat } from 'rxjs';
import { catchError, concatMap, map, mergeMap, retryWhen, take, filter, exhaustMap } from 'rxjs/operators';
import { PendingMutation, StoreTask } from '../state/models';

export interface SyncApi {
  patchTask(m: PendingMutation): Observable<StoreTask>;
}

export type SyncResult =
  | { kind: 'ok'; mutationId: string; task: StoreTask }
  | { kind: 'conflict'; mutationId: string; task: StoreTask; reason: string }
  | { kind: 'deferred'; mutationId: string };

export class HttpError extends Error {
  constructor(public status: number, public body?: any) { super(`HTTP ${status}`); }
}

/**
 * Drains the outbox in order, one request at a time (order matters: open → in_progress → done).
 * - 409 → conflict, the server's copy is returned in the body and wins.
 * - 5xx / network → retried with backoff, then left in the outbox ("deferred") for the next online event.
 * - Stops at the first deferred item so later edits never overtake earlier ones.
 */
export function drainOutbox(outbox: PendingMutation[], api: SyncApi, opts: { retries?: number; baseDelayMs?: number } = {}): Observable<SyncResult> {
  const retries = opts.retries != null ? opts.retries : 3;
  const base = opts.baseDelayMs != null ? opts.baseDelayMs : 1000;
  let blocked = false;

  return from(outbox).pipe(
    concatMap(m => {
      if (blocked) return EMPTY;
      return api.patchTask(m).pipe(
        retryWhen(errors => errors.pipe(
          mergeMap((e, attempt) => isRetryable(e) && attempt < retries ? timer(base * Math.pow(2, attempt)) : throwIt(e)),
        )),
        map((task): SyncResult => ({ kind: 'ok', mutationId: m.mutationId, task })),
        catchError(e => {
          if (e instanceof HttpError && e.status === 409 && e.body && e.body.task)
            return of<SyncResult>({ kind: 'conflict', mutationId: m.mutationId, task: e.body.task, reason: e.body.reason || 'changed on server' });
          blocked = true;
          return of<SyncResult>({ kind: 'deferred', mutationId: m.mutationId });
        }),
      );
    }),
  );
}

/** Re-run the drain whenever connectivity comes back; ignore triggers while a drain is running. */
export function syncOnReconnect(online$: Observable<boolean>, outbox: () => PendingMutation[], api: SyncApi, opts?: { retries?: number; baseDelayMs?: number }): Observable<SyncResult> {
  return online$.pipe(
    filter(Boolean),
    exhaustMap(() => concat(drainOutbox(outbox(), api, opts))),
  );
}

function isRetryable(e: any): boolean {
  return !(e instanceof HttpError) || e.status >= 500 || e.status === 0;
}

function throwIt(e: any): Observable<never> {
  return new Observable<never>(sub => sub.error(e)).pipe(take(1));
}
