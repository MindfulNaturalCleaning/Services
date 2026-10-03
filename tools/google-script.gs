/**
 * Website back end — Google Apps Script.
 *
 * This does NOT run on the website. It is pasted into the back-end Google Sheet
 * (Extensions > Apps Script) and deployed as a web app. It does four things:
 *
 *   1. Quote requests: saves each one in the "Requests" tab and emails it to the
 *      address under the sheet's "Email" heading.
 *   2. Manager page: lets the passcode-protected manager.html page move each
 *      request through New > Inspection > Job > Done (or Closed), with the
 *      address, notes, inspection time, quote and job time. The passcode is kept
 *      in Project Settings > Script Properties as MANAGER_PASSCODE.
 *   3. New reviews: saves each one in the "Reviews" tab, hidden until the Show
 *      box on that row is ticked. Can also email a notice (off by default).
 *   4. Showing reviews: gives the website the rows whose Show box is ticked.
 *
 * Setup steps are in README.md.
 */

var MANAGER_PAGE_URL = 'https://mindfulnaturalcleaning.github.io/Services/manager.html';

var REVIEWS_TAB = 'Reviews';
var REVIEW_HEADINGS = ['Date', 'Name', 'Rating', 'Review', 'Show'];
// Change to true to get an email each time a review is left.
var EMAIL_ON_NEW_REVIEW = false;

// The Requests tab is the manager page's storage. Columns are found by heading.
var REQUESTS = {
  name: 'Requests',
  headings: ['Status', 'Received', 'Name', 'Phone', 'Email', 'Area', 'Service', 'Type of space', 'How often', 'Customer message', 'Address', 'Notes', 'Inspection at', 'Quote', 'Quote notes', 'Job at', 'Job hours', 'ID'],
  widths: [95, 150, 160, 125, 210, 180, 150, 115, 150, 300, 240, 300, 160, 90, 300, 160, 75, 80]
};
// New: just arrived. Inspection: visit booked to see the place and quote.
// Job: quote given, cleaning booked. Done: finished. Closed: not going ahead.
var STATUSES = ['New', 'Inspection', 'Job', 'Done', 'Closed'];
var DATE_COLUMNS = ['Received', 'Inspection at', 'Job at'];
var WRAPPED_COLUMNS = ['Customer message', 'Address', 'Notes', 'Quote notes'];

// What the manager page may change, with the most characters allowed for each.
// Dates are handled separately.
var EDITABLE = { address: ['Address', 300], notes: ['Notes', 2000], quote: ['Quote', 60], quoteNotes: ['Quote notes', 2000] };

// Wrong passcodes allowed in a 15-minute window before the manager page locks.
var MAX_WRONG_PASSCODES = 10;

function doPost(e) {
  var p = (e && e.parameter) || {};

  // Hidden field that real visitors leave empty; bots tend to fill it in.
  if (p.website) return reply({ ok: true });

  if (p.form === 'manager') return reply(managerAction(p));
  return reply(p.form === 'reviews' ? saveReview(p) : sendQuote(p));
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.ics) return calendarFile(p.ics);
  return reply({ ok: true, reviews: shownReviews() });
}

/* ---------- quotes ---------- */

