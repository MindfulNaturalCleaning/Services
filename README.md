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

## Managing quote requests (manager page)

Every quote request is emailed to the address in the Email column and saved in
the sheet's **Requests** tab. The manager handles them on the private page
`manager.html` (https://mindfulnaturalcleaning.github.io/Services/manager.html),
which is not linked from the public site. On a phone it can be added to the
home screen.

- **New:** each request with Accept and Deny. Accept asks for the date and time,
  length, address and job details.
- **To-do:** accepted jobs, soonest first, with an **Add to calendar** button
  (Apple's calendar on iPhone, Google Calendar on Android, both on a computer;
  the iPhone version includes reminders a day and an hour before), Edit, and a
  checkbox to mark the job done.
- **Finished:** done and denied requests, each of which can be moved back.

The page asks for a passcode, kept in the script's Project Settings › Script
Properties as `MANAGER_PASSCODE`. Change it there at any time; anyone signed in
on a device will be asked for the new one. After 10 wrong passcodes in 15
minutes the page locks for 15 minutes.

The Requests tab is the page's storage: it can be read in the sheet, but make
changes on the manager page. Don't rename its headings or reorder its columns.
If its formatting gets messed up, run `restyleRequestsTab` from the Apps Script
editor.

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

## The Google script (quotes, manager page and reviews)

A small Google Apps Script attached to the sheet emails and saves quote requests,
answers the manager page, saves new reviews and supplies the shown reviews to
the site. The email address is read on Google's side, so the website
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
6. In Project Settings › Script Properties, add `MANAGER_PASSCODE` with the
   passcode for the manager page.

To update the script later: paste the new version over the old one, save, then
Deploy › Manage deployments › pencil icon › Version: **New version** › Deploy.
That keeps the same URL. "New deployment" would create a different URL.

Changing the email only means editing the sheet. Google allows about 100 emails
a day on a free account. If `scriptUrl` is blank, both forms open the visitor's
email app instead.

## Files

- `index.html`, `services.html`, `about.html`, `areas.html`, `gallery.html`,
  `reviews.html`, `quote.html` — the public pages
- `manager.html`, `js/manager.js` — the private manager page
- `css/styles.css` — all styling (colors are defined at the top)
- `js/config.js` — sheet link and form settings
- `js/site.js` — loads the sheet and builds the header, footer and lists
- `tools/google-script.gs` — the Apps Script for quotes, the manager page and reviews (runs in
  Google, not on the site)
- `tools/serve.js` — local preview server

## Previewing locally

Run `npm run dev` and open http://localhost:4173 (requires Node.js; nothing to
install). Opening the HTML files directly also works.
