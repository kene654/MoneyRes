/** The only place the ledger is read or written. Swap this for an API client later. */

import type { LedgerDb } from '../domain/types';

const DB_KEY = 'moneyres.db.v1';
const SESSION_KEY = 'moneyres.session.v1';

export function emptyDb(): LedgerDb {
  return {
    version: 1,
    users: [],
    loans: [],
    payments: [],
    spends: [],
    goals: [],
    contributions: [],
    entries: [],
  };
}

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function browserStore(): KeyValueStore {
  if (typeof localStorage === 'undefined') return memoryStore();
  return localStorage;
}

const store = browserStore();

function sanitize(raw: unknown): LedgerDb {
  if (!raw || typeof raw !== 'object') return emptyDb();
  const value = raw as Partial<LedgerDb>;
  if (value.version !== 1) return emptyDb();
  return {
    version: 1,
    users: value.users ?? [],
    loans: value.loans ?? [],
    payments: value.payments ?? [],
    spends: value.spends ?? [],
    goals: value.goals ?? [],
    contributions: value.contributions ?? [],
    entries: value.entries ?? [],
  };
}

export const ledgerRepository = {
  load(): LedgerDb {
    try {
      const raw = store.getItem(DB_KEY);
      if (!raw) return emptyDb();
      return sanitize(JSON.parse(raw) as unknown);
    } catch {
      return emptyDb();
    }
  },
  save(db: LedgerDb) {
    store.setItem(DB_KEY, JSON.stringify(db));
  },
  loadSession(): string | null {
    return store.getItem(SESSION_KEY);
  },
  saveSession(userId: string | null) {
    if (!userId) store.removeItem(SESSION_KEY);
    else store.setItem(SESSION_KEY, userId);
  },
};
