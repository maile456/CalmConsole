(() => {
  'use strict';
  const root = document.documentElement;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  let toastTimer;
  function notify(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
  }
  function icons() { window.lucide?.createIcons(); }
  function preference(key, value) {
    root.dataset[key] = value;
    try { localStorage.setItem(`calm-showcase-${key}`, value); } catch {}
  }
  for (const [key, values] of Object.entries({ accent: ['indigo','teal','ruby','amber','gray'], theme: ['light','dark'], radius: ['none','medium','large'] })) {
    try { const value = localStorage.getItem(`calm-showcase-${key}`); if (values.includes(value)) root.dataset[key] = value; } catch {}
  }
  function syncControls() {
    $$('[data-color]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === root.dataset.accent)));
    $$('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === root.dataset.theme)));
    $('#radius').value = root.dataset.radius;
  }
  $$('[data-color]').forEach(button => button.addEventListener('click', () => { preference('accent', button.dataset.color); syncControls(); }));
  $$('[data-mode]').forEach(button => button.addEventListener('click', () => { preference('theme', button.dataset.mode); syncControls(); }));
  $('#radius').addEventListener('change', event => preference('radius', event.target.value));
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); notify('Copied to clipboard.'); }
    catch { const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.append(field); field.select(); const success = document.execCommand('copy'); field.remove(); notify(success ? 'Copied to clipboard.' : 'Select the code to copy it.'); }
  }
  $('#copy-code').addEventListener('click', () => copy($('.code-example code').textContent));
  $('#copy-install').addEventListener('click', () => copy('npx skills add maile456/CalmConsole'));
  const dialog = $('#docs-dialog');
  $$('[data-open-docs]').forEach(button => button.addEventListener('click', () => dialog.showModal()));
  $('#close-docs').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  $('#invite-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#invite-email');
    const email = input.value.trim().toLowerCase();
    if (!input.reportValidity()) return;
    if ([...$('#team-list').querySelectorAll('.person-email')].some(node => node.textContent.toLowerCase() === email)) { notify('This person is already on your team.'); return; }
    const row = document.createElement('div'); row.className = 'person';
    const avatar = document.createElement('span'); avatar.className = 'avatar mint'; avatar.textContent = email.slice(0,2).toUpperCase();
    const name = document.createElement('strong'); name.textContent = email.split('@')[0];
    const address = document.createElement('span'); address.className = 'person-email'; address.textContent = email;
    const role = document.createElement('span'); role.className = 'role'; role.textContent = 'Invited';
    row.append(avatar, name, address, role); $('#team-list').append(row); input.value = '';
    notify('Invitation added locally.');
  });
  $('#signup-form').addEventListener('submit', event => { event.preventDefault(); if (!event.target.reportValidity()) return; $('#signup-status').textContent = 'Your demo account is ready. No data was sent.'; });
  let frozen = false;
  $('#freeze-card').addEventListener('click', () => { frozen = !frozen; $('#bank-card').classList.toggle('frozen', frozen); $('#freeze-card span').textContent = frozen ? 'Unfreeze card' : 'Freeze card'; $('#freeze-card').setAttribute('aria-pressed', String(frozen)); notify(frozen ? 'Demo card frozen.' : 'Demo card active.'); });
  $('#approve-invoice').addEventListener('click', event => { event.currentTarget.innerHTML = '<i data-lucide="check"></i>Invoice approved'; event.currentTarget.disabled = true; icons(); notify('Demo invoice approved.'); });
  syncControls(); icons();
})();