function sendQuote(p) {
  var name = clean(p.name, 80);
  var phone = clean(p.phone, 30);
  if (!name || !phone) return { ok: false, error: 'Name and phone are required.' };

  var to = businessEmail();
  if (!to) return { ok: false, error: 'No email address found in the sheet.' };

  var visitorEmail = clean(p.email, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail)) visitorEmail = '';
  var details = clean(p.details, 1500);
  var fields = [
    ['Name', name],
    ['Phone', phone],
    ['Email', visitorEmail],
    ['Area', clean(p.area, 80)],
    ['Service', clean(p.service, 80)],
    ['Type of space', clean(p.property, 40)],
    ['How often', clean(p.frequency, 40)]
  ];

  // The email still goes out if the sheet can't be written to.
  try {
    saveRequest(fields, details);
  } catch (err) {
    console.error('Could not save the request to the sheet: ' + err);
  }

  // Plain-text version, shown by email apps that don't display formatted mail.
  var lines = ['New quote request from the website', ''];
  fields.forEach(function (f) { lines.push(f[0] + ': ' + (f[1] || '-')); });
  lines.push('', 'Details:', details || '-', '', 'Accept or deny it on the manager page:', MANAGER_PAGE_URL);

  var business = sheetValue('business name') || 'Your website';
  var message = {
    to: to,
    subject: 'Quote request from ' + name,
    body: lines.join('\n'),
    htmlBody: quoteEmailHtml(business, sheetValue('logo'), fields, details, phone, visitorEmail),
    name: business + ' Website'
  };
  // Hitting Reply answers the customer directly when they left an email address.
  if (visitorEmail) message.replyTo = visitorEmail;
  MailApp.sendEmail(message);

  return { ok: true };
}

function saveRequest(fields, details) {
  withLock(function () {
    var tab = requestsTab();
    var record = { 'Status': 'New', 'Received': new Date(), 'Customer message': plainText(details, 1500), 'ID': Utilities.getUuid() };
    fields.forEach(function (f) { record[f[0]] = plainText(f[1], 200); });
    tab.appendRow(REQUESTS.headings.map(function (h) { return h in record ? record[h] : ''; }));
  });
}

// The formatted quote email. Table layout and inline styles, since that is what
// email apps display reliably.
function quoteEmailHtml(business, logo, fields, details, phone, visitorEmail) {
  var font = 'font-family:Arial,Helvetica,sans-serif;';
  var header = /^https:\/\/[^\s"'<>]+$/.test(logo)
    ? '<img src="' + html(logo) + '" alt="' + html(business) + '" height="56" style="height:56px;width:auto;border:0;display:block;">'
    : '<span style="' + font + 'font-size:20px;font-weight:bold;color:#12332a;">' + html(business) + '</span>';

  var rows = fields.filter(function (f) { return f[1]; }).map(function (f) {
    return '<tr>' +
      '<td style="' + font + 'padding:10px 0;border-bottom:1px solid #e3e9e1;font-size:13px;color:#55665d;width:130px;vertical-align:top;">' + html(f[0]) + '</td>' +
      '<td style="' + font + 'padding:10px 0;border-bottom:1px solid #e3e9e1;font-size:15px;color:#18261f;font-weight:bold;vertical-align:top;">' + html(f[1]) + '</td>' +
      '</tr>';
  }).join('');

  var button = function (href, label, primary) {
    return '<a href="' + html(href) + '" style="' + font + 'display:inline-block;margin:0 8px 8px 0;padding:12px 22px;border-radius:24px;font-size:14px;font-weight:bold;text-decoration:none;' +
      (primary ? 'background:#12332a;color:#ffffff;border:2px solid #12332a;' : 'background:#ffffff;color:#12332a;border:2px solid #12332a;') + '">' + html(label) + '</a>';
  };
  var buttons = button('tel:' + phone.replace(/[^\d+]/g, ''), 'Call ' + phone, true) +
    (visitorEmail ? button('mailto:' + visitorEmail, 'Reply by email', false) : '') +
    button(MANAGER_PAGE_URL, 'Accept or deny', false);

  var when = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "EEEE, MMMM d, yyyy 'at' h:mm a");

  return '<div style="margin:0;padding:24px 12px;background:#eef4ec;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #dfe6dd;border-radius:10px;overflow:hidden;">' +
      '<tr><td style="padding:22px 28px;">' + header + '</td></tr>' +
      '<tr><td style="padding:20px 28px;background:#12332a;">' +
        '<div style="' + font + 'font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#e2a93b;font-weight:bold;">New quote request</div>' +
        '<div style="' + font + 'font-size:24px;color:#ffffff;font-weight:bold;padding-top:6px;">' + html(fields[0][1]) + '</div>' +
      '</td></tr>' +
      '<tr><td style="padding:16px 28px 4px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">' + rows + '</table></td></tr>' +
      (details
        ? '<tr><td style="padding:16px 28px 4px;">' +
            '<div style="' + font + 'font-size:13px;color:#55665d;padding-bottom:6px;">Details</div>' +
            '<div style="' + font + 'font-size:15px;line-height:1.55;color:#18261f;background:#faf8f1;border-left:4px solid #5f9c7a;padding:14px 16px;">' + html(details).replace(/\n/g, '<br>') + '</div>' +
          '</td></tr>'
        : '') +
      '<tr><td style="padding:22px 28px 14px;">' + buttons + '</td></tr>' +
      '<tr><td style="' + font + 'padding:16px 28px;background:#faf8f1;border-top:1px solid #e3e9e1;font-size:12px;color:#55665d;">' +
        'Sent from the quote form on the ' + html(business) + ' website<br>' + html(when) +
      '</td></tr>' +
    '</table></div>';
}

