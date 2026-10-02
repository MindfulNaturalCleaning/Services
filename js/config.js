/* Site settings. Business details themselves live in the Google Sheet below —
   edit the sheet, not this file, to change the name, phone, services, areas or pictures. */
window.SITE_CONFIG = {
  // The published "back end" sheet (File > Share > Publish to web > CSV).
  sheetCsvUrl:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vT88jI1ymPw3X0sIAZA9FPd5xQ6vaMY1aJcawhDdgXzDKcESAQ7-PvZ1atSjfLmMcZlwohjqH12cdcK/pub?gid=0&single=true&output=csv',

  // Web app URL of the Apps Script attached to the sheet (tools/google-script.gs).
  // It emails quote requests, saves new reviews and supplies the reviews to show.
  // If blank, both forms open the visitor's email app instead. See README.md.
  scriptUrl:
    'https://script.google.com/macros/s/AKfycbythYoQLQR1Y3ciYT0A73iId90ACnqaDtt2-naT41OKWl0li8tCBspt9rbF9KvhK1OIjQ/exec'
};
