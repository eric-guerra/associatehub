import { Injectable } from '@angular/core';

/** Associates sign in with badge number + PIN on the shared device; the token lives in sessionStorage. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  get associateId(): string { return sessionStorage.getItem('ah.associate') || ''; }
  get token(): string | null { return sessionStorage.getItem('ah.token'); }
  signOut() { sessionStorage.clear(); }
}