/* ---------- manager page ---------- */

function managerAction(p) {
  var check = checkPasscode(p.passcode);
  if (!check.ok) return check;

  switch (p.action) {
    case 'login': return { ok: true };
    case 'list': return { ok: true, requests: listRequests() };
    case 'save': return saveRequestChanges(p);
    case 'calendar': return prepareCalendarFile(p.id, p.which);
    default: return { ok: false, error: 'Unknown action.' };
  }
}

/* ---------- calendar files ---------- */

// Phones add an event to their calendar when they open a calendar (.ics) file
// from a web address. The manager page asks for one here (passcode checked);
// the file is kept for 10 minutes under a random one-time code, and the page
// then opens ?ics=<code>. No customer details ever appear in the web address.
function prepareCalendarFile(id, which) {
  if (which !== 'inspection' && which !== 'job') return { ok: false, error: 'Unknown calendar entry.' };
  var r = (listRequests().filter(function (x) { return x.id === String(id); }))[0];
  if (!r) return { ok: false, error: 'That request was not found.' };
  var when = which === 'inspection' ? r.inspectionAt : r.jobAt;
  if (!localDate(when)) return { ok: false, error: 'Add the ' + which + ' date first.' };

  var code = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('ics-' + code, icsText(r, which), 600);
  return { ok: true, code: code };
}

function calendarFile(code) {
  var ics = CacheService.getScriptCache().get('ics-' + String(code).replace(/[^\w]/g, ''));
  if (!ics) return ContentService.createTextOutput('This calendar link has expired. Go back to the manager page and tap the button again.');
  return ContentService.createTextOutput(ics).setMimeType(ContentService.MimeType.ICAL);
}

// One calendar event with reminders the day before and an hour before. Times
// are written without a time zone so the phone reads them as local time.
function icsText(r, which) {
  var inspection = which === 'inspection';
  var start = localDate(inspection ? r.inspectionAt : r.jobAt);
  var end = new Date(start.getTime() + (inspection ? 1 : Number(r.jobHours) || 2) * 3600000);
  var title = (inspection ? 'Inspection' : 'Cleaning') + ' – ' + r.name;

  var facts = [
    'Customer: ' + r.name,
    'Phone: ' + r.phone,
    r.email && 'Email: ' + r.email,
    r.service && 'Service: ' + r.service,
    r.property && 'Type of space: ' + r.property,
    r.frequency && 'How often: ' + r.frequency,
    !inspection && r.quote && 'Quote: ' + r.quote
  ].filter(Boolean).join('\n');
  var notes = [
    inspection ? 'Inspection visit to see the space and give a quote.' : 'Cleaning job.',
    facts,
    r.notes && 'Notes:\n' + r.notes,
    !inspection && r.quoteNotes && 'Quote notes:\n' + r.quoteNotes,
    r.message && 'Customer message:\n' + r.message
  ].filter(Boolean).join('\n\n');

  var tz = Session.getScriptTimeZone();
  var stamp = function (d) { return Utilities.formatDate(d, tz, "yyyyMMdd'T'HHmmss"); };
  var text = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); };
  var lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mindful Natural Cleaning//Manager//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + r.id + '-' + which + '-' + stamp(start) + '@mindful-cleaning',
    'DTSTAMP:' + Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'"),
    'DTSTART:' + stamp(start),
    'DTEND:' + stamp(end),
    'SUMMARY:' + text(title),
    'LOCATION:' + text(r.address || r.area || ''),
    'DESCRIPTION:' + text(notes),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + text(title), 'TRIGGER:-P1D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + text(title), 'TRIGGER:-PT1H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ];
  // Calendar files wrap long lines at 75 characters, continuing with a space.
  return lines.map(function (line) { return line.match(/.{1,73}/g).join('\r\n '); }).join('\r\n');
}

