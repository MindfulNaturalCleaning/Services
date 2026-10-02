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

## Connecting reviews (one-time setup)

Reviews are stored in a Google Form + Sheet:

1. Create a Google Form with three questions: **Your name** (short answer),
   **Your rating** (multiple choice 1–5) and **Your review** (paragraph).
2. In the form's Responses tab, link it to a Google Sheet.
3. Optional, recommended: add a column named **Approved** to that sheet. When it
   exists, only reviews marked `yes` are shown on the site.
4. Publish the response sheet: File › Share › Publish to web › CSV. Paste the
   link into `reviews.csvUrl` in `js/config.js`.
5. Fill in `reviews.formAction` and the three `entry.…` field IDs in
   `js/config.js` (found via the form's "Get pre-filled link").

Until this is done, the review form opens the visitor's email app instead and
the site shows "Be the first to leave a review".

Quote requests work the same way: they open an email to the business address
unless a Google Form is filled in under `quote` in `js/config.js`.

## Files

- `index.html`, `services.html`, `about.html`, `areas.html`, `gallery.html`,
  `reviews.html`, `quote.html` — the pages
- `css/styles.css` — all styling (colors are defined at the top)
- `js/config.js` — sheet link and form settings
- `js/site.js` — loads the sheet and builds the header, footer and lists

## Previewing locally

Run `npm run dev` and open http://localhost:4173 (requires Node.js; nothing to
install). Opening the HTML files directly also works.
