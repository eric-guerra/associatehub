import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';
import { AppState, selectVisible, selectPendingCount, selectOnline, selectProgress } from '../state/app.state';
import { Load, UpdateStatus, SetFilter } from '../state/tasks.actions';
import { StoreTask, TaskStatus } from '../state/models';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'ah-task-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bar">
      <span class="dot" [class.off]="!(online$ | async)"></span>
      <span *ngIf="(pending$ | async) as n">{{ n }} change{{ n === 1 ? '' : 's' }} waiting to sync</span>
      <ng-container *ngIf="progress$ | async as p">
        <strong>{{ p.done }}/{{ p.total }}</strong>
        <span class="must" *ngIf="p.mustDoRemaining">{{ p.mustDoRemaining }} must-do left</span>
      </ng-container>
    </header>
    <nav>
      <button (click)="filter('mine')">Mine</button>
      <button (click)="filter('open')">Open</button>
      <button (click)="filter('all')">All</button>
    </nav>
    <section *ngFor="let group of groups$ | async; trackBy: trackAisle">
      <h3>Aisle {{ group.aisle }}</h3>
      <article *ngFor="let t of group.tasks; trackBy: trackTask" [ngClass]="['p' + t.priority, t.status]">
        <div class="title">{{ t.title }}</div>
        <div class="actions">
          <button *ngIf="t.status === 'open'" (click)="set(t, 'in_progress')">Start</button>
          <button *ngIf="t.status !== 'done'" (click)="set(t, 'done')">Done</button>
          <button *ngIf="t.status !== 'blocked' && t.status !== 'done'" (click)="block(t)">Blocked</button>
        </div>
      </article>
    </section>
  `,
})
export class TaskListComponent implements OnInit {
  groups$: Observable<{ aisle: string; tasks: StoreTask[] }[]>;
  pending$ = this.store.pipe(select(selectPendingCount));
  online$ = this.store.pipe(select(selectOnline));
  progress$: Observable<{ done: number; total: number; mustDoRemaining: number }>;

  constructor(private store: Store<AppState>, private auth: AuthService) {}

  ngOnInit() {
    const me = this.auth.associateId;
    this.groups$ = this.store.pipe(select(selectVisible(me, Date.now())));
    this.progress$ = this.store.pipe(select(selectProgress(me)));
    this.store.dispatch(new Load());
  }

  set(t: StoreTask, status: TaskStatus, note?: string) {
    this.store.dispatch(new UpdateStatus({ id: t.id, status, note, by: this.auth.associateId, at: Date.now(), mutationId: uuid() }));
  }

  block(t: StoreTask) {
    const note = prompt('What is blocking this? (e.g. no stock in back room)');
    if (note) this.set(t, 'blocked', note);
  }

  filter(f: 'mine' | 'open' | 'all') { this.store.dispatch(new SetFilter({ filter: f })); }
  trackAisle(_: number, g: { aisle: string }) { return g.aisle; }
  trackTask(_: number, t: StoreTask) { return t.id; }
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