// Compares against the MANAGER_PASSCODE script property, and locks the page for
// 15 minutes after too many wrong tries so the passcode can't be guessed.
function checkPasscode(given) {
  var expected = PropertiesService.getScriptProperties().getProperty('MANAGER_PASSCODE');
  if (!expected) return { ok: false, error: 'The manager page has not been set up yet (no MANAGER_PASSCODE).' };

  var cache = CacheService.getScriptCache();
  var wrong = Number(cache.get('wrong-passcodes') || 0);
  if (wrong >= MAX_WRONG_PASSCODES) return { ok: false, locked: true, error: 'Too many wrong passcodes. Try again in 15 minutes.' };

  if (String(given || '') !== expected) {
    cache.put('wrong-passcodes', String(wrong + 1), 900);
    return { ok: false, wrongPasscode: true, error: 'That passcode is not right.' };
  }
  return { ok: true };
}

function listRequests() {
  var tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REQUESTS.name);
  if (!tab || tab.getLastRow() < 2 || !hasCurrentLayout(tab)) return [];
  var rows = tab.getRange(2, 1, tab.getLastRow() - 1, REQUESTS.headings.length).getValues();
  var tz = Session.getScriptTimeZone();
  // Local date and time as the manager entered it, e.g. 2026-10-08T09:00.
  var local = function (d) { return d instanceof Date ? Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm") : ''; };
  var list = [];
  for (var i = rows.length - 1; i >= 0 && list.length < 500; i--) {
    var r = {};
    REQUESTS.headings.forEach(function (h, c) { r[h] = rows[i][c]; });
    if (!r['ID']) continue;
    list.push({
      id: String(r['ID']),
      status: STATUSES.indexOf(String(r['Status'])) >= 0 ? String(r['Status']) : 'New',
      received: r['Received'] instanceof Date ? r['Received'].toISOString() : '',
      name: String(r['Name']),
      phone: String(r['Phone']),
      email: String(r['Email']),
      area: String(r['Area']),
      service: String(r['Service']),
      property: String(r['Type of space']),
      frequency: String(r['How often']),
      message: String(r['Customer message']),
      address: String(r['Address']),
      notes: String(r['Notes']),
      inspectionAt: local(r['Inspection at']),
      quote: String(r['Quote']),
      quoteNotes: String(r['Quote notes']),
      jobAt: local(r['Job at']),
      jobHours: Number(r['Job hours']) || 2
    });
  }
  return list;
}

// Saves whatever the page sent for one request: any of the text fields, the two
// dates, the job length, and optionally a new status. Fields not sent are left alone.
function saveRequestChanges(p) {
  if (!p.id) return { ok: false, error: 'No request given.' };
  if (p.status && STATUSES.indexOf(p.status) < 0) return { ok: false, error: 'Unknown status.' };

  var dates = {};
  var bad = ['inspectionAt', 'jobAt'].filter(function (key) {
    if (!(key in p)) return false;
    var parsed = localDate(p[key]);
    if (parsed === null) return true;
    dates[key] = parsed;
    return false;
  });
  if (bad.length) return { ok: false, error: 'That date and time could not be read.' };

  return withLock(function () {
    var tab = requestsTab();
    var row = findRow(tab, at('ID'), String(p.id));
    if (!row) return { ok: false, error: 'That request was not found. It may have been deleted from the sheet.' };
    var set = function (heading, value) { tab.getRange(row, at(heading)).setValue(value); };

    Object.keys(EDITABLE).forEach(function (key) {
      if (key in p) set(EDITABLE[key][0], plainText(p[key], EDITABLE[key][1]));
    });
    if ('inspectionAt' in dates) set('Inspection at', dates.inspectionAt);
    if ('jobAt' in dates) set('Job at', dates.jobAt);
    if ('jobHours' in p) set('Job hours', Math.min(Math.max(Number(p.jobHours) || 2, 0.5), 12));
    if (p.status) set('Status', p.status);
    return { ok: true };
  });
}

