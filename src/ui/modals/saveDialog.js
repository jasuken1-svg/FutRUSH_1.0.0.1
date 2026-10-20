// Hedef listelerini adlandirarak kaydeden modal ve olay baglantisini saglar.
// Bagimliliklar: core/events, targets/targetOps ve modal CSS'i.

import { emit, on } from '../../core/events.js';
import { saveTargetSnapshot } from '../../targets/targetOps.js';
import { saveDialogCss } from './saveDialog.css.js';

function openTargetSaveDialog() {
    document.querySelector('.fr-target-save-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'fr-target-save-overlay';
    const shadow = overlay.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style>' + saveDialogCss + '</style>' + "<div class=\"backdrop\"><div class=\"dialog\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Oyuncu listesini kaydet\">" +
      '<div class="title">Oyuncu listesini kaydet</div><input maxlength="40" placeholder="Liste adı" aria-label="Liste adı"><div class="error" aria-live="polite"></div>' +
      '<div class="actions"><button type="button" class="cancel">İptal</button><button type="button" class="save">Kaydet</button></div></div></div>';
    document.body.appendChild(overlay);
    const input = shadow.querySelector('input');
    const error = shadow.querySelector('.error');
    const close = () => overlay.remove();
    const submit = () => {
      const name = input.value.trim();
      if (!name) { error.textContent = 'Lütfen kayıt için bir isim yazın.'; input.focus(); return; }
      saveTargetSnapshot(name);
      close();
      emit('targets:changed');
    };
    shadow.querySelector('.cancel').addEventListener('click', close);
    shadow.querySelector('.save').addEventListener('click', submit);
    shadow.querySelector('.backdrop').addEventListener('click', (event) => { if (event.target === event.currentTarget) close(); });
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); if (event.key === 'Escape') close(); });
    input.focus();
  }

export function registerModalEvents() {
  on('ui:open-save-dialog', () => openTargetSaveDialog());
}
