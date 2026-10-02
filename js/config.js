/* Site settings. Business details themselves live in the Google Sheet below —
   edit the sheet, not this file, to change the name, phone, services, areas or pictures. */
window.SITE_CONFIG = {
  // The published "back end" sheet (File > Share > Publish to web > CSV).
  sheetCsvUrl:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQj2C_AvPYBcZjMU0o4yoIccHyMTUqoIMslK5Cwl8TtwXfpYe8JI0WX1lgSvanVDfJIdgSfLUKyzNUu/pub?gid=0&single=true&output=csv',

  // Reviews. Until a Google Form is connected, the review form opens the
  // visitor's email app instead and no reviews are displayed. See README.md.
  reviews: {
    csvUrl: '',      // published CSV of the form's response sheet
    formAction: '',  // https://docs.google.com/forms/d/e/<FORM_ID>/formResponse
    fields: { name: '', rating: '', review: '' } // e.g. name: 'entry.123456789'
  },

  // Quote requests. Leave blank to send them by email; fill in to collect
  // them in a Google Form/Sheet the same way as reviews.
  quote: {
    formAction: '',
    fields: { name: '', phone: '', email: '', area: '', service: '', property: '', frequency: '', details: '' }
  }
};