// "2026-10-08T09:00" → a Date in the script's time zone; "" → "" (cleared);
// anything else → null (not understood).
function localDate(value) {
  if (!value) return '';
  var m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

/* ---------- reviews ---------- */

function saveReview(p) {
  var name = plainText(p.name, 80);
  var text = plainText(p.review, 1500);
  var rating = parseInt(p.rating, 10);
  if (!name || !text || !(rating >= 1 && rating <= 5)) return { ok: false, error: 'Name, rating and review are required.' };

  withLock(function () {
    var tab = reviewsTab();
    tab.appendRow([new Date(), name, rating, text, false]);
    tab.getRange(tab.getLastRow(), REVIEW_HEADINGS.length).insertCheckboxes();
  });

  var to = EMAIL_ON_NEW_REVIEW ? businessEmail() : '';
  if (to) {
    MailApp.sendEmail({
      to: to,
      name: 'Website review',
      subject: 'New review from ' + name + ' (' + rating + ' out of 5)',
      body: [
        'A new review was left on the website. It is hidden until you approve it.',
        '',
        name + ' — ' + rating + ' out of 5',
        '',
        text,
        '',
        'To show it on the website: open the sheet, go to the "' + REVIEWS_TAB + '" tab and tick the Show box on its row.',
        'To remove it: delete the row.',
        '',
        SpreadsheetApp.getActiveSpreadsheet().getUrl()
      ].join('\n')
    });
  }

  return { ok: true };
}

// Rows whose Show box is ticked, newest first.
function shownReviews() {
  var tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REVIEWS_TAB);
  if (!tab || tab.getLastRow() < 2) return [];
  var rows = tab.getRange(2, 1, tab.getLastRow() - 1, REVIEW_HEADINGS.length).getValues();
  var shown = [];
  for (var i = rows.length - 1; i >= 0 && shown.length < 200; i--) {
    var row = rows[i];
    var show = row[4] === true || /^(y|yes|true|x)$/i.test(String(row[4]).trim());
    var rating = parseInt(row[2], 10);
    var text = String(row[3]).trim();
    if (!show || !text || !(rating >= 1 && rating <= 5)) continue;
    shown.push({
      name: String(row[1]).trim() || 'Customer',
      rating: rating,
      text: text,
      date: row[0] instanceof Date ? row[0].toISOString() : ''
    });
  }
  return shown;
}

function reviewsTab() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var tab = book.getSheetByName(REVIEWS_TAB);
  if (tab) return tab;
  tab = book.insertSheet(REVIEWS_TAB, book.getSheets().length);
  tab.appendRow(REVIEW_HEADINGS);
  tab.getRange(1, 1, 1, REVIEW_HEADINGS.length).setFontWeight('bold');
  tab.setFrozenRows(1);
  tab.setColumnWidth(4, 420);
  tab.getRange('D:D').setWrap(true);
  return tab;
}

/* ---------- the Requests tab ---------- */

// Column number (1 = A) of a heading on the Requests tab.
function at(heading) {
  return REQUESTS.headings.indexOf(heading) + 1;
}

function hasCurrentLayout(tab) {
  var first = tab.getRange(1, 1, 1, REQUESTS.headings.length).getValues()[0];
  return first.join('|') === REQUESTS.headings.join('|');
}

