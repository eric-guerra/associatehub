import { Component } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

@Component({
  selector: 'ah-root',
  template: `
    <div class="update" *ngIf="updateReady" (click)="reload()">New version available, tap to refresh</div>
    <router-outlet></router-outlet>`,
})
export class AppComponent {
  updateReady = false;
  constructor(sw: SwUpdate) {
    if (sw.isEnabled) sw.available.subscribe(() => (this.updateReady = true));
  }
  reload() { document.location.reload(); }
}
