/**
 * Website back end — Google Apps Script.
 *
 * This does NOT run on the website. It is pasted into the back-end Google Sheet
 * (Extensions > Apps Script) and deployed as a web app. It does three things:
 *
 *   1. Quote requests: emails each one to the address under the sheet's "Email"
 *      heading. The address is read here, on Google's side.
 *   2. New reviews: saves each one as a row in the "Reviews" tab, hidden until
 *      the Show box on that row is ticked. Can also email a notice (off by default).
 *   3. Showing reviews: gives the website the rows whose Show box is ticked.
 *
 * Setup steps are in README.md.
 */

var REVIEWS_TAB = 'Reviews';
var REVIEW_HEADINGS = ['Date', 'Name', 'Rating', 'Review', 'Show'];
// Change to true to get an email each time a review is left.
var EMAIL_ON_NEW_REVIEW = false;

function doPost(e) {
  var p = (e && e.parameter) || {};

  // Hidden field that real visitors leave empty; bots tend to fill it in.
  if (p.website) return reply({ ok: true });

  return reply(p.form === 'reviews' ? saveReview(p) : sendQuote(p));
}

function doGet() {
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
  var lines = [
    'New quote request from the website',
    '',
    'Name: ' + name,
    'Phone: ' + phone,
    'Email: ' + (visitorEmail || '-'),
    'Area: ' + (clean(p.area, 80) || '-'),
    'Service: ' + (clean(p.service, 80) || '-'),
    'Type of space: ' + (clean(p.property, 40) || '-'),
    'How often: ' + (clean(p.frequency, 40) || '-'),
    '',
    'Details:',
    clean(p.details, 1500) || '-'
  ];

  var message = { to: to, subject: 'Quote request from ' + name, body: lines.join('\n'), name: 'Website quote request' };
  // Hitting Reply answers the customer directly when they left an email address.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail)) message.replyTo = visitorEmail;
  MailApp.sendEmail(message);

  return { ok: true };
}

/* ---------- reviews ---------- */

function saveReview(p) {
  var name = plainText(p.name, 80);
  var text = plainText(p.review, 1500);
  var rating = parseInt(p.rating, 10);
  if (!name || !text || !(rating >= 1 && rating <= 5)) return { ok: false, error: 'Name, rating and review are required.' };

  var tab = reviewsTab();
  tab.appendRow([new Date(), name, rating, text, false]);
  tab.getRange(tab.getLastRow(), REVIEW_HEADINGS.length).insertCheckboxes();

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

// The Reviews tab, created with its headings the first time it is needed.
function reviewsTab() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var tab = book.getSheetByName(REVIEWS_TAB);
  if (tab) return tab;
  tab = book.insertSheet(REVIEWS_TAB, book.getSheets().length);
  tab.appendRow(REVIEW_HEADINGS);
  tab.getRange(1, 1, 1, REVIEW_HEADINGS.length).setFontWeight('bold');
  tab.setFrozenRows(1);
  tab.setColumnWidth(4, 520);
  tab.getRange('D:D').setWrap(true);
  return tab;
}

/* ---------- shared ---------- */

// First non-empty cell under an "Email" heading, looking through every tab.
// Keeping the Email column on a tab that is not published to the web keeps the
// address out of the public copy of the sheet.
function businessEmail() {
  var tabs = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var t = 0; t < tabs.length; t++) {
    var rows = tabs[t].getDataRange().getValues();
    var column = rows[0].map(function (h) { return String(h).trim().toLowerCase(); }).indexOf('email');
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

function reply(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