// The Requests tab, created and styled the first time it is needed. A tab left
// over from an earlier layout is kept under another name, not overwritten.
function requestsTab() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var tab = book.getSheetByName(REQUESTS.name);
  if (tab) {
    if (hasCurrentLayout(tab)) return tab;
    tab.setName(REQUESTS.name + ' (old ' + Utilities.getUuid().slice(0, 4) + ')');
  }
  tab = book.insertSheet(REQUESTS.name, book.getSheets().length);
  tab.appendRow(REQUESTS.headings);
  // The headings are what matters; a styling hiccup must not stop a request being saved.
  try {
    styleRequestsTab(tab);
  } catch (err) {
    console.error('Could not style the Requests tab: ' + err);
  }
  return tab;
}

// The manager page is where requests are handled; the tab is a tidy record of them.
function styleRequestsTab(tab) {
  var columns = REQUESTS.headings.length;
  var rows = tab.getMaxRows();
  if (tab.getMaxColumns() > columns) tab.deleteColumns(columns + 1, tab.getMaxColumns() - columns);

  var everything = tab.getRange(1, 1, rows, columns);
  everything.setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
  tab.getBandings().forEach(function (banding) { banding.remove(); });
  everything.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
    .setHeaderRowColor('#12332a').setFirstRowColor('#ffffff').setSecondRowColor('#f2f7f1');

  tab.getRange(1, 1, 1, columns).setFontColor('#ffffff').setFontWeight('bold').setFontSize(11);
  tab.setRowHeight(1, 38);
  tab.setFrozenRows(1);
  tab.setHiddenGridlines(true);
  tab.setTabColor('#2f6f52');

  REQUESTS.headings.forEach(function (heading, i) {
    var body = tab.getRange(2, i + 1, rows - 1, 1);
    tab.setColumnWidth(i + 1, REQUESTS.widths[i]);
    if (DATE_COLUMNS.indexOf(heading) >= 0) body.setNumberFormat('mmm d, yyyy  h:mm am/pm').setHorizontalAlignment('left');
    if (WRAPPED_COLUMNS.indexOf(heading) >= 0) body.setWrap(true);
    if (heading === 'Status') body.setFontWeight('bold');
    if (heading === 'Phone') body.setNumberFormat('@');
  });
  tab.hideColumns(at('ID'));
}

// Run this by hand from the Apps Script editor (choose restyleRequestsTab, then
// Run) to re-apply the colours and column widths.
function restyleRequestsTab() {
  var tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REQUESTS.name);
  if (tab) styleRequestsTab(tab);
}

// Row number holding the given ID, or 0 when there is none.
function findRow(tab, idColumn, id) {
  var last = tab.getLastRow();
  if (last < 2) return 0;
  var ids = tab.getRange(2, idColumn, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return i + 2;
  }
  return 0;
}

/* ---------- shared ---------- */

// Runs fn while holding the script lock, so two submissions can't collide.
function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// Keeping the Email column on a tab that is not published to the web keeps the
// address out of the public copy of the sheet.
function businessEmail() {
  return sheetValue('email');
}

// First non-empty cell under the given heading, looking through every tab.
function sheetValue(heading) {
  var tabs = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var t = 0; t < tabs.length; t++) {
    var rows = tabs[t].getDataRange().getValues();
    var column = rows[0].map(function (h) { return String(h).trim().toLowerCase(); }).indexOf(heading);
    if (column < 0) continue;
    for (var i = 1; i < rows.length; i++) {
      var value = String(rows[i][column]).trim();
      if (value) return value;
    }
  }
  return '';
}

function clean(value, max) {
  return String(value || '').replace(/\r/g, '').trim().slice(0, max);
}

// For text written into the sheet: drops leading = + - @ so a cell can never be
// read as a formula.
function plainText(value, max) {
  return clean(value, max + 10).replace(/^[=+\-@\s]+/, '').slice(0, max);
}

// Makes text safe to place inside the formatted email.
function html(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function reply(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
