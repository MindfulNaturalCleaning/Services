/* Mindful Natural Cleaning — shared site script.
   Reads the business details from the Google Sheet and fills in every page. */
(() => {
  'use strict';

  const CFG = window.SITE_CONFIG || {};
  const CACHE_KEY = 'mncs-data-v1';

  // Shown instantly, and used if the sheet can't be reached.
  const FALLBACK = {
    name: 'Mindful Natural Cleaning Service',
    logo: 'https://i.imgur.com/t3ncH3u.png',
    email: '',
    phone: '(225)907-4510',
    motto: 'Where clean comes naturally. Professional, detail-oriented interior cleaning services using non-toxic cleaning solutions.',
    services: ['Non-Toxic Cleaning', 'Residential Cleaning', 'Commercial Cleaning', 'Deep Cleaning', 'Recurring Services'],
    areas: ['Baton Rouge and surrounding Areas', 'Lafayette', 'Covington', 'Clinton', 'Zachary', 'Denham', 'Walker'],
    backgrounds: [],
    gallery: []
  };

  // Used only while the sheet's "Background Pictures" column is empty.
  const STOCK_BACKGROUNDS = [
    'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=2000&q=75&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=2000&q=75&auto=format&fit=crop'
  ];

  const NAV = [
    ['index.html', 'Home'],
    ['services.html', 'Services'],
    ['about.html', 'Why Mindful'],
    ['areas.html', 'Service Areas'],
    ['gallery.html', 'Gallery'],
    ['reviews.html', 'Reviews']
  ];

  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    leaf: svg('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'),
    home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    building: svg('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>'),
    sparkles: svg('<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="m19 15 .7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>'),
    repeat: svg('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
    pin: svg('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
    phone: svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),
    mail: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    quote: svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>'),
    menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>')
  };

  // Draft descriptions, matched to the service names in the sheet by keyword.
  const SERVICE_COPY = [
    {
      match: /non.?toxic|natural|eco|green/i, icon: 'leaf',
      short: 'Every clean uses non-toxic cleaning solutions, so nothing harsh is left behind.',
      long: 'Non-toxic cleaning solutions are at the heart of everything we do. Your space gets a thorough, professional clean without the harsh chemical residue or lingering fumes of conventional products.',
      points: ['Non-toxic cleaning solutions on every visit', 'No harsh chemical smell afterwards', 'A natural fit for households that avoid strong chemicals']
    },
    {
      match: /resident|home|house|apartment/i, icon: 'home',
      short: 'Detail-oriented interior cleaning for the place you live, tailored to your routine.',
      long: 'From kitchens and bathrooms to bedrooms and living spaces, we clean your home’s interior with the attention to detail it deserves, on a plan built around how you live.',
      points: ['Interior cleaning for houses, apartments and condos', 'A plan shaped around your priorities', 'The same care in every room']
    },
    {
      match: /commerc|office|business/i, icon: 'building',
      short: 'A clean, welcoming workspace for your team and your customers.',
      long: 'First impressions matter. We keep offices and other business interiors clean and inviting, using the same non-toxic approach we bring to homes.',
      points: ['Interior cleaning for workplaces', 'Scheduling that works around your business', 'Non-toxic solutions in shared spaces']
    },
    {
      match: /deep/i, icon: 'sparkles',
      short: 'A top-to-bottom reset that reaches the spots a routine clean leaves behind.',
      long: 'When your space needs more than a tidy-up, a deep clean takes on the built-up areas that routine cleaning doesn’t reach. It’s a fresh start, and a great first visit before recurring service.',
      points: ['Extra attention to built-up areas', 'A good starting point for a new routine', 'Ideal ahead of guests or a change of season']
    },
    {
      match: /recurr|regular|weekly|routine/i, icon: 'repeat',
      short: 'Regular visits on a schedule that suits you, so your space stays consistently clean.',
      long: 'Keep things fresh without thinking about it. Recurring service puts your cleaning on a regular schedule, so you can spend your time on what matters to you.',
      points: ['A schedule that fits your routine', 'Consistent results visit after visit', 'One less thing on your to-do list']
    }
  ];
  const serviceCopy = (name) =>
    SERVICE_COPY.find((s) => s.match.test(name)) || {
      icon: 'sparkles',
      short: 'Ask us about this service and we’ll tailor it to your space.',
      long: 'Tell us what you need and we’ll put together a plan for your space. Request a free quote to get started.',
      points: []
    };

  /* ---------- helpers ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    row.push(cell);
    rows.push(row);
    return rows;
  }

  // Accepts direct image links plus Imgur page links and Google Drive share links.
  function imageUrl(raw) {
    const url = String(raw || '').trim();
    if (!/^https?:\/\//i.test(url)) return '';
    const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
    if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w2000`;
    const imgur = url.match(/^https?:\/\/(?:www\.)?imgur\.com\/(\w+)$/);
    if (imgur) return `https://i.imgur.com/${imgur[1]}.jpg`;
    try { return encodeURI(decodeURI(url)); } catch (e) { return ''; }
  }

  function sheetToData(rows) {
    const head = (rows[0] || []).map((h) => h.trim().toLowerCase());
    const col = (...keys) => head.findIndex((h) => keys.some((k) => h.includes(k)));
    const list = (i) => (i < 0 ? [] : rows.slice(1).map((r) => (r[i] || '').trim()).filter(Boolean));
    const first = (i) => list(i)[0] || '';
    const sheet = {
      name: first(col('business', 'name')),
      logo: imageUrl(first(col('logo'))),
      email: first(col('email')),
      phone: first(col('number', 'phone')),
      motto: first(col('modo', 'motto', 'slogan', 'tagline')),
      services: list(col('service')),
      areas: list(col('area')),
      backgrounds: list(col('background')).map(imageUrl).filter(Boolean),
      gallery: list(col('gallery')).map(imageUrl).filter(Boolean)
    };
    const data = { ...FALLBACK, backgrounds: sheet.backgrounds, gallery: sheet.gallery };
    for (const key of ['name', 'logo', 'email', 'phone', 'motto', 'services', 'areas']) {
      if (sheet[key] && sheet[key].length) data[key] = sheet[key];
    }
    return data;
  }

  const telHref = (phone) => {
    const digits = String(phone).replace(/\D/g, '');
    return 'tel:' + (digits.length === 10 ? '+1' + digits : digits);
  };

  const stars = (n) => {
    const full = Math.max(0, Math.min(5, Math.round(n)));
    return `<span class="stars" role="img" aria-label="${full} out of 5 stars">${'★'.repeat(full)}<span class="stars__off">${'★'.repeat(5 - full)}</span></span>`;
  };

  /* ---------- rendering ---------- */

  let data = FALLBACK;
  let reviews = [];
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const baseTitle = document.title;

  function background(i) {
    const pool = data.backgrounds.length ? data.backgrounds : STOCK_BACKGROUNDS;
    return pool[i % pool.length];
  }

  function renderHeader() {
    const host = $('#site-header');
    if (!host) return;
    const links = NAV.filter(([href]) => href !== 'gallery.html' || data.gallery.length)
      .map(([href, label]) => `<a href="${href}"${href === page ? ' class="is-active" aria-current="page"' : ''}>${label}</a>`)
      .join('');
    host.innerHTML = `
      <div class="topbar">
        <div class="wrap topbar__in">
          <span class="topbar__item">${ICONS.pin}Serving ${esc(data.areas[0] || '')}</span>
          <span class="topbar__links">
            <a href="reviews.html#leave-a-review">Leave a Review</a>
          </span>
        </div>
      </div>
      <div class="masthead">
        <div class="wrap masthead__in">
          <a class="brand" href="index.html" aria-label="${esc(data.name)} — home">
            <img src="${esc(data.logo)}" alt="${esc(data.name)}" referrerpolicy="no-referrer">
            <span class="brand__text" hidden>${esc(data.name)}</span>
          </a>
          <nav class="nav" id="site-nav" aria-label="Main">${links}</nav>
          <div class="masthead__cta">
            <a class="btn btn--primary" href="quote.html">${ICONS.quote}<span><span class="btn__long">Request a </span>Free Quote</span></a>
            <a class="phone" href="${telHref(data.phone)}" aria-label="Call ${esc(data.phone)}">${ICONS.phone}<span>${esc(data.phone)}</span></a>
            <button class="nav-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Menu">${ICONS.menu}</button>
          </div>
        </div>
      </div>`;
    // If the logo link breaks, fall back to the business name as text.
    const logo = $('.brand img', host);
    logo.addEventListener('error', () => { logo.hidden = true; $('.brand__text', host).hidden = false; });
    const toggle = $('.nav-toggle', host);
    toggle.addEventListener('click', () => {
      const open = $('#site-nav').classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  function renderFooter() {
    const host = $('#site-footer');
    if (!host) return;
    const cta = page === 'quote.html' ? '' : `
      <section class="cta-band">
        <div class="wrap cta-band__in">
          <div>
            <h2>Let us take care of the cleaning</h2>
            <p>Tell us about your space and we’ll put together a free, no-obligation quote.</p>
          </div>
          <div class="cta-band__actions">
            <a class="btn btn--light" href="quote.html">Request a Free Quote</a>
            <a class="btn btn--outline-light" href="${telHref(data.phone)}">${ICONS.phone}${esc(data.phone)}</a>
          </div>
        </div>
      </section>`;
    host.innerHTML = `${cta}
      <footer class="footer">
        <div class="wrap footer__grid">
          <div class="footer__brand">
            <a class="footer__logo" href="index.html"><img src="${esc(data.logo)}" alt="${esc(data.name)}" referrerpolicy="no-referrer"></a>
            <p>${esc(data.motto)}</p>
          </div>
          <div>
            <h3>Services</h3>
            <ul>${data.services.map((s) => `<li><a href="services.html#${slug(s)}">${esc(s)}</a></li>`).join('')}</ul>
          </div>
          <div>
            <h3>Service Areas</h3>
            <ul>${data.areas.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
          </div>
          <div>
            <h3>Contact</h3>
            <ul class="footer__contact">
              <li><a href="${telHref(data.phone)}">${ICONS.phone}${esc(data.phone)}</a></li>
              <li><a href="quote.html">${ICONS.quote}Request a free quote</a></li>
              <li><a href="reviews.html#leave-a-review">${ICONS.leaf}Leave a review</a></li>
            </ul>
          </div>
        </div>
        <div class="footer__base"><div class="wrap">© ${new Date().getFullYear()} ${esc(data.name)}. All rights reserved.</div></div>
      </footer>`;
    const logo = $('.footer__logo img', host);
    logo.addEventListener('error', () => { $('.footer__logo', host).textContent = data.name; });
  }

  function renderBindings() {
    const [tagline, ...rest] = data.motto.split(/(?<=[.!?])\s+/);
    const values = {
      name: data.name,
      motto: data.motto,
      tagline,
      mottoRest: rest.join(' ') || data.motto,
      phone: data.phone,
      primaryArea: data.areas[0] || ''
    };
    $$('[data-bind]').forEach((el) => { el.textContent = values[el.dataset.bind] ?? ''; });
    $$('[data-phone-link]').forEach((el) => { el.href = telHref(data.phone); });
    $$('[data-bg]').forEach((el) => { el.style.backgroundImage = `url("${background(Number(el.dataset.bg) || 0)}")`; });
    $$('img[data-bg-img]').forEach((el) => { el.referrerPolicy = 'no-referrer'; el.src = background(Number(el.dataset.bgImg) || 0); });
    document.title = baseTitle.replace(FALLBACK.name, data.name);
  }

  function renderLists() {
    const grid = $('#services-grid');
    if (grid) {
      grid.innerHTML = data.services.map((s) => {
        const copy = serviceCopy(s);
        return `<a class="card card--service leaf" href="services.html#${slug(s)}">
          <span class="card__icon">${ICONS[copy.icon]}</span>
          <h3>${esc(s)}</h3>
          <p>${copy.short}</p>
          <span class="card__more">Learn more ${ICONS.arrow}</span>
        </a>`;
      }).join('');
    }

    const detail = $('#services-detail');
    if (detail) {
      detail.innerHTML = data.services.map((s, i) => {
        const copy = serviceCopy(s);
        return `<article class="service-row" id="${slug(s)}">
          <div class="service-row__badge leaf">${ICONS[copy.icon]}<span>${String(i + 1).padStart(2, '0')}</span></div>
          <div class="service-row__body">
            <h2>${esc(s)}</h2>
            <p>${copy.long}</p>
            ${copy.points.length ? `<ul class="ticks">${copy.points.map((p) => `<li>${ICONS.check}${p}</li>`).join('')}</ul>` : ''}
            <a class="btn btn--primary" href="quote.html?service=${encodeURIComponent(s)}">Get a quote for ${esc(s)}</a>
          </div>
        </article>`;
      }).join('');
      if (location.hash) $(location.hash)?.scrollIntoView();
    }

    $$('[data-areas]').forEach((el) => {
      el.innerHTML = data.areas.map((a) => `<li>${ICONS.pin}${esc(a)}</li>`).join('');
    });

    const gallery = $('#gallery-grid');
    if (gallery) {
      gallery.innerHTML = data.gallery.length
        ? data.gallery.map((src, i) => `<a class="gallery__item leaf" href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="${esc(data.name)} — photo ${i + 1}" loading="lazy" referrerpolicy="no-referrer"></a>`).join('')
        : `<div class="empty leaf">${ICONS.leaf}<h3>Photos coming soon</h3><p>We’re putting together photos of our work. In the meantime, we’d be glad to tell you more.</p><a class="btn btn--primary" href="quote.html">Request a Free Quote</a></div>`;
    }

    // Keep any choice the visitor already made when the sheet data refreshes.
    const fill = (sel, items) => $$(sel).forEach((el) => {
      const keep = el.value;
      el.innerHTML = '<option value="">Select…</option>' + items.map((v) => `<option>${esc(v)}</option>`).join('');
      el.value = keep;
    });
    fill('select[name="service"]', [...data.services, 'Not sure yet']);
    fill('select[name="area"]', [...data.areas, 'Somewhere else']);
    const wanted = new URLSearchParams(location.search).get('service');
    const serviceSelect = $('select[name="service"]');
    if (wanted && serviceSelect && !serviceSelect.value && data.services.includes(wanted)) serviceSelect.value = wanted;
  }

  function renderReviews() {
    const count = reviews.length;
    const average = count ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;

    $$('[data-review-summary]').forEach((el) => {
      el.hidden = !count;
      el.innerHTML = count
        ? `<strong>${average.toFixed(1)}</strong><span class="rating__of">/5</span>${stars(average)}<a href="reviews.html">${count} customer review${count === 1 ? '' : 's'}</a>`
        : '';
    });

    $$('[data-reviews]').forEach((el) => {
      const limit = Number(el.dataset.reviews) || count;
      el.innerHTML = count
        ? reviews.slice(0, limit).map((r) => `<article class="review leaf">
            <header>
              <span class="review__avatar">${esc(r.name.charAt(0).toUpperCase())}</span>
              <div><h3>${esc(r.name)}</h3>${stars(r.rating)}</div>
            </header>
            <p>${esc(r.text)}</p>
            ${r.date ? `<time>${esc(r.date)}</time>` : ''}
          </article>`).join('')
        : `<div class="empty leaf">${ICONS.leaf}<h3>Be the first to leave a review</h3><p>Had a clean from us? We’d love to hear how it went.</p><a class="btn btn--primary" href="reviews.html#leave-a-review">Leave a Review</a></div>`;
    });
  }

  function render() {
    renderHeader();
    renderFooter();
    renderBindings();
    renderLists();
    renderReviews();
  }

  /* ---------- data loading ---------- */

  async function loadSheet() {
    if (!CFG.sheetCsvUrl) return;
    try {
      const res = await fetch(CFG.sheetCsvUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const next = sheetToData(parseCSV(await res.text()));
      if (JSON.stringify(next) !== JSON.stringify(data)) { data = next; render(); }
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch (e) { /* storage unavailable */ }
    } catch (err) {
      console.warn('Could not load the business sheet; showing saved details.', err);
    }
  }

  async function loadReviews() {
    const url = CFG.reviews && CFG.reviews.csvUrl;
    if (!url) return;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rows = parseCSV(await res.text());
      const head = rows[0].map((h) => h.trim().toLowerCase());
      const col = (...keys) => head.findIndex((h) => keys.some((k) => h.includes(k)));
      const iName = col('name'), iRating = col('rating', 'star'), iText = col('review', 'comment', 'feedback', 'experience');
      const iDate = col('timestamp', 'date'), iApproved = col('approv', 'publish', 'show');
      reviews = rows.slice(1).map((r) => {
        const when = iDate >= 0 ? new Date(r[iDate]) : null;
        return {
          name: (r[iName] || '').trim() || 'Customer',
          rating: parseInt((r[iRating] || '').match(/\d/)?.[0] || '0', 10),
          text: (r[iText] || '').trim(),
          date: when && !isNaN(when) ? when.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '',
          // With an "Approved" column in the sheet, only rows marked yes are shown.
          approved: iApproved < 0 || /^(y|yes|true|x|✓)$/i.test((r[iApproved] || '').trim())
        };
      }).filter((r) => r.approved && r.text && r.rating >= 1).reverse();
      renderReviews();
    } catch (err) {
      console.warn('Could not load reviews.', err);
    }
  }

  /* ---------- forms ---------- */

  // Sends to the connected Google Form, or opens an email draft if none is set up.
  async function send(kind, values, mail) {
    const target = CFG[kind] || {};
    if (target.formAction) {
      const body = new URLSearchParams();
      for (const [key, value] of Object.entries(values)) {
        if (target.fields[key]) body.append(target.fields[key], value);
      }
      await fetch(target.formAction, { method: 'POST', mode: 'no-cors', body });
      return 'sent';
    }
    if (!data.email) throw new Error('No email address loaded from the sheet');
    location.href = `mailto:${data.email}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`;
    return 'email';
  }

  function wireForm(id, kind, toMail, messages) {
    const form = document.getElementById(id);
    if (!form) return;
    const status = $('.form__status', form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form).entries());
      const button = $('button[type="submit"]', form);
      button.disabled = true;
      try {
        const how = await send(kind, values, toMail(values));
        status.className = 'form__status is-ok';
        status.textContent = how === 'sent' ? messages.sent : `${messages.email} If it doesn’t open, please call ${data.phone}.`;
        if (how === 'sent') form.reset();
      } catch (err) {
        status.className = 'form__status is-error';
        status.textContent = `Sorry, that didn’t go through. Please call ${data.phone}.`;
      }
      button.disabled = false;
    });
  }

  function wireForms() {
    wireForm('quote-form', 'quote', (v) => ({
      subject: `Quote request from ${v.name}`,
      body: [
        `Name: ${v.name}`, `Phone: ${v.phone}`, `Email: ${v.email || '-'}`, `Area: ${v.area || '-'}`,
        `Service: ${v.service || '-'}`, `Property: ${v.property || '-'}`, `How often: ${v.frequency || '-'}`,
        '', 'Details:', v.details || '-'
      ].join('\n')
    }), {
      sent: 'Thank you! Your request is on its way and we’ll be in touch soon.',
      email: 'Your email app should open with your request ready to send.'
    });

    wireForm('review-form', 'reviews', (v) => ({
      subject: `Review from ${v.name}`,
      body: `Name: ${v.name}\nRating: ${v.rating} out of 5\n\n${v.review}`
    }), {
      sent: 'Thank you for your review! It will appear here shortly.',
      email: 'Your email app should open with your review ready to send.'
    });
  }

  /* ---------- start ---------- */

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && cached.name) data = { ...FALLBACK, ...cached };
  } catch (e) { /* no saved copy */ }

  render();
  wireForms();
  loadSheet();
  loadReviews();
})();
