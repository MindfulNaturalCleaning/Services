/* Manager page: moves each quote request through
     New → Inspections (visit to see the place and quote) → Jobs (the cleaning) → Finished,
   with add-to-calendar buttons for both visits. All data lives in the Google
   Sheet and is reached through the Apps Script, which checks the passcode on
   every request. */
(() => {
  'use strict';

  const CFG = window.SITE_CONFIG || {};
  const PASS_KEY = 'mncs-manager-passcode';
  const INSPECTION_HOURS = 1;

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
  let tab = 'New';
  let openForm = null; // { id, kind } of the form currently open on a card
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

  // Saves one change, then reloads the list so every device stays in step.
  async function save(cardEl, changes, message) {
    $$('button, input, select, textarea', cardEl).forEach((el) => { el.disabled = true; });
    cardEl.classList.add('is-busy');
    try {
      await api('save', { id: cardEl.dataset.id, ...changes });
      openForm = null;
      await load(true);
      if (message) note(message);
    } catch (err) {
      cardEl.classList.remove('is-busy');
      $$('button, input, select, textarea', cardEl).forEach((el) => { el.disabled = false; });
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
  // Soonest first; anything without a date goes last.
  const bySoonest = (key) => (a, b) => {
    const da = parseWhen(a[key]), db = parseWhen(b[key]);
    if (da && db) return da - db;
    return da ? -1 : db ? 1 : 0;
  };

  /* ---------- calendar ---------- */

  const isApple = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = () => /Android/i.test(navigator.userAgent);

  // which: 'inspection' or 'job'.
  function eventParts(r, which) {
    const inspection = which === 'inspection';
    const start = parseWhen(inspection ? r.inspectionAt : r.jobAt);
    const end = new Date(start.getTime() + (inspection ? INSPECTION_HOURS : Number(r.jobHours) || 2) * 3600000);
    const facts = [
      `Customer: ${r.name}`,
      `Phone: ${r.phone}`,
      r.email && `Email: ${r.email}`,
      r.service && `Service: ${r.service}`,
      r.property && `Type of space: ${r.property}`,
      r.frequency && `How often: ${r.frequency}`,
      !inspection && r.quote && `Quote: ${r.quote}`
    ].filter(Boolean).join('\n');
    const notes = [
      inspection ? 'Inspection visit to see the space and give a quote.' : 'Cleaning job.',
      facts,
      r.notes && `Notes:\n${r.notes}`,
      !inspection && r.quoteNotes && `Quote notes:\n${r.quoteNotes}`,
      r.message && `Customer message:\n${r.message}`
    ].filter(Boolean).join('\n\n');
    return { title: `${inspection ? 'Inspection' : 'Cleaning'} – ${r.name}`, start, end, notes, location: r.address || r.area || '' };
  }

  function googleCalendarUrl(r, which) {
    const e = eventParts(r, which);
    const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${stamp(e.start)}/${stamp(e.end)}`, details: e.notes, location: e.location });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }

  // A calendar file with reminders the day before and an hour before. Times are
  // left without a time zone so the phone reads them as local time.
  function icsText(r, which) {
    const e = eventParts(r, which);
    const text = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const now = new Date();
    const utc = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mindful Natural Cleaning//Manager//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${r.id}-${which}-${stamp(e.start)}@mindful-cleaning`,
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

  function addToCalendar(r, which, kind) {
    if (kind === 'google') {
      window.open(googleCalendarUrl(r, which), '_blank', 'noopener');
    } else if (isApple()) {
      // iPhone and iPad open Apple's "Add to Calendar" screen for this.
      location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsText(r, which));
    } else {
      const url = URL.createObjectURL(new Blob([icsText(r, which)], { type: 'text/calendar' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `${which}-${r.name.replace(/[^\w]+/g, '-').toLowerCase()}.ics` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }

  function calendarButtons(r, which) {
    const when = which === 'inspection' ? r.inspectionAt : r.jobAt;
    if (!parseWhen(when)) return `<span class="mgr-hint">Add the ${which === 'inspection' ? 'inspection' : 'job'} date to put it on the calendar.</span>`;
    const label = which === 'inspection' ? 'Add inspection to calendar' : 'Add job to calendar';
    if (isApple()) return `<button type="button" class="btn btn--primary" data-cal="ics" data-which="${which}">${label}</button>`;
    if (isAndroid()) return `<button type="button" class="btn btn--primary" data-cal="google" data-which="${which}">${label}</button>`;
    return `<button type="button" class="btn btn--primary" data-cal="google" data-which="${which}">${label} (Google)</button>` +
      `<button type="button" class="btn btn--ghost" data-cal="ics" data-which="${which}">Apple / Outlook (.ics)</button>`;
  }

  /* ---------- forms ---------- */

  // Each form edits a set of fields and, when it moves the request on, sets a status.
  const FORMS = {
    inspect: { title: 'Book the inspection', fields: ['address', 'notes', 'inspectionAt'], status: 'Inspection', save: 'Move to inspections' },
    quote: { title: 'Quote given: book the job', fields: ['quote', 'quoteNotes', 'jobAt', 'jobHours', 'address'], status: 'Job', save: 'Move to jobs' },
    skip: { title: 'Quoted without a visit: book the job', fields: ['address', 'notes', 'quote', 'quoteNotes', 'jobAt', 'jobHours'], status: 'Job', save: 'Move to jobs' },
    editInspection: { title: 'Edit inspection', fields: ['address', 'notes', 'inspectionAt'], save: 'Save changes' },
    editJob: { title: 'Edit job', fields: ['address', 'notes', 'quote', 'quoteNotes', 'jobAt', 'jobHours'], save: 'Save changes' }
  };

  function field(name, r) {
    switch (name) {
      case 'address':
        return `<label class="form__full">Address <input type="text" name="address" maxlength="300" value="${esc(r.address)}" autocomplete="off"></label>`;
      case 'notes':
        return `<label class="form__full">Notes from the customer <textarea name="notes" maxlength="2000" rows="3" placeholder="What they need, rooms, access, pets, best times">${esc(r.notes)}</textarea></label>`;
      case 'inspectionAt':
        return `<label class="form__full">Inspection date and time <input type="datetime-local" name="inspectionAt" value="${esc(r.inspectionAt)}"></label>`;
      case 'quote':
        return `<label>Quote <input type="text" name="quote" maxlength="60" value="${esc(r.quote)}" placeholder="$180" autocomplete="off"></label>`;
      case 'quoteNotes':
        return `<label class="form__full">Quote notes <textarea name="quoteNotes" maxlength="2000" rows="3" placeholder="What the price covers, what was agreed">${esc(r.quoteNotes)}</textarea></label>`;
      case 'jobAt':
        return `<label>Job date and time <input type="datetime-local" name="jobAt" value="${esc(r.jobAt)}"></label>`;
      case 'jobHours': {
        const current = Number(r.jobHours) || 2;
        const options = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8].map((h) => `<option value="${h}"${h === current ? ' selected' : ''}>${h} hour${h === 1 ? '' : 's'}</option>`).join('');
        return `<label>Job length <select name="jobHours">${options}</select></label>`;
      }
    }
    return '';
  }

  function formHtml(r, kind) {
    const spec = FORMS[kind];
    return `<form class="mgr-form" data-kind="${kind}">
      <h3>${spec.title}</h3>
      <div class="form__grid">${spec.fields.map((f) => field(f, r)).join('')}</div>
      <div class="mgr-actions">
        <button type="submit" class="btn btn--primary">${spec.save}</button>
        <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
      </div>
    </form>`;
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
  const addressLine = (r) => (r.address ? `<p class="mgr-meta"><a href="https://maps.google.com/?q=${encodeURIComponent(r.address)}" target="_blank" rel="noopener">${esc(r.address)}</a></p>` : '');
  const whenPill = (when, extra, missing) => {
    const d = parseWhen(when);
    return `<p class="mgr-when${d ? '' : ' is-missing'}">${d ? esc(niceWhen(d)) + (extra || '') : missing}</p>`;
  };
  const block = (label, text, quiet) => (text ? `<p class="mgr-msg${quiet ? ' mgr-msg--quiet' : ''}"><strong>${label}:</strong> ${esc(text)}</p>` : '');
  const isOpen = (r) => openForm && openForm.id === r.id;

  const card = (r, body) => `<article class="mgr-card leaf${isOpen(r) ? ' is-open' : ''}" data-id="${esc(r.id)}">${body}</article>`;
  const actions = (r, buttons) => (isOpen(r) ? formHtml(r, openForm.kind) : `<div class="mgr-actions">${buttons}</div>`);

  function newCard(r) {
    return card(r, `
      <div class="mgr-card__head">
        <div class="mgr-card__body">
          <h2>${esc(r.name)}</h2>
          <p class="mgr-meta">${jobLine(r)}</p>
          <p class="mgr-meta">${contactLine(r)}</p>
        </div>
        <span class="mgr-time">${esc(ago(r.received))}</span>
      </div>
      ${block('Customer', r.message)}
      ${actions(r, `
        <button type="button" class="btn btn--primary" data-open="inspect">Book inspection</button>
        <button type="button" class="btn btn--ghost" data-open="skip">Skip to job</button>
        <button type="button" class="btn btn--ghost" data-close>Close</button>`)}`);
  }

  function inspectionCard(r) {
    return card(r, `
      <div class="mgr-card__head">
        <div class="mgr-card__body">
          <span class="mgr-stage">Inspection</span>
          <h2>${esc(r.name)}</h2>
          ${whenPill(r.inspectionAt, '', 'No inspection time yet')}
          ${addressLine(r)}
          <p class="mgr-meta">${contactLine(r)}</p>
          <p class="mgr-meta">${jobLine(r)}</p>
        </div>
      </div>
      ${block('Notes', r.notes)}
      ${block('Customer', r.message, true)}
      ${actions(r, `
        ${calendarButtons(r, 'inspection')}
        <button type="button" class="btn btn--primary" data-open="quote">Quote given</button>
        <button type="button" class="btn btn--ghost" data-open="editInspection">Edit</button>
        <button type="button" class="btn btn--ghost" data-close>Close</button>`)}`);
  }

  function jobCard(r) {
    return card(r, `
      <div class="mgr-card__head">
        <label class="mgr-done" title="Mark the job as done">
          <input type="checkbox" data-done aria-label="Mark ${esc(r.name)} as done">
          <span></span>
        </label>
        <div class="mgr-card__body">
          <span class="mgr-stage mgr-stage--job">Job</span>
          <h2>${esc(r.name)}${r.quote ? ` <span class="mgr-quote">${esc(r.quote)}</span>` : ''}</h2>
          ${whenPill(r.jobAt, ` · ${esc(r.jobHours)} h`, 'No job date yet')}
          ${addressLine(r)}
          <p class="mgr-meta">${contactLine(r)}</p>
          <p class="mgr-meta">${jobLine(r)}</p>
        </div>
      </div>
      ${block('Quote notes', r.quoteNotes)}
      ${block('Notes', r.notes)}
      ${block('Customer', r.message, true)}
      ${actions(r, `
        ${calendarButtons(r, 'job')}
        <button type="button" class="btn btn--ghost" data-open="editJob">Edit</button>
        <button type="button" class="btn btn--ghost" data-close>Close</button>`)}`);
  }

  function finishedCard(r) {
    const done = r.status === 'Done';
    const d = parseWhen(r.jobAt);
    return card(r, `
      <div class="mgr-card__head">
        <div class="mgr-card__body">
          <h2>${esc(r.name)} <span class="mgr-tag mgr-tag--${done ? 'done' : 'denied'}">${done ? 'Done' : 'Closed'}</span>${r.quote ? ` <span class="mgr-quote">${esc(r.quote)}</span>` : ''}</h2>
          <p class="mgr-meta">${done && d ? esc(niceWhen(d)) + ' · ' : ''}${jobLine(r)}</p>
          <p class="mgr-meta">${contactLine(r)}</p>
        </div>
      </div>
      <div class="mgr-actions">
        ${done
          ? '<button type="button" class="btn btn--ghost" data-move="Job">Move back to jobs</button>'
          : `<button type="button" class="btn btn--ghost" data-move="${r.jobAt || r.quote ? 'Job' : r.inspectionAt ? 'Inspection' : 'New'}">Reopen</button>`}
      </div>`);
  }

  const emptyState = (title, text) => `<div class="empty leaf"><h3>${title}</h3><p>${text}</p></div>`;

  function render() {
    const of = (status) => requests.filter((r) => r.status === status);
    const lists = {
      New: of('New'),
      Inspection: of('Inspection').sort(bySoonest('inspectionAt')),
      Job: of('Job').sort(bySoonest('jobAt')),
      Finished: requests.filter((r) => r.status === 'Done' || r.status === 'Closed')
    };
    ['New', 'Inspection', 'Job'].forEach((s) => { $(`[data-count="${s}"]`).textContent = lists[s].length; });
    $$('.mgr-tabs button').forEach((b) => b.classList.toggle('is-on', b.dataset.tab === tab));

    const views = {
      New: [newCard, 'No new requests', 'New quote requests from the website show up here. Call or email the customer, then book an inspection.'],
      Inspection: [inspectionCard, 'No inspections booked', 'Requests you book an inspection for show up here, soonest first.'],
      Job: [jobCard, 'No jobs booked', 'Once a quote is given and the cleaning is booked, it shows up here, soonest first.'],
      Finished: [finishedCard, 'Nothing finished yet', 'Completed jobs and closed requests are kept here.']
    };
    const [render1, emptyTitle, emptyText] = views[tab];
    $('#list').innerHTML = lists[tab].length ? lists[tab].map(render1).join('') : emptyState(emptyTitle, emptyText);
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
    const el = event.target.closest('[data-open], [data-cal], [data-cancel], [data-close], [data-move]');
    if (!el) return;
    const cardEl = el.closest('[data-id]');
    const r = byId(cardEl.dataset.id);
    if (!r) return;

    if (el.dataset.cal) return addToCalendar(r, el.dataset.which, el.dataset.cal);
    if ('cancel' in el.dataset) { openForm = null; return render(); }
    if (el.dataset.open) {
      openForm = { id: r.id, kind: el.dataset.open };
      render();
      $(`[data-id="${CSS.escape(r.id)}"] .mgr-form input, [data-id="${CSS.escape(r.id)}"] .mgr-form textarea`)?.focus();
      return;
    }
    if ('close' in el.dataset) {
      if (confirm(`Close the request from ${r.name}? It moves to Finished and can be reopened later.`)) save(cardEl, { status: 'Closed' }, `${r.name} closed.`);
      return;
    }
    if (el.dataset.move) save(cardEl, { status: el.dataset.move }, `${r.name} moved back.`);
  });

  $('#list').addEventListener('change', (event) => {
    if (!('done' in event.target.dataset)) return;
    const cardEl = event.target.closest('[data-id]');
    const r = byId(cardEl.dataset.id);
    save(cardEl, { status: 'Done' }, `${r.name} marked as done.`);
  });

  $('#list').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target;
    const spec = FORMS[form.dataset.kind];
    const cardEl = form.closest('[data-id]');
    const r = byId(cardEl.dataset.id);
    const changes = {};
    spec.fields.forEach((f) => { changes[f] = form.elements[f].value; });
    if (spec.status) changes.status = spec.status;
    const moved = { Inspection: 'moved to Inspections', Job: 'moved to Jobs' }[spec.status];
    save(cardEl, changes, moved ? `${r.name} ${moved}.` : 'Saved.');
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
