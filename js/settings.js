// Pengaturan per perangkat.
const KEY = 'blockyroyale.settings';
const defaults = { volume: 0.6, sensitivity: 1, theme: 'dark', joystick: 'left' };
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* abaikan */ }
export const settings = { ...defaults, ...saved };
export function applySettings() {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.joystick = settings.joystick;
}
export function saveSettings(patch) {
  Object.assign(settings, patch);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* abaikan */ }
  applySettings();
}
