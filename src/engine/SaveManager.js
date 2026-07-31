const KEY = 'bear-bakery-modern-patisserie-v1';

export class SaveManager {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable in private contexts; game remains playable.
    }
  }

  reset() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // No-op.
    }
  }
}
