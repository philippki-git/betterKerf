// Zentrale Dialog-/Toast-Steuerung (ersetzt die globalen showAlert/showConfirm/
// showToast der Legacy-App). Komponenten Dialog.svelte & Toast.svelte rendern
// den jeweils aktuellen Zustand.

let dialog = $state(null); // {title,msg,icon,danger,buttons:[{label,kind,val}], resolve}
let toast = $state(null);  // {msg, id}

export const dlgState = { get current() { return dialog; } };
export const toastState = { get current() { return toast; } };

export function showConfirm(title, msg, { confirmLabel = 'Bestätigen', danger = false, icon = 'alert_circle' } = {}) {
  return new Promise(resolve => {
    dialog = {
      title, msg, icon, danger,
      buttons: [
        { label: confirmLabel, kind: danger ? 'danger' : 'confirm', val: true },
        { label: 'Abbrechen', kind: 'cancel', val: false }
      ],
      resolve
    };
  });
}

export function showAlert(msg, { title = 'Hinweis', icon = 'information', danger = false } = {}) {
  return new Promise(resolve => {
    dialog = {
      title, msg, icon, danger,
      buttons: [{ label: 'OK', kind: 'ok', val: true }],
      resolve
    };
  });
}

export function resolveDialog(val) {
  const r = dialog && dialog.resolve;
  dialog = null;
  if (r) r(val);
}

let toastTimer = null;
export function showToast(msg) {
  toast = { msg, id: Date.now() };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast = null; }, 2200);
}
