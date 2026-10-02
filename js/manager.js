/* Manager page: quote requests, to-do list and calendar buttons.
   All data lives in the Google Sheet and is reached through the Apps Script,
   which checks the passcode on every request. */
(() => {
  'use strict';

  const CFG = window.SITE_CONFIG || {};
  const PASS_KEY = 'mncs-manager-passcode';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const store = {
    get() {
      try { return sessionStorage.getItem(PASS_KEY) || localStorage.getItem(PASS_KEY) || ''; } catch (e) { return ''; }
    },
    set(value, remember) {
      try {
        sessionStorage.setItem(PASS_KEY, value);
        if (remember) localStorage.setItem(PASS_KEY, value); else localStorage.removeItem(PASS_KEY);
      } catch (e) { /* storage unavailable: signed in for this page view only */ }
    },
    clear() {
      try { sessionStorage.removeItem(PASS_KEY); localStorage.removeItem(PASS_KEY); } catch (e) { /* nothing stored */ }
    }
  };

  let passcode = '';
  let requests = [];
  let tab = 'new';
  let openForm = null; // id of the request whose accept/edit form is open
  let lastLoad = 0;

  /* ---------- talking to the script ---------- */

  async function api(action, extra = {}) {
    if (!CFG.scriptUrl) throw new Error('The website is not connected to the Google script.');
    const res = await fetch(CFG.scriptUrl, {
      method: 'POST',
      body: new URLSearchParams({ form: 'manager', action, passcode, ...extra })
    });
    const result = await res.json();
    if (result.wrongPasscode || result.locked) {
      signOut(result.error);
      throw new Error(result.error);
    }
    if (!result.ok) throw new Error(result.error || 'Something went wrong.');
    return result;
  }

  async function load(quiet) {
    if (!quiet) note('Loading…');
    try {
      requests = (await api('list')).requests;
      lastLoad = Date.now();
      note('');
      render();
    } catch (err) {
      note(err.message, true);
    }
  }

  // Runs one change, then reloads the list so every device stays in step.
  async function change(card, action, extra) {
    $$('button, input, select, textarea', card).forEach((el) => { el.disabled = true; });
    card.classList.add('is-busy');
    try {
      await api(action, extra);
      openForm = null;
      await load(true);
    } catch (err) {
      card.classList.remove('is-busy');
      $$('button, input, select, textarea', card).forEach((el) => { el.disabled = false; });
      note(err.message, true);
    }
  }

  /* ---------- sign in ---------- */

  function showLogin(message) {
    $('#app').hidden = true;
    $('#bar-actions').hidden = true;
    $('#login').hidden = false;
    const status = $('#login .form__status');
    status.textContent = message || '';
    status.className = 'form__status' + (message ? ' is-error' : '');
    $('#login input[name="passcode"]').focus();
  }

  function showApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#bar-actions').hidden = false;
  }

  function signOut(message) {
    passcode = '';
    requests = [];
    store.clear();
    $('#list').innerHTML = '';
    showLogin(message);
  }

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const button = $('button[type="submit"]', form);
    const status = $('.form__status', form);
    passcode = form.passcode.value;
    button.disabled = true;
    status.className = 'form__status';
    status.textContent = 'Checking…';
    try {
      await api('login');
      store.set(passcode, form.remember.checked);
      form.passcode.value = '';
      status.textContent = '';
      showApp();
      await load();
    } catch (err) {
      status.className = 'form__status is-error';
      status.textContent = err.message;
    }
    button.disabled = false;
  });

  $('#lock').addEventListener('click', () => signOut());
  $('#refresh').addEventListener('click', () => load());

  // Pick up changes made on another device when the page comes back into view.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && passcode && !openForm && Date.now() - lastLoad > 30000) load(true);
  });

  /* ---------- dates ---------- */

  // "2026-10-08T09:00" → a Date in the phone's own time zone.
  const parseWhen = (when) => {
    const m = String(when || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
  };
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const niceWhen = (d) => d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const ago = (iso) => {
    if (!iso) return '';
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 60) return mins <= 1 ? 'just now' : `${mins} min ago`;
    if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  /* ---------- calendar ---------- */

  const isApple = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = () => /Android/i.test(navigator.userAgent);

  function eventParts(r) {
    const start = parseWhen(r.when);
    const end = new Date(start.getTime() + (Number(r.hours) || 2) * 3600000);
    const notes = [
      `Customer: ${r.name}`,
      `Phone: ${r.phone}`,
      r.email && `Email: ${r.email}`,
      r.service && `Service: ${r.service}`,
      r.property && `Type of space: ${r.property}`,
      r.frequency && `How often: ${r.frequency}`,
      r.details && `\nJob details:\n${r.details}`,
      r.message && `\nCustomer message:\n${r.message}`
    ].filter(Boolean).join('\n');
    return { title: `Cleaning – ${r.name}`, start, end, notes, location: r.address || r.area || '' };
  }

  function googleCalendarUrl(r) {
    const e = eventParts(r);
    const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${stamp(e.start)}/${stamp(e.end)}`, details: e.notes, location: e.location });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }

  // A calendar file with reminders the day before and an hour before. Times are
  // left without a time zone so the phone reads them as local time.
  function icsText(r) {
    const e = eventParts(r);
    const text = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const now = new Date();
    const utc = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mindful Natural Cleaning//Manager//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${r.id}-${stamp(e.start)}@mindful-cleaning`,
      `DTSTAMP:${utc}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${text(e.title)}`,
      `LOCATION:${text(e.location)}`,
      `DESCRIPTION:${text(e.notes)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(e.title)}`, 'TRIGGER:-P1D', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(e.title)}`, 'TRIGGER:-PT1H', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ];
    // Calendar files wrap long lines at 75 characters, continuing with a space.
    return lines.map((line) => line.match(/.{1,73}/g).join('\r\n ')).join('\r\n');
  }

  function addToCalendar(r, kind) {
    if (kind === 'google') {
      window.open(googleCalendarUrl(r), '_blank', 'noopener');
    } else if (isApple()) {
      // iPhone and iPad open Apple's "Add to Calendar" screen for this.
      location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsText(r));
    } else {
      const url = URL.createObjectURL(new Blob([icsText(r)], { type: 'text/calendar' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `cleaning-${r.name.replace(/[^\w]+/g, '-').toLowerCase()}.ics` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }

  function calendarButtons(r) {
    if (!parseWhen(r.when)) return '<span class="mgr-hint">Add a date to put this on the calendar.</span>';
    if (isApple()) return '<button type="button" class="btn btn--primary" data-cal="ics">Add to calendar</button>';
    if (isAndroid()) return '<button type="button" class="btn btn--primary" data-cal="google">Add to calendar</button>';
    return '<button type="button" class="btn btn--primary" data-cal="google">Add to Google Calendar</button>' +
      '<button type="button" class="btn btn--ghost" data-cal="ics">Apple / Outlook (.ics)</button>';
  }

  /* ---------- rendering ---------- */

  function note(message, isError) {
    const el = $('#note');
    el.textContent = message;
    el.className = 'mgr-note' + (isError ? ' is-error' : '');
  }

  const contactLine = (r) => [
    r.phone && `<a href="tel:${esc(r.phone.replace(/[^\d+]/g, ''))}">${esc(r.phone)}</a>`,
    r.email && `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`
  ].filter(Boolean).join(' · ');

  const jobLine = (r) => [r.service, r.property, r.area, r.frequency].filter(Boolean).map(esc).join(' · ');

  function scheduleForm(r, saveLabel) {
    const hours = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
    const current = Number(r.hours) || 2;
    return `<form class="mgr-form" data-form>
      <div class="form__grid">
        <label>Date and time
          <input type="datetime-local" name="when" value="${esc(r.when)}">
        </label>
        <label>Length
          <select name="hours">${hours.map((h) => `<option value="${h}"${h === current ? ' selected' : ''}>${h} hour${h === 1 ? '' : 's'}</option>`).join('')}</select>
        </label>
        <label class="form__full">Address
          <input type="text" name="address" maxlength="300" value="${esc(r.address)}" autocomplete="off">
        </label>
        <label class="form__full">Job details
          <textarea name="details" maxlength="2000" rows="3" placeholder="Rooms, access, pets, anything agreed on the phone">${esc(r.details)}</textarea>
        </label>
      </div>
      <div class="mgr-actions">
        <button type="submit" class="btn btn--primary">${saveLabel}</button>
        <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
      </div>
    </form>`;
  }

  function card(r, body) {
    return `<article class="mgr-card leaf${openForm === r.id ? ' is-open' : ''}" data-id="${esc(r.id)}">${body}</article>`;
  }

  function newCard(r) {
    return card(r, `
      <div class="mgr-card__head">
        <div>
          <h2>${esc(r.name)}</h2>
          <p class="mgr-meta">${jobLine(r)}</p>
          <p class="mgr-meta">${contactLine(r)}</p>
        </div>
        <span class="mgr-time">${esc(ago(r.received))}</span>
      </div>
      ${r.message ? `<p class="mgr-msg">${esc(r.message)}</p>` : ''}
      ${openForm === r.id
        ? scheduleForm(r, 'Accept job')
        : `<div class="mgr-actions">
            <button type="button" class="btn btn--primary" data-act="open">Accept</button>
            <button type="button" class="btn btn--ghost" data-act="deny">Deny</button>
          </div>`}`);
  }

  function todoCard(r) {
    const when = parseWhen(r.when);
    return card(r, `
      <div class="mgr-card__head">
        <label class="mgr-done" title="Mark as done">
          <input type="checkbox" data-act="done" aria-label="Mark ${esc(r.name)} as done">
          <span></span>
        </label>
        <div class="mgr-card__body">
          <h2>${esc(r.name)}</h2>
          <p class="mgr-when${when ? '' : ' is-missing'}">${when ? esc(niceWhen(when)) + ` · ${esc(r.hours)} h` : 'No date yet'}</p>
          ${r.address ? `<p class="mgr-meta"><a href="https://maps.google.com/?q=${encodeURIComponent(r.address)}" target="_blank" rel="noopener">${esc(r.address)}</a></p>` : ''}
          <p class="mgr-meta">${contactLine(r)}</p>
          <p class="mgr-meta">${jobLine(r)}</p>
        </div>
      </div>
      ${r.details ? `<p class="mgr-msg"><strong>Job details:</strong> ${esc(r.details)}</p>` : ''}
      ${r.message ? `<p class="mgr-msg mgr-msg--quiet"><strong>Customer:</strong> ${esc(r.message)}</p>` : ''}
      ${openForm === r.id
        ? scheduleForm(r, 'Save changes')
        : `<div class="mgr-actions">${calendarButtons(r)}<button type="button" class="btn btn--ghost" data-act="open">Edit</button></div>`}`);
  }

  function finishedCard(r) {
    const done = r.status === 'Done';
    const when = parseWhen(r.when);
    return card(r, `
      <div class="mgr-card__head">
        <div>
          <h2>${esc(r.name)} <span class="mgr-tag mgr-tag--${done ? 'done' : 'denied'}">${done ? 'Done' : 'Denied'}</span></h2>
          <p class="mgr-meta">${done && when ? esc(niceWhen(when)) + ' · ' : ''}${jobLine(r)}</p>
          <p class="mgr-meta">${contactLine(r)}</p>
        </div>
      </div>
      <div class="mgr-actions">
        <button type="button" class="btn btn--ghost" data-act="${done ? 'back-to-todo' : 'restore'}">${done ? 'Move back to to-do' : 'Restore to new'}</button>
      </div>`);
  }

  const emptyState = (title, text) => `<div class="empty leaf"><h3>${title}</h3><p>${text}</p></div>`;

  function render() {
    const fresh = requests.filter((r) => r.status === 'New');
    const todo = requests.filter((r) => r.status === 'Accepted').sort((a, b) => {
      const da = parseWhen(a.when), db = parseWhen(b.when);
      if (da && db) return da - db;
      return da ? -1 : db ? 1 : 0;
    });
    const finished = requests.filter((r) => r.status === 'Done' || r.status === 'Denied');

    $('[data-count="new"]').textContent = fresh.length;
    $('[data-count="todo"]').textContent = todo.length;
    $$('.mgr-tabs button').forEach((b) => b.classList.toggle('is-on', b.dataset.tab === tab));

    const list = $('#list');
    if (tab === 'new') {
      list.innerHTML = fresh.length ? fresh.map(newCard).join('') : emptyState('No new requests', 'New quote requests from the website will show up here.');
    } else if (tab === 'todo') {
      list.innerHTML = todo.length ? todo.map(todoCard).join('') : emptyState('Nothing to do', 'Accepted jobs will show up here, soonest first.');
    } else {
      list.innerHTML = finished.length ? finished.map(finishedCard).join('') : emptyState('Nothing finished yet', 'Completed and denied requests are kept here.');
    }
  }

  $$('.mgr-tabs button').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    openForm = null;
    note('');
    render();
  }));

  /* ---------- card actions ---------- */

  const byId = (id) => requests.find((r) => r.id === id);

  $('#list').addEventListener('click', (event) => {
    const el = event.target.closest('[data-act], [data-cal], [data-cancel]');
    if (!el || el.tagName === 'INPUT') return;
    const cardEl = el.closest('[data-id]');
    const r = byId(cardEl.dataset.id);
    if (!r) return;

    if (el.dataset.cal) return addToCalendar(r, el.dataset.cal);
    if ('cancel' in el.dataset) { openForm = null; return render(); }

    switch (el.dataset.act) {
      case 'open':
        openForm = r.id;
        render();
        $(`[data-id="${CSS.escape(r.id)}"] input[name="when"]`)?.focus();
        break;
      case 'deny':
        if (confirm(`Deny the request from ${r.name}?`)) change(cardEl, 'deny', { id: r.id });
        break;
      case 'restore':
        change(cardEl, 'reopen', { id: r.id, to: 'New' });
        break;
      case 'back-to-todo':
        change(cardEl, 'reopen', { id: r.id, to: 'Accepted' });
        break;
    }
  });

  $('#list').addEventListener('change', (event) => {
    if (event.target.dataset.act !== 'done') return;
    const cardEl = event.target.closest('[data-id]');
    change(cardEl, 'done', { id: cardEl.dataset.id });
  });

  $('#list').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target;
    const cardEl = form.closest('[data-id]');
    const r = byId(cardEl.dataset.id);
    const values = { id: r.id, when: form.when.value, hours: form.hours.value, address: form.address.value, details: form.details.value };
    change(cardEl, r.status === 'New' ? 'accept' : 'update', values);
  });

  /* ---------- start ---------- */

  try {
    const cached = JSON.parse(localStorage.getItem('mncs-data-v1'));
    if (cached && cached.name) $('[data-business]').textContent = cached.name;
  } catch (e) { /* keep the default name */ }

  passcode = store.get();
  if (passcode) {
    showApp();
    load();
  } else {
    showLogin();
  }
})();
