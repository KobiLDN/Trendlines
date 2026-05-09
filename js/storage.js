// localStorage wrapper for trendline setups
const STORAGE_KEY = 'trendlines_setups_v1';

export function loadSetups() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load setups', e);
    return [];
  }
}

export function saveSetups(setups) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(setups));
}

export function addSetup(setup) {
  const setups = loadSetups();
  setup.id = Date.now().toString(36);
  setup.createdAt = new Date().toISOString();
  setup.status = 'armed';
  setups.push(setup);
  saveSetups(setups);
  return setup;
}

export function updateSetup(id, patch) {
  const setups = loadSetups();
  const idx = setups.findIndex(s => s.id === id);
  if (idx >= 0) {
    setups[idx] = { ...setups[idx], ...patch };
    saveSetups(setups);
  }
}

export function deleteSetup(id) {
  saveSetups(loadSetups().filter(s => s.id !== id));
}
