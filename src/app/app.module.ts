import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { reducers, metaReducers } from './state/app.state';
import { TaskEffects } from './state/tasks.effects';
import { AppComponent } from './app.component';
import { TaskListComponent } from './tasks/task-list.component';

@NgModule({
  declarations: [AppComponent, TaskListComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    RouterModule.forRoot([{ path: '', component: TaskListComponent }]),
    StoreModule.forRoot(reducers, { metaReducers }),
    EffectsModule.forRoot([TaskEffects]),
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
