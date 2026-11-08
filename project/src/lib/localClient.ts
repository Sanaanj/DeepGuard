/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Offline replacement for the parts of the Supabase client that DeepGuard uses.
 * Accounts live in localStorage and analysis history in IndexedDB, both inside THIS
 * browser, so no internet or Supabase project is needed.
 * Turn it on with VITE_AUTH_MODE=local in .env (use VITE_AUTH_MODE=supabase for the cloud).
 */

type Row = Record<string, any>;

const USERS_KEY = 'deepguard_local_users';
const SESSION_KEY = 'deepguard_local_session';

// ---------- tiny IndexedDB key/value store (large capacity for heatmaps/thumbnails) ----------
let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('deepguard-local', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}
async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction('kv').objectStore('kv').get(key);
    r.onsuccess = () => resolve((r.result as T) ?? fallback);
    r.onerror = () => reject(r.error);
  });
}
async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// serialise read-modify-write operations so they never overlap
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const p = chain.then(fn, fn);
  chain = p.then(() => undefined, () => undefined);
  return p;
}

// ---------- users & session ----------
interface LocalUser {
  id: string;
  email: string;
  passwordHash: string;
  full_name: string;
  created_at: string;
}

function readUsers(): LocalUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch {
    return [];
  }
}
function writeUsers(u: LocalUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(u));
}

async function hash(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return btoa(unescape(encodeURIComponent(text)));
  }
}

function makeSession(u: LocalUser) {
  return {
    access_token: 'local-' + u.id,
    refresh_token: 'local',
    token_type: 'bearer',
    expires_in: 3600 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
    user: {
      id: u.id,
      email: u.email,
      aud: 'authenticated',
      role: 'authenticated',
      created_at: u.created_at,
      app_metadata: {},
      user_metadata: { full_name: u.full_name },
    },
  };
}

function currentSession(): any | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const u = readUsers().find((x) => x.id === id);
    return u ? makeSession(u) : null;
  } catch {
    return null;
  }
}
const currentUid = () => currentSession()?.user?.id as string | undefined;

const listeners = new Set<(event: string, session: any) => void>();
function emit(event: string, session: any) {
  listeners.forEach((cb) => {
    try {
      cb(event, session);
    } catch (e) {
      console.error(e);
    }
  });
}

const auth = {
  async getSession() {
    return { data: { session: currentSession() }, error: null };
  },
  onAuthStateChange(cb: (event: string, session: any) => void) {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Row } }) {
    return locked(async () => {
      const mail = email.trim().toLowerCase();
      const users = readUsers();
      if (users.some((u) => u.email === mail)) {
        return { data: { user: null, session: null }, error: { message: 'An account with this email already exists. Please sign in.' } };
      }
      if (password.length < 6) {
        return { data: { user: null, session: null }, error: { message: 'Password must be at least 6 characters.' } };
      }
      const user: LocalUser = {
        id: crypto.randomUUID(),
        email: mail,
        passwordHash: await hash(password),
        full_name: (options?.data?.full_name as string) || '',
        created_at: new Date().toISOString(),
      };
      users.push(user);
      writeUsers(users);
      const profiles = await kvGet<Row[]>('table:profiles', []);
      profiles.push({
        id: user.id,
        full_name: user.full_name,
        role: users.length === 1 ? 'admin' : 'user', // first local account is the admin
        organization: '',
        avatar_url: null,
        bio: '',
        created_at: user.created_at,
        updated_at: user.created_at,
      });
      await kvSet('table:profiles', profiles);
      localStorage.setItem(SESSION_KEY, user.id);
      const session = makeSession(user);
      emit('SIGNED_IN', session);
      return { data: { user: session.user, session }, error: null };
    });
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const mail = email.trim().toLowerCase();
    const user = readUsers().find((u) => u.email === mail);
    if (!user || user.passwordHash !== (await hash(password))) {
      return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
    }
    localStorage.setItem(SESSION_KEY, user.id);
    const session = makeSession(user);
    emit('SIGNED_IN', session);
    return { data: { user: session.user, session }, error: null };
  },
  async signOut() {
    localStorage.removeItem(SESSION_KEY);
    emit('SIGNED_OUT', null);
    return { error: null };
  },
};

