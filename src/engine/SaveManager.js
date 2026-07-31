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

  /** Download current save as a JSON file (for online play / moving devices). */
  download(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bear-bakery-save-day${state?.day || 1}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Prompt the user to pick a save JSON file.
   * @param {(data: object|null) => void} onDone
   */
  promptUpload(onDone) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        onDone(null);
        return;
      }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        onDone(data && typeof data === 'object' ? data : null);
      } catch {
        onDone(null);
      }
    });
    input.click();
  }

  reset() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // No-op.
    }
  }
}
