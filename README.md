# Mindful Natural Cleaning Service — website

A static website (plain HTML, CSS and JavaScript — no build step). Business
details are read live from a Google Sheet, so most updates never touch the code.

## Updating the site from the Google Sheet

Edit the sheet and the site picks up the change the next time a page loads
(Google can take a few minutes to republish). One column per item:

| Column | What it controls |
| --- | --- |
| Business Name | Name shown across the site |
| Logo | Link to the logo image (top left and footer) |
| Email | Where quote requests and reviews are sent. Not displayed on the site |
| Number | Phone number shown across the site |
| Modo | Motto. The first sentence becomes the home page headline |
| Services | One service per row. Each gets a card and a section on the Services page |
| Areas of Operation | One area per row |
| Background Pictures | Image links, one per row. The first is the home page background, the second is used on inner pages. Stock photos are used while this is empty |
| Gallery Pictures | Image links, one per row. The Gallery tab appears once there is at least one |

Picture links can be direct image links, Imgur links, or Google Drive share
links (the file must be shared as "Anyone with the link").

Service descriptions are matched to service names by keyword in `js/site.js`
(`SERVICE_COPY`). A new service with no match gets a generic description.

## Managing reviews

Reviews left on the website are saved as rows in the sheet's **Reviews** tab
(created automatically when the first review arrives). Each row has a **Show**
checkbox:

- A new review arrives with Show unticked, so it is hidden. No email is sent;
  check the Reviews tab for new rows. (Set `EMAIL_ON_NEW_REVIEW` to `true` in
  the script to get an email for each one.)
- Tick **Show** to display it on the website. Untick it to hide it again.
- Delete the row to remove the review for good.
- The text, name or rating can be edited in the sheet (for example to fix a typo).

Changes appear on the site the next time a page loads. The average rating and
review count on the site are calculated from the shown reviews only.

## The Google script (quotes and reviews)

A small Google Apps Script attached to the sheet emails quote requests to the
address in the sheet's Email column, saves new reviews and supplies the shown
reviews to the site. The email address is read on Google's side, so the website
never needs to display it.

One-time setup, done while signed in as the Google account that owns the sheet
(emails are sent from that account):

1. Open the back-end Google Sheet and choose Extensions › Apps Script.
2. Delete whatever is in the editor, paste in all of `tools/google-script.gs`,
   and save.
3. Click Deploy › New deployment. Choose type **Web app**, set "Execute as" to
   **Me** and "Who has access" to **Anyone**, then Deploy.
4. Approve the permissions Google asks for (access to the sheet and sending
   email as you).
5. Copy the web app URL (it ends in `/exec`) into `scriptUrl` in `js/config.js`.

To update the script later: paste the new version over the old one, save, then
Deploy › Manage deployments › pencil icon › Version: **New version** › Deploy.
That keeps the same URL. "New deployment" would create a different URL.

Changing the email only means editing the sheet. Google allows about 100 emails
a day on a free account. If `scriptUrl` is blank, both forms open the visitor's
email app instead.

## Files

- `index.html`, `services.html`, `about.html`, `areas.html`, `gallery.html`,
  `reviews.html`, `quote.html` — the pages
- `css/styles.css` — all styling (colors are defined at the top)
- `js/config.js` — sheet link and form settings
- `js/site.js` — loads the sheet and builds the header, footer and lists
- `tools/google-script.gs` — the Apps Script for quotes and reviews (runs in
  Google, not on the site)
- `tools/serve.js` — local preview server

## Previewing locally

Run `npm run dev` and open http://localhost:4173 (requires Node.js; nothing to
install). Opening the HTML files directly also works.