// ---------- table queries (row-level security: each user only sees their own rows) ----------
const visible = (table: string, rows: Row[]): Row[] => {
  const uid = currentUid();
  if (!uid) return [];
  if (table === 'profiles') return rows.filter((r) => r.id === uid);
  return rows.filter((r) => r.user_id === uid);
};

const project = (row: Row, cols?: string): Row => {
  if (!cols || cols.trim() === '*') return row;
  const out: Row = {};
  cols.split(',').map((c) => c.trim()).filter(Boolean).forEach((c) => (out[c] = row[c]));
  return out;
};

type Filter = [string, string, any];

class Query implements PromiseLike<any> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: Filter[] = [];
  private cols?: string;
  private wantCount = false;
  private head = false;
  private ord?: { col: string; asc: boolean };
  private lim?: number;
  private payload: any;
  private returning = false;
  private mode: 'single' | 'maybe' | null = null;

  constructor(private table: string) {}

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    this.cols = cols;
    if (this.op === 'select') {
      this.wantCount = !!opts?.count;
      this.head = !!opts?.head;
    } else {
      this.returning = true;
    }
    return this;
  }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: any) { this.filters.push([c, 'eq', v]); return this; }
  neq(c: string, v: any) { this.filters.push([c, 'neq', v]); return this; }
  gte(c: string, v: any) { this.filters.push([c, 'gte', v]); return this; }
  lte(c: string, v: any) { this.filters.push([c, 'lte', v]); return this; }
  in(c: string, v: any[]) { this.filters.push([c, 'in', v]); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.ord = { col, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  then<R1 = any, R2 = never>(
    onfulfilled?: ((v: any) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((e: any) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    return locked(() => this.run()).then(onfulfilled, onrejected);
  }

  private matches(r: Row) {
    return this.filters.every(([c, op, v]) => {
      const x = r[c];
      switch (op) {
        case 'eq': return x === v;
        case 'neq': return x !== v;
        case 'gte': return x >= v;
        case 'lte': return x <= v;
        case 'in': return (v as any[]).includes(x);
        default: return true;
      }
    });
  }

  private async run(): Promise<any> {
    const key = 'table:' + this.table;
    const all = await kvGet<Row[]>(key, []);
    const uid = currentUid();
    if (!uid) return { data: null, error: { message: 'Not signed in', code: 'PGRST301' } };

    if (this.op === 'insert') {
      const now = new Date().toISOString();
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: Row) => ({
        id: crypto.randomUUID(),
        created_at: now,
        user_id: uid,
        ...(this.table === 'analyses'
          ? { analysis_id: 'DG-' + Math.random().toString(16).slice(2, 8).toUpperCase(), status: 'completed' }
          : {}),
        ...p,
      }));
      all.push(...rows);
      await kvSet(key, all);
      const out = rows.map((r: Row) => project(r, this.cols));
      return { data: this.returning ? (this.mode ? out[0] : out) : null, error: null };
    }

    if (this.op === 'update') {
      const mine = new Set(visible(this.table, all));
      all.forEach((r, i) => {
        if (mine.has(r) && this.matches(r)) all[i] = { ...r, ...this.payload };
      });
      await kvSet(key, all);
      return { data: null, error: null };
    }

    if (this.op === 'delete') {
      const mine = new Set(visible(this.table, all));
      await kvSet(key, all.filter((r) => !(mine.has(r) && this.matches(r))));
      return { data: null, error: null };
    }

    // select
    let rows = visible(this.table, all).filter((r) => this.matches(r));
    const count = rows.length;
    if (this.ord) {
      const { col, asc } = this.ord;
      rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
    }
    if (this.lim !== undefined) rows = rows.slice(0, this.lim);
    const data = rows.map((r) => project(r, this.cols));
    if (this.mode === 'single') {
      return data.length === 1
        ? { data: data[0], error: null }
        : { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
    }
    if (this.mode === 'maybe') return { data: data[0] ?? null, error: null };
    return { data: this.head ? null : data, count: this.wantCount ? count : null, error: null };
  }
}

export function createLocalClient() {
  return {
    auth,
    from: (table: string) => new Query(table),
  };
}
