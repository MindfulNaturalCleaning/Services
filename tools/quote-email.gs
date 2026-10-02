/**
 * Quote request emailer — Google Apps Script.
 *
 * This does NOT run on the website. It is pasted into the back-end Google Sheet
 * (Extensions > Apps Script) and deployed as a web app. The website's quote form
 * posts to it, and it emails the request to the address in the sheet's Email
 * column. The address is read here, on Google's side, so visitors never see it.
 *
 * Setup steps are in README.md ("Connecting the quote form").
 */

function doPost(e) {
  var p = (e && e.parameter) || {};

  // Hidden field that real visitors leave empty; bots tend to fill it in.
  if (p.website) return reply({ ok: true });

  var name = clean(p.name, 80);
  var phone = clean(p.phone, 30);
  if (!name || !phone) return reply({ ok: false, error: 'Name and phone are required.' });

  var to = businessEmail();
  if (!to) return reply({ ok: false, error: 'No email address found in the sheet.' });

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

  return reply({ ok: true });
}

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

function reply(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
