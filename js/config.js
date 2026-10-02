/* Site settings. Business details themselves live in the Google Sheet below —
   edit the sheet, not this file, to change the name, phone, services, areas or pictures. */
window.SITE_CONFIG = {
  // The published "back end" sheet (File > Share > Publish to web > CSV).
  sheetCsvUrl:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vT88jI1ymPw3X0sIAZA9FPd5xQ6vaMY1aJcawhDdgXzDKcESAQ7-PvZ1atSjfLmMcZlwohjqH12cdcK/pub?gid=0&single=true&output=csv',

  // Reviews. Until a Google Form is connected, the review form opens the
  // visitor's email app instead and no reviews are displayed. See README.md.
  reviews: {
    csvUrl: '',      // published CSV of the form's response sheet
    formAction: '',  // https://docs.google.com/forms/d/e/<FORM_ID>/formResponse
    fields: { name: '', rating: '', review: '' } // e.g. name: 'entry.123456789'
  },

  // Quote requests. `endpoint` is the web app URL of the Apps Script in
  // tools/quote-email.gs, which emails each request to the address in the sheet.
  // While blank, the quote form opens the visitor's email app instead. See README.md.
  quote: {
    endpoint: 'https://script.google.com/macros/s/AKfycbythYoQLQR1Y3ciYT0A73iId90ACnqaDtt2-naT41OKWl0li8tCBspt9rbF9KvhK1OIjQ/exec'
  }
};
