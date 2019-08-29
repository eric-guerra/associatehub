import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { PendingMutation, StoreTask } from '../state/models';
import { HttpError, SyncApi } from './outbox-sync';

@Injectable({ providedIn: 'root' })
export class TasksApi implements SyncApi {
  constructor(private http: HttpClient) {}

  list(): Observable<StoreTask[]> {
    return this.http.get<StoreTask[]>(`${environment.api}/stores/${environment.storeId}/tasks`);
  }

  /** Idempotency-Key = mutationId, so a retry after a lost response is a no-op on the server. */
  patchTask(m: PendingMutation): Observable<StoreTask> {
    return this.http.patch<StoreTask>(`${environment.api}/tasks/${m.taskId}`,
      { status: m.status, note: m.note, baseVersion: m.baseVersion },
      { headers: { 'Idempotency-Key': m.mutationId } },
    ).pipe(catchError((e: HttpErrorResponse) => throwError(new HttpError(e.status, e.error))));
  }
}
