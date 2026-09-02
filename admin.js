(function () {
  'use strict';

  const STORAGE = {
    DATA: 'dripp_cms_data',
    DATA_LEGACY: 'dripp_data',
    SESSION: 'dripp_session',
    HERO: 'dripp_cms_hero',
    HERO_LEGACY: 'dripp_hero',
    NEWS: 'dripp_cms_news',
    BOOKINGS: 'moon_bookings',
    REVIEWS: 'dripp_cms_reviews',
    PENDING_REVIEWS: 'dripp_cms_pending_reviews',
    SALES: 'dripp_cms_sales',
    GITHUB: 'dripp_github_config'
  };
  const CRED_USER = 'hammad';
  const CRED_PASS = 'phuddi da';
  // SHA-256 of "phuddi da" — matches /api/sync server-side hash
  const CRED_PASS_HASH = '44c0336486df4ecb6cef6e7903edc2f2d868d9bb0c5a238988aefd7c511d5be5';
  const SESSION_HOURS = 8;
  const IDLE_TIMEOUT_MIN = 30;
  const FAILED_ATTEMPTS_KEY = 'dripp_failed_attempts';
  const LOCKOUT_UNTIL_KEY = 'dripp_lockout_until';

  async function sha256Hex(str) {
    try {
      const buf = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Legacy fallback
      let h = 0;
      for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
      return 'fallback_' + Math.abs(h).toString(16);
    }
  }

  function sanitize(value) {
    if (value == null) return value;
    if (typeof value === 'string') {
      return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                  .replace(/javascript:/gi, '')
                  .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
                  .replace(/on\w+\s*=\s*'[^']*'/gi, '')
                  .trim()
                  .slice(0, 10000);
    }
    if (Array.isArray(value)) return value.map(sanitize);
    if (typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value)) out[k] = sanitize(value[k]);
      return out;
    }
    return value;
  }

  const DEFAULT_DATA = null;

  const state = {
    data: { models: [], division_b_talent: [], package_deals: [], news: [], divisions: {}, agency: {}, leadership: {}, sales: [], bookings: [], pending_reviews: [], cms_reviews: [], analytics: [] },
    heroImage: null,
    section: 'dashboard',
    editing: null
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function showToast(message, type) {
    const t = $('#drippToast');
    if (!t) return;
    t.textContent = message;
    t.className = 'dripp-toast visible ' + (type || 'info');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('visible'), 3500);
  }

  function checkAuth() {
    try {
      const raw = sessionStorage.getItem(STORAGE.SESSION);
      if (!raw) return false;
      const session = JSON.parse(raw);
      if (Date.now() > session.expires) {
        sessionStorage.removeItem(STORAGE.SESSION);
        return false;
      }
      return true;
    } catch (e) { return false; }
  }

  function startSession() {
    const session = {
      user: CRED_USER,
      role: 'admin',
      created: Date.now(),
      expires: Date.now() + (SESSION_HOURS * 60 * 60 * 1000)
    };
    try { sessionStorage.setItem(STORAGE.SESSION, JSON.stringify(session)); } catch (e) {}
  }

  function endSession() {
    try { sessionStorage.removeItem(STORAGE.SESSION); } catch (e) {}
  }

  async function fetchFromApi() {
    try {
      const res = await fetch('/api/sync?action=fetch&_=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j && j.data) return { data: j.data, sha: j.sha || null };
      }
    } catch (e) { /* fall through to data.json */ }
    return null;
  }

  async function loadData() {
    let liveData = null;
    let liveSha = null;

    // Priority 1: serverless API (reads GitHub via /api/sync)
    try {
      const fromApi = await fetchFromApi();
      if (fromApi) { liveData = fromApi.data; liveSha = fromApi.sha; }
    } catch (e) { console.warn('fetchFromApi failed:', e); }

    // Priority 2: raw data.json (Vercel-deployed)
    if (!liveData) {
      try {
        const res = await fetch('data.json?_=' + Date.now(), { cache: 'no-store' });
        if (res.ok) liveData = await res.json();
      } catch (e) {}
    }

    // Always set state.data to a safe object first
    const safeDefault = {
      models: [], division_b_talent: [], package_deals: [], news: [],
      sales: [], bookings: [], pending_reviews: [], cms_reviews: [], analytics: [],
      divisions: {}, agency: {}, leadership: {}
    };
    state.data = Object.assign({}, safeDefault, liveData || {});

    // Priority 3: LocalStorage CMS payload — only used for local edits if available
    let stored = null;
    for (const key of [STORAGE.DATA, STORAGE.DATA_LEGACY]) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          stored = JSON.parse(raw);
          if (stored && stored.savedAt && stored.payload) { stored = stored; break; }
          if (stored && !stored.savedAt) { stored = { payload: stored, savedAt: null }; break; }
        }
      } catch (e) {}
    }

    if (stored && stored.payload) {
      // Merge: live data wins for talent/packages, stored wins for local-only fields
      const merged = mergeData(stored.payload, state.data);
      state.data = Object.assign({}, safeDefault, merged);
    }

    state.dataSha = liveSha;

    if (Array.isArray(state.data.news)) {
      try {
        const newsRaw = localStorage.getItem(STORAGE.NEWS);
        if (newsRaw) {
          const newsOverride = JSON.parse(newsRaw);
          if (Array.isArray(newsOverride)) state.data.news = newsOverride;
        }
      } catch (e) {}
    }

    state.heroImage = null;
    for (const key of [STORAGE.HERO, STORAGE.HERO_LEGACY]) {
      try {
        const v = localStorage.getItem(key);
        if (v) { state.heroImage = v; break; }
      } catch (e) {}
    }

    // Final defensive: ensure all expected arrays exist
    if (!Array.isArray(state.data.models)) state.data.models = [];
    if (!Array.isArray(state.data.division_b_talent)) state.data.division_b_talent = [];
    if (!Array.isArray(state.data.package_deals)) state.data.package_deals = [];
    if (!Array.isArray(state.data.news)) state.data.news = [];
    if (!Array.isArray(state.data.sales)) state.data.sales = [];
    if (!Array.isArray(state.data.bookings)) state.data.bookings = [];
    if (!Array.isArray(state.data.pending_reviews)) state.data.pending_reviews = [];
    if (!Array.isArray(state.data.cms_reviews)) state.data.cms_reviews = [];
    if (!Array.isArray(state.data.analytics)) state.data.analytics = [];
  }

  function mergeData(stored, live) {
    if (!live) return stored;
    // Live data is the source of truth for published content.
    // Stored (LocalStorage) takes precedence for sales/cms_reviews if they exist locally.
    return {
      ...live,
      ...(stored || {}),
      models: (live.models && live.models.length > 0) ? live.models : ((stored && stored.models) || []),
      division_b_talent: (live.division_b_talent && live.division_b_talent.length > 0) ? live.division_b_talent : ((stored && stored.division_b_talent) || []),
      package_deals: (live.package_deals && live.package_deals.length > 0) ? live.package_deals : ((stored && stored.package_deals) || []),
      news: (live.news && live.news.length > 0) ? live.news : ((stored && stored.news) || [])
    };
  }

  function saveData() {
    const payload = JSON.stringify({
      payload: state.data,
      savedAt: Date.now()
    });
    try { localStorage.setItem(STORAGE.DATA, payload); } catch (e) {}
    try { localStorage.setItem(STORAGE.DATA_LEGACY, payload); } catch (e) {}
    try {
      if (Array.isArray(state.data.news)) {
        localStorage.setItem(STORAGE.NEWS, JSON.stringify(state.data.news));
      }
    } catch (e) {}
  }

  function saveHero() {
    try {
      if (state.heroImage) {
        localStorage.setItem(STORAGE.HERO, state.heroImage);
        localStorage.setItem(STORAGE.HERO_LEGACY, state.heroImage);
      } else {
        localStorage.removeItem(STORAGE.HERO);
        localStorage.removeItem(STORAGE.HERO_LEGACY);
      }
    } catch (e) {}
  }

  function showLogin() {
    $('#loginView').style.display = 'flex';
    $('#dashboardView').setAttribute('hidden', '');
  }

  function showDashboard() {
    $('#loginView').style.display = 'none';
    $('#dashboardView').removeAttribute('hidden');
    if (!state.data || typeof state.data !== 'object') {
      state.data = { models: [], division_b_talent: [], package_deals: [], news: [], divisions: {}, agency: {}, leadership: {} };
    }
    if (!Array.isArray(state.data.models)) state.data.models = [];
    if (!Array.isArray(state.data.division_b_talent)) state.data.division_b_talent = [];
    if (!Array.isArray(state.data.package_deals)) state.data.package_deals = [];
    if (!Array.isArray(state.data.news)) state.data.news = [];
    if (!Array.isArray(state.data.sales)) state.data.sales = [];
    if (!Array.isArray(state.data.bookings)) state.data.bookings = [];
    if (!Array.isArray(state.data.pending_reviews)) state.data.pending_reviews = [];
    if (!Array.isArray(state.data.cms_reviews)) state.data.cms_reviews = [];
    if (!Array.isArray(state.data.analytics)) state.data.analytics = [];
    updateCounts();
    renderSection('dashboard');
  }

  function setupLogin() {
    const form = $('#loginForm');
    const error = $('#loginError');
    const toggle = $('#togglePass');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.classList.remove('visible');
      const user = $('#loginUser').value.trim();
      const pass = $('#loginPass').value;

      const lockoutUntil = parseInt(localStorage.getItem(LOCKOUT_UNTIL_KEY) || '0', 10);
      if (lockoutUntil && Date.now() < lockoutUntil) {
        const wait = Math.ceil((lockoutUntil - Date.now()) / 60000);
        error.textContent = 'Too many failed attempts. Try again in ' + wait + ' min.';
        error.classList.add('visible');
        return;
      }

      const passHash = await sha256Hex(pass);
      if (user === CRED_USER && passHash === CRED_PASS_HASH) {
        localStorage.removeItem(FAILED_ATTEMPTS_KEY);
        localStorage.removeItem(LOCKOUT_UNTIL_KEY);
        startSession();
        showLogin();
        showToast('Welcome back, ' + CRED_USER + '! Loading dashboard…', 'success');
        try {
          await loadData();
        } catch (e) { console.error('loadData failed:', e); }
        showDashboard();
      } else {
        const failed = parseInt(localStorage.getItem(FAILED_ATTEMPTS_KEY) || '0', 10) + 1;
        localStorage.setItem(FAILED_ATTEMPTS_KEY, String(failed));
        if (failed >= 5) {
          const until = Date.now() + 15 * 60 * 1000;
          localStorage.setItem(LOCKOUT_UNTIL_KEY, String(until));
          error.textContent = 'Too many failed attempts. Locked for 15 minutes.';
        } else {
          error.textContent = 'Invalid credentials. ' + (5 - failed) + ' attempt(s) left.';
        }
        error.classList.add('visible');
      }
    });

    toggle.addEventListener('click', () => {
      const passInput = $('#loginPass');
      const icon = toggle.querySelector('i');
      if (passInput.type === 'password') {
        passInput.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        passInput.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
      }
    });
  }

  // Idle-timeout watchdog
  function setupIdleWatchdog() {
    let lastActivity = Date.now();
    const reset = () => { lastActivity = Date.now(); };
    ['click','keydown','mousemove','touchstart'].forEach(ev => document.addEventListener(ev, reset, { passive: true }));
    setInterval(() => {
      if (!document.body.classList.contains('modal-open') && Date.now() - lastActivity > IDLE_TIMEOUT_MIN * 60 * 1000) {
        const isAuthed = document.getElementById('dashboardView') && !document.getElementById('dashboardView').hasAttribute('hidden');
        if (isAuthed) {
          endSession();
          showLogin();
          showToast('Session timed out after ' + IDLE_TIMEOUT_MIN + ' min of inactivity.', 'info');
        }
      }
    }, 30 * 1000);
  }

  function setupLogout() {
    $('#logoutBtn').addEventListener('click', () => {
      endSession();
      showLogin();
      $('#loginUser').value = '';
      $('#loginPass').value = '';
      showToast('Signed out.', 'info');
    });
  }

  function setupNav() {
    $$('.dripp-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.dripp-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.section = btn.dataset.section;
        renderSection(state.section);
        if (window.innerWidth <= 900) $('.dripp-sidebar').classList.remove('open');
      });
    });

    $('#mobileToggle').addEventListener('click', () => {
      $('.dripp-sidebar').classList.toggle('open');
    });
  }
  function updateCounts() {
    $('#countA').textContent = (state.data.models || []).length;
    $('#countB').textContent = (state.data.division_b_talent || []).length;
    $('#countP').textContent = (state.data.package_deals || []).length;
    $('#countN').textContent = (state.data.news || []).length;
    const liveBookings = readBookings();
    $('#countBk').textContent = liveBookings.length;
    const cmsReviews = readCmsReviews();
    $('#countRv').textContent = cmsReviews.length;
    $('#countSales').textContent = readSales().length;
    $('#countPending').textContent = readPendingReviews().length;
  }

  function readCmsReviews() {
    try {
      const raw = localStorage.getItem('dripp_cms_reviews');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return (state.data && Array.isArray(state.data.cms_reviews)) ? state.data.cms_reviews : [];
  }

  function persistCmsReviews(reviews) {
    try {
      localStorage.setItem('dripp_cms_reviews', JSON.stringify(reviews));
      state.data.cms_reviews = reviews;
    } catch (e) {}
  }

  function readBookings() {
    try {
      const raw = localStorage.getItem(STORAGE.BOOKINGS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function persistBookings(bookings) {
    try { localStorage.setItem(STORAGE.BOOKINGS, JSON.stringify(bookings)); } catch (e) {}
  }

  function setTitle(text) {
    const titleMap = {
      'dashboard': 'Dashboard',
      'talent-a': 'Division A Talent',
      'talent-b': 'Division B Talent',
      'packages': 'Package Deals',
      'hero': 'Hero & Banner',
      'news': 'News Publisher',
      'bookings': 'Bookings & Inquiry Log',
      'pos': 'POS & Sales Terminal',
      'pending': 'Pending Public Reviews',
      'reviews-mgr': 'Reviews & Comments',
      'contact': 'Contact Info',
      'site-content': 'Site Content (Hero/Footer)',
      'github-sync': 'GitHub Auto-Sync',
      'settings': 'Settings'
    };
    $('#pageTitle').textContent = titleMap[text] || 'Dashboard';
  }

  function renderSection(section) {
    setTitle(section);
    const content = $('#drippContent');
    content.innerHTML = '';
    if (!state.data || typeof state.data !== 'object') {
      content.innerHTML = '<div class="dripp-empty"><i class="fas fa-spinner fa-spin"></i><p>Loading data…</p></div>';
      loadData().then(() => { updateCounts(); renderSection(section); }).catch(e => {
        content.innerHTML = '<div class="dripp-empty"><i class="fas fa-exclamation-triangle"></i><p>Failed to load data. <button class="dripp-btn" id="retryLoadBtn">Retry</button></p></div>';
        const btn = document.getElementById('retryLoadBtn');
        if (btn) btn.addEventListener('click', () => renderSection(section));
      });
      return;
    }
    try {
      switch (section) {
        case 'dashboard': renderDashboard(content); break;
        case 'talent-a': renderTalentManager(content, 'a'); break;
        case 'talent-b': renderTalentManager(content, 'b'); break;
        case 'packages': renderPackagesManager(content); break;
        case 'hero': renderHeroManager(content); break;
        case 'news': renderNewsManager(content); break;
        case 'bookings': renderBookingsManager(content); break;
        case 'pos': renderPos(content); break;
        case 'pending': renderPendingReviews(content); break;
        case 'reviews-mgr': renderReviewsManager(content); break;
        case 'contact': renderContactManager(content); break;
        case 'site-content': renderSiteContentManager(content); break;
        case 'github-sync': renderGithubSync(content); break;
        case 'settings': renderSettings(content); break;
        default: content.innerHTML = '<div class="dripp-empty"><i class="fas fa-question"></i><p>Unknown section: ' + escapeHtml(section) + '</p></div>';
      }
    } catch (err) {
      console.error('renderSection ' + section + ' failed:', err);
      content.innerHTML = '<div class="dripp-empty"><i class="fas fa-exclamation-triangle"></i><p><strong>Render error:</strong> ' + escapeHtml(err.message || String(err)) + '</p><button class="dripp-btn" id="retryRenderBtn">Retry</button></div>';
      const btn = document.getElementById('retryRenderBtn');
      if (btn) btn.addEventListener('click', () => renderSection(section));
    }
  }

  // DASHBOARD
  function renderDashboard(root) {
    const totalA = (state.data.models || []).length;
    const totalB = (state.data.division_b_talent || []).length;
    const totalP = (state.data.package_deals || []).length;
    const totalN = (state.data.news || []).length;
    const totalBk = readBookings().length;
    root.innerHTML = `
      <div class="dripp-stats">
        <div class="dripp-stat">
          <i class="fas fa-user-astronaut"></i>
          <div><div class="dripp-stat-value">${totalA}</div><div class="dripp-stat-label">Division A Talent</div></div>
        </div>
        <div class="dripp-stat gold">
          <i class="fas fa-user-tie"></i>
          <div><div class="dripp-stat-value">${totalB}</div><div class="dripp-stat-label">Division B Talent</div></div>
        </div>
        <div class="dripp-stat green">
          <i class="fas fa-box-open"></i>
          <div><div class="dripp-stat-value">${totalP}</div><div class="dripp-stat-label">Package Deals</div></div>
        </div>
        <div class="dripp-stat blue">
          <i class="fas fa-newspaper"></i>
          <div><div class="dripp-stat-value">${totalN}</div><div class="dripp-stat-label">News Posts</div></div>
        </div>
        <div class="dripp-stat" style="border-color: rgba(233, 69, 96, 0.4);">
          <i class="fas fa-calendar-check"></i>
          <div><div class="dripp-stat-value">${totalBk}</div><div class="dripp-stat-label">Bookings</div></div>
        </div>
      </div>

      <div class="dripp-panel" id="analyticsPanel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-chart-line"></i> Live Traffic Analytics</h2>
          <div class="dripp-panel-actions">
            <button class="dripp-btn dripp-btn-sm" id="refreshAnalyticsBtn"><i class="fas fa-rotate"></i> Refresh</button>
          </div>
        </div>
        <p style="color:var(--d-text-soft);font-size:0.85rem;margin-bottom:1rem;">
          Pageviews, talent clicks, and package views are logged via the public site and stored in <code>data.json</code> via <code>/api/sync</code>.
        </p>
        <div id="analyticsContent">
          <div class="dripp-empty"><i class="fas fa-spinner fa-spin"></i><p>Loading analytics…</p></div>
        </div>
      </div>

      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-bolt"></i> Quick Actions</h2>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.75rem;">
          <button class="dripp-btn dripp-btn-primary" data-go="talent-a"><i class="fas fa-plus"></i> Add Division A Talent</button>
          <button class="dripp-btn dripp-btn-gold" data-go="talent-b"><i class="fas fa-plus"></i> Add Division B Talent</button>
          <button class="dripp-btn" data-go="packages"><i class="fas fa-plus"></i> New Package Deal</button>
          <button class="dripp-btn" data-go="news"><i class="fas fa-bullhorn"></i> Publish News</button>
          <button class="dripp-btn" data-go="hero"><i class="fas fa-image"></i> Update Hero Image</button>
          <button class="dripp-btn" data-go="bookings" style="background:rgba(233,69,96,0.18);border-color:rgba(233,69,96,0.4);"><i class="fas fa-calendar-check"></i> View Bookings (${totalBk})</button>
          <button class="dripp-btn" data-go="contact"><i class="fas fa-address-book"></i> Edit Contact Info</button>
        </div>
      </div>

      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-circle-info"></i> About Dripp</h2>
        </div>
        <p style="color:var(--d-text-soft);line-height:1.6;margin:0;">
          Dripp is a zero-dependency CMS for Moon Enterprises. All edits are persisted to LocalStorage instantly
          and reflect on the public site when the data is synced. Use Settings → "Export data.json" to
          download the merged data, then commit it to the repository for the live site to pick up changes.
        </p>
      </div>
    `;
    $$('[data-go]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.go;
        const navBtn = $('.dripp-nav-btn[data-section="' + target + '"]');
        if (navBtn) navBtn.click();
      });
    });
    const refreshBtn = $('#refreshAnalyticsBtn', root);
    if (refreshBtn) refreshBtn.addEventListener('click', loadAndRenderAnalytics);
    loadAndRenderAnalytics();
  }

  async function loadAndRenderAnalytics() {
    const container = document.getElementById('analyticsContent');
    if (!container) return;
    const data = await loadAnalytics();
    if (!data) { container.innerHTML = '<div class="dripp-empty"><i class="fas fa-exclamation-triangle"></i><p>Analytics not yet available. Public site visits will start logging here.</p></div>'; return; }
    const recent = (data.recent || []).slice(0, 10);
    container.innerHTML = `
      <div class="dripp-stats">
        <div class="dripp-stat"><i class="fas fa-eye"></i><div><div class="dripp-stat-value">${data.pageviews || 0}</div><div class="dripp-stat-label">Pageviews</div></div></div>
        <div class="dripp-stat gold"><i class="fas fa-mouse-pointer"></i><div><div class="dripp-stat-value">${data.talentClicks || 0}</div><div class="dripp-stat-label">Talent Clicks</div></div></div>
        <div class="dripp-stat green"><i class="fas fa-box"></i><div><div class="dripp-stat-value">${data.packageViews || 0}</div><div class="dripp-stat-label">Package Views</div></div></div>
        <div class="dripp-stat blue"><i class="fas fa-bolt"></i><div><div class="dripp-stat-value">${data.last24h || 0}</div><div class="dripp-stat-label">Last 24h</div></div></div>
        <div class="dripp-stat" style="border-color: rgba(233, 69, 96, 0.4);"><i class="fas fa-database"></i><div><div class="dripp-stat-value">${data.total || 0}</div><div class="dripp-stat-label">All Events</div></div></div>
      </div>
      <h3 style="font-size:0.95rem;margin:1rem 0 0.5rem;color:var(--d-text-soft);text-transform:uppercase;letter-spacing:0.05em;">Recent Activity</h3>
      <div class="dripp-table-wrap"><table class="dripp-table"><thead><tr><th>Type</th><th>Path</th><th>Label</th><th>Time</th></tr></thead><tbody>
        ${recent.map(r => `<tr>
          <td><span class="dripp-badge ${r.type === 'talent-click' ? 'pink' : (r.type === 'package-view' ? 'green' : 'blue')}">${escapeHtml(r.type || 'pageview')}</span></td>
          <td>${escapeHtml(r.path || '')}</td>
          <td>${escapeHtml(r.label || '')}</td>
          <td>${new Date(r.ts).toLocaleString()}</td>
        </tr>`).join('')}
      </tbody></table></div>
    `;
  }

  // TALENT MANAGER
  function renderTalentManager(root, division) {
    const isA = division === 'a';
    const list = isA ? (state.data.models || []) : (state.data.division_b_talent || []);
    const title = isA ? 'Division A — Moon Talent' : 'Division B — Ali Hamza Talent';
    const waNumber = isA ? state.data.divisions?.division_a?.whatsappNumber : state.data.divisions?.division_b?.whatsappNumber;

    root.innerHTML = `
      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-${isA ? 'user-astronaut' : 'user-tie'}"></i> ${title}</h2>
          <div class="dripp-panel-actions">
            <span class="dripp-badge ${isA ? 'pink' : 'gold'}">${isA ? 'Moon: ' : 'Ali Hamza: '}${waNumber || '—'}</span>
            <button class="dripp-btn dripp-btn-primary" id="addTalentBtn"><i class="fas fa-plus"></i> Add Talent</button>
          </div>
        </div>
        ${list.length === 0 ? `
          <div class="dripp-empty">
            <i class="fas fa-folder-open"></i>
            <p>No talent in this division yet. Click "Add Talent" to create one.</p>
          </div>
        ` : `
          <div class="dripp-table-wrap">
            <table class="dripp-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Specialty</th>
                  <th>Pricing</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map((m, i) => `
                  <tr>
                    <td><img src="${escapeHtml(m.image || '')}" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=utf-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 44%22><rect width=%2244%22 height=%2244%22 fill=%22%23262a52%22/><text x=%2250%25%22 y=%2250%25%22 font-size=%2214%22 fill=%22%239aa0bc%22 text-anchor=%22middle%22 dy=%22.3em%22>${escapeHtml((m.name||'?').charAt(0).toUpperCase())}</text></svg>'" alt=""></td>
                    <td><strong>${escapeHtml(m.name || '—')}</strong><br><small style="color:var(--d-text-soft)">${escapeHtml(m.category || '')}</small></td>
                    <td>${escapeHtml((m.specialty || '').split('/')[0].trim().slice(0, 60))}</td>
                    <td>${escapeHtml(m.pricing || '—')}</td>
                    <td>${escapeHtml(m.location || '—')}</td>
                    <td class="dripp-actions-cell">
                      <button class="dripp-btn dripp-btn-sm" data-action="edit" data-i="${i}"><i class="fas fa-pen"></i></button>
                      <button class="dripp-btn dripp-btn-sm dripp-btn-danger" data-action="delete" data-i="${i}"><i class="fas fa-trash"></i></button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    $('#addTalentBtn', root).addEventListener('click', () => openTalentModal(division, null));
    $$('[data-action="edit"]', root).forEach(b => b.addEventListener('click', () => {
      openTalentModal(division, parseInt(b.dataset.i, 10));
    }));
    $$('[data-action="delete"]', root).forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.i, 10);
      const name = list[i].name;
      if (confirm('Delete ' + name + '? This cannot be undone (in-session).')) {
        list.splice(i, 1);
        saveData();
        updateCounts();
        renderTalentManager(root, division);
        showToast('Deleted ' + name, 'info');
      }
    }));
  }

  function openTalentModal(division, index) {
    const isA = division === 'a';
    const list = isA ? state.data.models : state.data.division_b_talent;
    const model = index != null ? { ...list[index] } : {
      id: isA ? Math.max(0, ...list.map(m => Number(m.id) || 0)) + 1 : 'b' + (list.length + 1),
      name: '', category: '', specialty: '', bio: '', pricing: '',
      image: '', age: '', height: '', weight: '', waist: '',
      occupation: '', location: 'Old Mandi Pattoki'
    };
    const editing = index != null;

    const modal = document.createElement('div');
    modal.className = 'dripp-modal open';
    modal.innerHTML = `
      <div class="dripp-modal-card">
        <div class="dripp-modal-head">
          <h2>${editing ? 'Edit' : 'Add'} ${isA ? 'Division A' : 'Division B'} Talent</h2>
          <button class="dripp-modal-close" data-close><i class="fas fa-times"></i></button>
        </div>
        <div class="dripp-modal-body">
          <form id="talentForm" class="dripp-form-grid">
            <label class="dripp-field"><span>Name *</span>
              <div class="dripp-input-wrap"><i class="fas fa-user"></i>
                <input type="text" name="name" required value="${escapeHtml(model.name || '')}">
              </div>
            </label>
            <label class="dripp-field"><span>Category</span>
              <div class="dripp-input-wrap"><i class="fas fa-tag"></i>
                <input type="text" name="category" value="${escapeHtml(model.category || '')}" placeholder="e.g. Runway Model">
              </div>
            </label>
            <label class="dripp-field dripp-form-full"><span>Specialty</span>
              <div class="dripp-input-wrap"><i class="fas fa-star"></i>
                <input type="text" name="specialty" value="${escapeHtml(model.specialty || '')}" placeholder="English / اردو">
              </div>
            </label>
            <label class="dripp-field dripp-form-full"><span>Bio</span>
              <div class="dripp-input-wrap"><i class="fas fa-quote-left"></i>
                <textarea name="bio" rows="2">${escapeHtml(model.bio || '')}</textarea>
              </div>
            </label>
            <label class="dripp-field"><span>Pricing</span>
              <div class="dripp-input-wrap"><i class="fas fa-tag"></i>
                <input type="text" name="pricing" value="${escapeHtml(model.pricing || '')}" placeholder="PKR 5,000 / Session">
              </div>
            </label>
            <label class="dripp-field"><span>Age</span>
              <div class="dripp-input-wrap"><i class="fas fa-birthday-cake"></i>
                <input type="number" name="age" min="0" value="${escapeHtml(model.age || '')}">
              </div>
            </label>
            <label class="dripp-field"><span>Height</span>
              <div class="dripp-input-wrap"><i class="fas fa-ruler-vertical"></i>
                <input type="text" name="height" value="${escapeHtml(model.height || '')}" placeholder="5'6">
              </div>
            </label>
            <label class="dripp-field"><span>Weight</span>
              <div class="dripp-input-wrap"><i class="fas fa-weight"></i>
                <input type="text" name="weight" value="${escapeHtml(model.weight || '')}" placeholder="52 kg">
              </div>
            </label>
            <label class="dripp-field"><span>Waist</span>
              <div class="dripp-input-wrap"><i class="fas fa-arrows-alt-h"></i>
                <input type="text" name="waist" value="${escapeHtml(model.waist || '')}" placeholder='28"'>
              </div>
            </label>
            <label class="dripp-field"><span>Occupation</span>
              <div class="dripp-input-wrap"><i class="fas fa-briefcase"></i>
                <input type="text" name="occupation" value="${escapeHtml(model.occupation || '')}">
              </div>
            </label>
            <label class="dripp-field"><span>Location</span>
              <div class="dripp-input-wrap"><i class="fas fa-map-marker-alt"></i>
                <input type="text" name="location" value="${escapeHtml(model.location || 'Old Mandi Pattoki')}">
              </div>
            </label>
            <div class="dripp-form-full">
              <span style="display:block;font-size:0.8rem;color:var(--d-text-soft);font-weight:600;margin-bottom:0.4rem;">Image</span>
              <label class="dripp-upload" id="imageUpload">
                <i class="fas fa-cloud-upload-alt"></i>
                <p><strong>Click to upload</strong> or paste a path</p>
                <p style="font-size:0.75rem">JPG, PNG, SVG, WebP • stored as Base64</p>
                <input type="file" accept="image/*" id="imageFile">
                <input type="hidden" name="image" id="imageData" value="${escapeHtml(model.image || '')}">
                <input type="text" id="imagePath" placeholder="or paste path: assets/images/photo.jpg" value="${model.image && !String(model.image).startsWith('data:') ? escapeHtml(model.image) : ''}" style="margin-top:0.5rem;width:100%;padding:0.5rem;background:var(--d-bg);border:1px solid var(--d-border);border-radius:6px;color:var(--d-text);">
              </label>
              <img id="imagePreview" class="dripp-upload-preview" src="${escapeHtml(model.image || '')}" alt="">
            </div>
          </form>
        </div>
        <div class="dripp-modal-foot">
          <button class="dripp-btn dripp-btn-ghost" data-close>Cancel</button>
          <button class="dripp-btn dripp-btn-primary" id="saveTalentBtn"><i class="fas fa-save"></i> ${editing ? 'Save Changes' : 'Add Talent'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const preview = $('#imagePreview', modal);
    const fileInput = $('#imageFile', modal);
    const pathInput = $('#imagePath', modal);
    const dataInput = $('#imageData', modal);
    const updatePreview = (src) => {
      if (src) { preview.src = src; preview.classList.add('visible'); }
      else { preview.classList.remove('visible'); }
    };
    if (model.image) updatePreview(model.image);

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        dataInput.value = ev.target.result;
        pathInput.value = '';
        updatePreview(ev.target.result);
      };
      reader.readAsDataURL(file);
    });
    pathInput.addEventListener('input', () => {
      if (pathInput.value) {
        dataInput.value = pathInput.value;
        updatePreview(pathInput.value);
      }
    });

    $$('[data-close]', modal).forEach(el => el.addEventListener('click', () => modal.remove()));
    $('#saveTalentBtn', modal).addEventListener('click', () => {
      const form = $('#talentForm', modal);
      const fd = new FormData(form);
      const name = String(fd.get('name') || '').trim();
      if (!name) { showToast('Name is required.', 'error'); return; }
      const updated = {
        id: model.id,
        name,
        category: String(fd.get('category') || '').trim(),
        specialty: String(fd.get('specialty') || '').trim(),
        bio: String(fd.get('bio') || '').trim(),
        pricing: String(fd.get('pricing') || '').trim(),
        image: String(dataInput.value || '').trim(),
        age: fd.get('age') ? Number(fd.get('age')) : '',
        height: String(fd.get('height') || '').trim(),
        weight: String(fd.get('weight') || '').trim(),
        waist: String(fd.get('waist') || '').trim(),
        occupation: String(fd.get('occupation') || '').trim(),
        location: String(fd.get('location') || 'Old Mandi Pattoki').trim()
      };
      if (editing) list[index] = updated;
      else list.push(updated);
      saveData();
      updateCounts();
      commitAndToast('chore(cms): ' + (editing ? 'update talent ' + name : 'add talent ' + name));
      modal.remove();
      renderTalentManager($('#drippContent'), division);
      showToast(editing ? 'Updated ' + name : 'Added ' + name, 'success');
    });
  }

  // PACKAGES
  function renderPackagesManager(root) {
    const list = state.data.package_deals || [];
    root.innerHTML = `
      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-box-open"></i> Package Deals</h2>
          <div class="dripp-panel-actions">
            <button class="dripp-btn dripp-btn-primary" id="addPkgBtn"><i class="fas fa-plus"></i> New Package</button>
          </div>
        </div>
        ${list.length === 0 ? `
          <div class="dripp-empty"><i class="fas fa-box-open"></i><p>No package deals yet.</p></div>
        ` : `
          <div class="dripp-table-wrap">
            <table class="dripp-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Division</th>
                  <th>Original</th>
                  <th>Discounted</th>
                  <th>Badge</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map((p, i) => `
                  <tr>
                    <td><strong>${escapeHtml(p.title || '—')}</strong><br><small style="color:var(--d-text-soft)">${escapeHtml((p.description || '').slice(0, 60))}…</small></td>
                    <td><span class="dripp-badge ${p.division === 'division_b' ? 'gold' : 'pink'}">${p.division === 'division_b' ? 'Ali Hamza' : 'Moon'}</span></td>
                    <td><s>${escapeHtml(p.originalPrice || '')}</s></td>
                    <td><strong>${escapeHtml(p.discountedPrice || '')}</strong></td>
                    <td>${p.badge ? `<span class="dripp-badge green">${escapeHtml(p.badge)}</span>` : '—'}</td>
                    <td class="dripp-actions-cell">
                      <button class="dripp-btn dripp-btn-sm" data-action="edit" data-i="${i}"><i class="fas fa-pen"></i></button>
                      <button class="dripp-btn dripp-btn-sm dripp-btn-danger" data-action="delete" data-i="${i}"><i class="fas fa-trash"></i></button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
    $('#addPkgBtn', root).addEventListener('click', () => openPackageModal(null));
    $$('[data-action="edit"]', root).forEach(b => b.addEventListener('click', () => openPackageModal(parseInt(b.dataset.i, 10))));
    $$('[data-action="delete"]', root).forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.i, 10);
      if (confirm('Delete package "' + list[i].title + '"?')) {
        list.splice(i, 1);
        saveData();
        updateCounts();
        renderPackagesManager(root);
        showToast('Package deleted.', 'info');
      }
    }));
  }

  function openPackageModal(index) {
    const list = state.data.package_deals || [];
    const p = index != null ? { ...list[index], collageImages: [...(list[index].collageImages || [])] } : {
      id: 'deal_' + Date.now(),
      division: 'division_a',
      title: '', titleUr: '',
      description: '',
      originalPrice: '', discountedPrice: '',
      collageImages: [],
      targetManager: 'moon',
      badge: ''
    };
    const editing = index != null;
    const modal = document.createElement('div');
    modal.className = 'dripp-modal open';
    modal.innerHTML = `
      <div class="dripp-modal-card">
        <div class="dripp-modal-head">
          <h2>${editing ? 'Edit' : 'New'} Package Deal</h2>
          <button class="dripp-modal-close" data-close><i class="fas fa-times"></i></button>
        </div>
        <div class="dripp-modal-body">
          <form id="pkgForm" class="dripp-form-grid">
            <label class="dripp-field"><span>Title (EN) *</span>
              <div class="dripp-input-wrap"><i class="fas fa-box"></i>
                <input type="text" name="title" required value="${escapeHtml(p.title || '')}">
              </div>
            </label>
            <label class="dripp-field"><span>Title (Urdu)</span>
              <div class="dripp-input-wrap"><i class="fas fa-language"></i>
                <input type="text" name="titleUr" value="${escapeHtml(p.titleUr || '')}">
              </div>
            </label>
            <label class="dripp-field dripp-form-full"><span>Description (English / اردو)</span>
              <div class="dripp-input-wrap"><i class="fas fa-quote-left"></i>
                <textarea name="description" rows="2">${escapeHtml(p.description || '')}</textarea>
              </div>
            </label>
            <label class="dripp-field"><span>Original Price</span>
              <div class="dripp-input-wrap"><i class="fas fa-tag"></i>
                <input type="text" name="originalPrice" value="${escapeHtml(p.originalPrice || '')}" placeholder="10,000 PKR">
              </div>
            </label>
            <label class="dripp-field"><span>Discounted Price</span>
              <div class="dripp-input-wrap"><i class="fas fa-tag"></i>
                <input type="text" name="discountedPrice" value="${escapeHtml(p.discountedPrice || '')}" placeholder="7,500 PKR">
              </div>
            </label>
            <label class="dripp-field"><span>Division</span>
              <div class="dripp-input-wrap"><i class="fas fa-users"></i>
                <select name="division">
                  <option value="division_a" ${p.division === 'division_a' ? 'selected' : ''}>Division A (Moon)</option>
                  <option value="division_b" ${p.division === 'division_b' ? 'selected' : ''}>Division B (Ali Hamza)</option>
                </select>
              </div>
            </label>
            <label class="dripp-field"><span>Target Manager</span>
              <div class="dripp-input-wrap"><i class="fas fa-user-tie"></i>
                <select name="targetManager">
                  <option value="moon" ${p.targetManager === 'moon' ? 'selected' : ''}>Moon (923147553161)</option>
                  <option value="ali_hamza" ${p.targetManager === 'ali_hamza' ? 'selected' : ''}>Ali Hamza (923036800682)</option>
                </select>
              </div>
            </label>
            <label class="dripp-field"><span>Badge</span>
              <div class="dripp-input-wrap"><i class="fas fa-award"></i>
                <input type="text" name="badge" value="${escapeHtml(p.badge || '')}" placeholder="Best Value, Hot Deal…">
              </div>
            </label>
            <div class="dripp-form-full">
              <span style="display:block;font-size:0.8rem;color:var(--d-text-soft);font-weight:600;margin-bottom:0.5rem;">Collage Images (up to 2)</span>
              <div id="collageList" style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:0.5rem;"></div>
              <button type="button" class="dripp-btn dripp-btn-sm" id="addCollageBtn"><i class="fas fa-plus"></i> Add Image</button>
            </div>
          </form>
        </div>
        <div class="dripp-modal-foot">
          <button class="dripp-btn dripp-btn-ghost" data-close>Cancel</button>
          <button class="dripp-btn dripp-btn-primary" id="savePkgBtn"><i class="fas fa-save"></i> ${editing ? 'Save' : 'Create'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const collageList = $('#collageList', modal);
    const renderCollage = () => {
      collageList.innerHTML = '';
      p.collageImages.forEach((src, i) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:0.5rem;align-items:center;';
        row.innerHTML = `
          <input type="text" data-i="${i}" class="dripp-input" value="${escapeHtml(src)}" placeholder="assets/images/photo.jpg or data:image/..." style="flex:1;padding:0.5rem 0.75rem;background:var(--d-bg);border:1px solid var(--d-border);border-radius:6px;color:var(--d-text);">
          <button type="button" class="dripp-btn dripp-btn-sm dripp-btn-danger" data-remove="${i}"><i class="fas fa-times"></i></button>
        `;
        collageList.appendChild(row);
      });
      $$('[data-i]', collageList).forEach(inp => inp.addEventListener('input', e => {
        p.collageImages[parseInt(e.target.dataset.i, 10)] = e.target.value;
      }));
      $$('[data-remove]', collageList).forEach(btn => btn.addEventListener('click', () => {
        p.collageImages.splice(parseInt(btn.dataset.remove, 10), 1);
        renderCollage();
      }));
    };
    renderCollage();
    $('#addCollageBtn', modal).addEventListener('click', () => {
      if (p.collageImages.length >= 2) { showToast('Max 2 collage images.', 'info'); return; }
      p.collageImages.push('');
      renderCollage();
    });
    $$('[data-close]', modal).forEach(el => el.addEventListener('click', () => modal.remove()));
    $('#savePkgBtn', modal).addEventListener('click', () => {
      const form = $('#pkgForm', modal);
      const fd = new FormData(form);
      const title = String(fd.get('title') || '').trim();
      if (!title) { showToast('Title is required.', 'error'); return; }
      const updated = {
        id: p.id,
        division: fd.get('division'),
        title,
        titleUr: String(fd.get('titleUr') || '').trim(),
        description: String(fd.get('description') || '').trim(),
        originalPrice: String(fd.get('originalPrice') || '').trim(),
        discountedPrice: String(fd.get('discountedPrice') || '').trim(),
        collageImages: p.collageImages.filter(s => s),
        targetManager: fd.get('targetManager'),
        badge: String(fd.get('badge') || '').trim()
      };
      if (editing) list[index] = updated;
      else list.push(updated);
      saveData();
      updateCounts();
      commitAndToast('chore(cms): ' + (editing ? 'update package ' + title : 'add package ' + title));
      modal.remove();
      renderPackagesManager($('#drippContent'));
      showToast(editing ? 'Package updated.' : 'Package created.', 'success');
    });
  }

  // HERO
  function renderHeroManager(root) {
    const currentHero = state.heroImage || 'assets/images/hero-banner.jpg';
    root.innerHTML = `
      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-image"></i> Hero & Banner</h2>
        </div>
        <p style="color:var(--d-text-soft);margin-bottom:1rem;">Upload a new hero image or paste a path. The site uses <code>assets/images/hero-banner.jpg</code> by default. After saving here, replace the file in <code>assets/images/</code> to make the change permanent.</p>
        <label class="dripp-upload" id="heroUpload">
          <i class="fas fa-cloud-upload-alt"></i>
          <p><strong>Click to upload</strong> or paste a path</p>
          <p style="font-size:0.75rem">Recommended: 600×750px portrait or larger</p>
          <input type="file" accept="image/*" id="heroFile">
          <input type="text" id="heroPath" placeholder="or path: assets/images/hero-banner.jpg" value="${escapeHtml(state.heroImage || '')}" style="margin-top:0.5rem;width:100%;padding:0.5rem;background:var(--d-bg);border:1px solid var(--d-border);border-radius:6px;color:var(--d-text);">
        </label>
        <img id="heroPreview" class="dripp-upload-preview visible" src="${escapeHtml(currentHero)}" alt="" style="max-width:300px;max-height:300px;">
        <div class="dripp-form-actions">
          <button class="dripp-btn dripp-btn-danger" id="resetHeroBtn"><i class="fas fa-rotate-left"></i> Reset to default</button>
          <button class="dripp-btn dripp-btn-primary" id="saveHeroBtn"><i class="fas fa-save"></i> Save Hero Image</button>
        </div>
      </div>
    `;
    const preview = $('#heroPreview', root);
    const pathInput = $('#heroPath', root);
    const fileInput = $('#heroFile', root);
    pathInput.addEventListener('input', () => preview.src = pathInput.value || 'assets/images/hero-banner.jpg');
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = e => {
        preview.src = e.target.result;
        pathInput.value = '';
        pathInput.dataset.upload = e.target.result;
      };
      reader.readAsDataURL(f);
    });
    $('#saveHeroBtn', root).addEventListener('click', () => {
      state.heroImage = pathInput.dataset.upload || pathInput.value || null;
      saveHero();
      showToast('Hero image saved. (Replace the file in assets/images/ to make it permanent.)', 'success');
    });
    $('#resetHeroBtn', root).addEventListener('click', () => {
      state.heroImage = null;
      localStorage.removeItem(STORAGE.HERO);
      localStorage.removeItem(STORAGE.HERO_LEGACY);
      pathInput.value = '';
      preview.src = 'assets/images/hero-banner.jpg';
      showToast('Hero reset to default.', 'info');
    });
  }

  // NEWS
  function renderNewsManager(root) {
    const list = state.data.news || [];
    root.innerHTML = `
      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-newspaper"></i> News Publisher</h2>
          <div class="dripp-panel-actions">
            <a href="news.html" target="_blank" class="dripp-btn dripp-btn-ghost"><i class="fas fa-up-right-from-square"></i> View Public Page</a>
            <button class="dripp-btn dripp-btn-primary" id="addNewsBtn"><i class="fas fa-plus"></i> Publish News</button>
          </div>
        </div>
        ${list.length === 0 ? `
          <div class="dripp-empty"><i class="fas fa-newspaper"></i><p>No news published yet. The public News page is currently empty.</p></div>
        ` : `
          <div class="dripp-table-wrap">
            <table class="dripp-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Title</th>
                  <th>Mode</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map((n, i) => `
                  <tr>
                    <td>${n.image ? `<img src="${escapeHtml(n.image)}" onerror="this.onerror=null;this.style.display='none'" alt="">` : '<i class="fas fa-align-left" style="color:var(--d-text-soft)"></i>'}</td>
                    <td><strong>${escapeHtml(n.title || '(untitled)')}</strong></td>
                    <td><span class="dripp-badge ${n.mode === 'image' ? 'blue' : n.mode === 'text+image' ? 'gold' : 'green'}">${escapeHtml(n.mode || 'text')}</span></td>
                    <td>${escapeHtml(n.date || '')}</td>
                    <td class="dripp-actions-cell">
                      <button class="dripp-btn dripp-btn-sm" data-action="edit" data-i="${i}"><i class="fas fa-pen"></i></button>
                      <button class="dripp-btn dripp-btn-sm dripp-btn-danger" data-action="delete" data-i="${i}"><i class="fas fa-trash"></i></button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
    $('#addNewsBtn', root).addEventListener('click', () => openNewsModal(null));
    $$('[data-action="edit"]', root).forEach(b => b.addEventListener('click', () => openNewsModal(parseInt(b.dataset.i, 10))));
    $$('[data-action="delete"]', root).forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.i, 10);
      if (confirm('Delete news post "' + (list[i].title || 'untitled') + '"?')) {
        list.splice(i, 1);
        saveData();
        updateCounts();
        renderNewsManager(root);
        showToast('News post deleted.', 'info');
      }
    }));
  }

  function openNewsModal(index) {
    const list = state.data.news || [];
    const n = index != null ? { ...list[index] } : {
      id: 'n_' + Date.now(),
      mode: 'text',
      title: '', content: '',
      image: '', date: new Date().toISOString().slice(0, 10)
    };
    const editing = index != null;
    const modal = document.createElement('div');
    modal.className = 'dripp-modal open';
    modal.innerHTML = `
      <div class="dripp-modal-card">
        <div class="dripp-modal-head">
          <h2>${editing ? 'Edit' : 'Publish'} News</h2>
          <button class="dripp-modal-close" data-close><i class="fas fa-times"></i></button>
        </div>
        <div class="dripp-modal-body">
          <form id="newsForm">
            <label class="dripp-field"><span>Post Mode</span></label>
            <div class="dripp-radio-group" id="modeGroup">
              <div class="dripp-radio ${n.mode === 'text' ? 'active' : ''}" data-mode="text">
                <i class="fas fa-align-left"></i>Text Only
              </div>
              <div class="dripp-radio ${n.mode === 'image' ? 'active' : ''}" data-mode="image">
                <i class="fas fa-image"></i>Image Only
              </div>
              <div class="dripp-radio ${n.mode === 'text+image' ? 'active' : ''}" data-mode="text+image">
                <i class="fas fa-newspaper"></i>Text + Image
              </div>
            </div>
            <input type="hidden" name="mode" id="newsMode" value="${escapeHtml(n.mode)}">
            <div class="dripp-form-grid">
              <label class="dripp-field dripp-form-full"><span>Title</span>
                <div class="dripp-input-wrap"><i class="fas fa-heading"></i>
                  <input type="text" name="title" value="${escapeHtml(n.title || '')}">
                </div>
              </label>
              <div class="dripp-field dripp-form-full" id="contentField" style="${n.mode === 'image' ? 'display:none' : ''}">
                <span>Content</span>
                <div class="dripp-input-wrap"><i class="fas fa-quote-left"></i>
                  <textarea name="content" rows="4">${escapeHtml(n.content || '')}</textarea>
                </div>
              </div>
              <div class="dripp-form-full" id="imageField" style="${n.mode === 'text' ? 'display:none' : ''}">
                <span style="display:block;font-size:0.8rem;color:var(--d-text-soft);font-weight:600;margin-bottom:0.4rem;">Image</span>
                <label class="dripp-upload" id="newsImageUpload">
                  <i class="fas fa-cloud-upload-alt"></i>
                  <p><strong>Click to upload</strong> or paste a path</p>
                  <input type="file" accept="image/*" id="newsImageFile">
                  <input type="hidden" name="image" id="newsImageData" value="${escapeHtml(n.image || '')}">
                  <input type="text" id="newsImagePath" placeholder="or path: assets/images/photo.jpg" value="${n.image && !String(n.image).startsWith('data:') ? escapeHtml(n.image) : ''}" style="margin-top:0.5rem;width:100%;padding:0.5rem;background:var(--d-bg);border:1px solid var(--d-border);border-radius:6px;color:var(--d-text);">
                </label>
                <img id="newsImagePreview" class="dripp-upload-preview" src="${escapeHtml(n.image || '')}" alt="">
              </div>
            </div>
          </form>
        </div>
        <div class="dripp-modal-foot">
          <button class="dripp-btn dripp-btn-ghost" data-close>Cancel</button>
          <button class="dripp-btn dripp-btn-primary" id="saveNewsBtn"><i class="fas fa-bullhorn"></i> ${editing ? 'Save' : 'Publish'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const modeInput = $('#newsMode', modal);
    const contentField = $('#contentField', modal);
    const imageField = $('#imageField', modal);
    $$('.dripp-radio', modal).forEach(r => r.addEventListener('click', () => {
      $$('.dripp-radio', modal).forEach(x => x.classList.remove('active'));
      r.classList.add('active');
      const mode = r.dataset.mode;
      modeInput.value = mode;
      contentField.style.display = mode === 'image' ? 'none' : '';
      imageField.style.display = mode === 'text' ? 'none' : '';
    }));

    const preview = $('#newsImagePreview', modal);
    const updatePreview = (src) => {
      if (src) { preview.src = src; preview.classList.add('visible'); }
      else { preview.classList.remove('visible'); }
    };
    if (n.image) updatePreview(n.image);
    $('#newsImageFile', modal).addEventListener('change', () => {
      const f = $('#newsImageFile', modal).files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = e => {
        $('#newsImageData', modal).value = e.target.result;
        $('#newsImagePath', modal).value = '';
        updatePreview(e.target.result);
      };
      reader.readAsDataURL(f);
    });
    $('#newsImagePath', modal).addEventListener('input', e => {
      if (e.target.value) {
        $('#newsImageData', modal).value = e.target.value;
        updatePreview(e.target.value);
      }
    });

    $$('[data-close]', modal).forEach(el => el.addEventListener('click', () => modal.remove()));
    $('#saveNewsBtn', modal).addEventListener('click', () => {
      const fd = new FormData($('#newsForm', modal));
      const mode = modeInput.value;
      const title = String(fd.get('title') || '').trim();
      const content = String(fd.get('content') || '').trim();
      const image = String($('#newsImageData', modal).value || '').trim();
      if (!title && mode !== 'image') { showToast('Title is required.', 'error'); return; }
      if (mode === 'text' && !content) { showToast('Content is required for text posts.', 'error'); return; }
      if (mode === 'image' && !image) { showToast('Image is required for image posts.', 'error'); return; }
      if (mode === 'text+image' && (!content || !image)) { showToast('Both content and image are required.', 'error'); return; }
      const updated = { id: n.id, mode, title, content, image, date: n.date || new Date().toISOString().slice(0, 10) };
      if (editing) list[index] = updated;
      else list.unshift(updated);
      saveData();
      updateCounts();
      modal.remove();
      renderNewsManager($('#drippContent'));
      showToast(editing ? 'News updated.' : 'News published!', 'success');
    });
  }

  // SETTINGS
  function renderSettings(root) {
    const savedAt = (() => {
      try {
        const raw = localStorage.getItem(STORAGE.DATA);
        if (!raw) return 'Never';
        return new Date(JSON.parse(raw).savedAt).toLocaleString();
      } catch (e) { return 'Unknown'; }
    })();
    root.innerHTML = `
      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-gear"></i> Settings</h2>
        </div>
        <div class="dripp-form-grid">
          <div>
            <h3 style="font-size:0.95rem;margin-bottom:0.5rem;">Session</h3>
            <p style="color:var(--d-text-soft);font-size:0.85rem;margin:0 0 0.5rem;">Logged in as <strong>${CRED_USER}</strong> • expires in ${SESSION_HOURS}h</p>
          </div>
          <div>
            <h3 style="font-size:0.95rem;margin-bottom:0.5rem;">LocalStorage</h3>
            <p style="color:var(--d-text-soft);font-size:0.85rem;margin:0;">Last saved: ${escapeHtml(savedAt)}</p>
          </div>
        </div>
        <div class="dripp-form-actions">
          <button class="dripp-btn dripp-btn-gold" id="exportBtn"><i class="fas fa-download"></i> Export data.json</button>
          <button class="dripp-btn" id="reloadBtn"><i class="fas fa-rotate"></i> Reload from data.json</button>
          <button class="dripp-btn dripp-btn-danger" id="resetBtn"><i class="fas fa-trash"></i> Reset to defaults</button>
        </div>
      </div>
    `;
    $('#exportBtn', root).addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('data.json exported. Upload to your repo to make changes live.', 'success');
    });
    $('#reloadBtn', root).addEventListener('click', async () => {
      localStorage.removeItem(STORAGE.DATA);
      localStorage.removeItem(STORAGE.DATA_LEGACY);
      localStorage.removeItem(STORAGE.NEWS);
      await loadData();
      updateCounts();
      renderSection(state.section);
      showToast('✓ Reloaded from /api/sync (server) + data.json fallback. Sidebar counts: A=' + (state.data.models||[]).length + ', B=' + (state.data.division_b_talent||[]).length + ', Packages=' + (state.data.package_deals||[]).length, 'success');
    });
    $('#resetBtn', root).addEventListener('click', () => {
      if (!confirm('Clear all LocalStorage edits and revert to data.json? This cannot be undone.')) return;
      localStorage.removeItem(STORAGE.DATA);
      localStorage.removeItem(STORAGE.DATA_LEGACY);
      localStorage.removeItem(STORAGE.HERO);
      localStorage.removeItem(STORAGE.HERO_LEGACY);
      localStorage.removeItem(STORAGE.NEWS);
      localStorage.removeItem(STORAGE.BOOKINGS);
      loadData().then(() => {
        updateCounts();
        renderSection(state.section);
        showToast('Reset to defaults.', 'info');
      });
    });
  }

  // BOOKINGS TRACKER
  function renderBookingsManager(root) {
    const bookings = readBookings();
    const total = bookings.length;
    const pending = bookings.filter(b => (b.status || 'Pending') === 'Pending').length;
    const confirmed = bookings.filter(b => b.status === 'Confirmed').length;
    const divA = bookings.filter(b => b.division === 'moon' || !b.division).length;
    const divB = bookings.filter(b => b.division === 'ali_hamza').length;

    root.innerHTML = `
      <div class="dripp-stats">
        <div class="dripp-stat" style="border-color: rgba(233, 69, 96, 0.4);">
          <i class="fas fa-calendar-check"></i>
          <div><div class="dripp-stat-value">${total}</div><div class="dripp-stat-label">Total Bookings</div></div>
        </div>
        <div class="dripp-stat gold">
          <i class="fas fa-hourglass-half"></i>
          <div><div class="dripp-stat-value">${pending}</div><div class="dripp-stat-label">Pending</div></div>
        </div>
        <div class="dripp-stat green">
          <i class="fas fa-circle-check"></i>
          <div><div class="dripp-stat-value">${confirmed}</div><div class="dripp-stat-label">Confirmed</div></div>
        </div>
        <div class="dripp-stat blue">
          <i class="fas fa-arrows-split-up-and-left"></i>
          <div><div class="dripp-stat-value">${divA} / ${divB}</div><div class="dripp-stat-label">Moon / Ali Hamza</div></div>
        </div>
      </div>

      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-list-check"></i> Bookings &amp; Inquiry Log</h2>
          <div class="dripp-panel-actions">
            <input type="text" id="bkSearch" placeholder="Search name, phone, model…" style="padding:0.5rem 0.75rem;background:var(--d-bg);border:1px solid var(--d-border);border-radius:6px;color:var(--d-text);font-size:0.85rem;width:220px;">
            <button class="dripp-btn dripp-btn-gold" id="exportCsvBtn"><i class="fas fa-file-csv"></i> Export CSV</button>
            <button class="dripp-btn" id="exportPdfBtn"><i class="fas fa-file-pdf"></i> Export PDF Report</button>
            <button class="dripp-btn dripp-btn-danger" id="clearBookingsBtn"><i class="fas fa-trash"></i> Clear All</button>
          </div>
        </div>
        ${bookings.length === 0 ? `
          <div class="dripp-empty">
            <i class="fas fa-calendar-xmark"></i>
            <p>No bookings yet. Client bookings from the public site will appear here in real-time.</p>
          </div>
        ` : `
          <div class="dripp-table-wrap">
            <table class="dripp-table" id="bkTable">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Client</th>
                  <th>Phone</th>
                  <th>Model / Package</th>
                  <th>Division</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="bkTbody">
                ${bookings.map((b, i) => renderBookingRow(b, i)).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    const search = $('#bkSearch', root);
    const tbody = $('#bkTbody', root);
    if (search && tbody) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        $$('tr', tbody).forEach(row => {
          row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }

    $$('[data-bk-status]', root).forEach(sel => sel.addEventListener('change', (e) => {
      const i = parseInt(sel.getAttribute('data-bk-status'), 10);
      const list = readBookings();
      if (list[i]) {
        list[i].status = e.target.value;
        persistBookings(list);
        renderBookingsManager(root);
        showToast('Status updated.', 'success');
      }
    }));
    $$('[data-bk-delete]', root).forEach(btn => btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-bk-delete'), 10);
      if (confirm('Delete this booking?')) {
        const list = readBookings();
        list.splice(i, 1);
        persistBookings(list);
        updateCounts();
        renderBookingsManager(root);
        showToast('Booking deleted.', 'info');
      }
    }));
    $$('[data-bk-wa]', root).forEach(btn => btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-bk-wa'), 10);
      const b = readBookings()[i];
      if (!b) return;
      const url = 'https://wa.me/' + b.whatsappNumber + '?text=' + encodeURIComponent('Hello ' + (b.clientName || '') + ', confirming your booking for ' + (b.modelName || '') + ' on ' + (b.eventDate || '') + ' at ' + (b.eventTime || '') + '.');
      window.open(url, '_blank', 'noopener');
    }));

    const exportCsv = $('#exportCsvBtn', root);
    if (exportCsv) exportCsv.addEventListener('click', () => exportBookingsCSV(bookings));
    const exportPdf = $('#exportPdfBtn', root);
    if (exportPdf) exportPdf.addEventListener('click', () => exportBookingsPDF(bookings));
    const clear = $('#clearBookingsBtn', root);
    if (clear) clear.addEventListener('click', () => {
      if (!confirm('Clear ALL bookings? This cannot be undone.')) return;
      persistBookings([]);
      updateCounts();
      renderBookingsManager(root);
      showToast('All bookings cleared.', 'info');
    });
  }

  function renderBookingRow(b, i) {
    const status = b.status || 'Pending';
    const statusColor = status === 'Confirmed' ? 'green' : (status === 'Cancelled' ? 'pink' : 'gold');
    const ts = b.createdAt ? new Date(b.createdAt).toLocaleString() : '—';
    return `
      <tr>
        <td>
          <select data-bk-status="${i}" class="dripp-input" style="padding:0.3rem 0.5rem;background:var(--d-bg);border:1px solid var(--d-border);border-radius:4px;color:var(--d-text);font-size:0.8rem;">
            <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Confirmed" ${status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="Cancelled" ${status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
          <br><span class="dripp-badge ${statusColor}" style="margin-top:0.25rem;display:inline-block;">${status}</span>
        </td>
        <td><strong>${escapeHtml(b.clientName || '—')}</strong></td>
        <td>${escapeHtml(b.clientPhone || '—')}</td>
        <td>${escapeHtml(b.modelName || '—')}</td>
        <td><span class="dripp-badge ${b.division === 'ali_hamza' ? 'gold' : 'pink'}">${b.division === 'ali_hamza' ? 'Ali Hamza' : 'Moon'}</span></td>
        <td>${escapeHtml(b.eventDate || '—')}</td>
        <td>${escapeHtml(b.eventTime || '—')}</td>
        <td><small style="color:var(--d-text-soft)">${escapeHtml(ts)}</small></td>
        <td class="dripp-actions-cell">
          <button class="dripp-btn dripp-btn-sm" data-bk-wa="${i}" title="Open WhatsApp"><i class="fab fa-whatsapp"></i></button>
          <button class="dripp-btn dripp-btn-sm dripp-btn-danger" data-bk-delete="${i}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  }

  function exportBookingsCSV(bookings) {
    const headers = ['ID', 'Status', 'Client', 'Phone', 'Model/Package', 'Division', 'Event Date', 'Event Time', 'Notes', 'Submitted', 'WhatsApp'];
    const rows = bookings.map(b => [
      b.id, b.status || 'Pending', b.clientName, b.clientPhone, b.modelName,
      b.division, b.eventDate, b.eventTime, b.notes || '',
      b.createdAt ? new Date(b.createdAt).toLocaleString() : '',
      b.whatsappNumber
    ]);
    const escape = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookings-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported (' + bookings.length + ' rows).', 'success');
  }

  function exportBookingsPDF(bookings) {
    const win = window.open('', '_blank');
    if (!win) { showToast('Allow pop-ups to export PDF.', 'error'); return; }
    const rows = bookings.map(b => `
      <tr>
        <td>${b.status || 'Pending'}</td>
        <td>${escapeHtml(b.clientName || '')}</td>
        <td>${escapeHtml(b.clientPhone || '')}</td>
        <td>${escapeHtml(b.modelName || '')}</td>
        <td>${b.division === 'ali_hamza' ? 'Ali Hamza' : 'Moon'}</td>
        <td>${escapeHtml(b.eventDate || '')}</td>
        <td>${escapeHtml(b.eventTime || '')}</td>
        <td>${b.createdAt ? escapeHtml(new Date(b.createdAt).toLocaleString()) : ''}</td>
      </tr>
    `).join('');
    const total = bookings.length;
    const pending = bookings.filter(b => (b.status || 'Pending') === 'Pending').length;
    const confirmed = bookings.filter(b => b.status === 'Confirmed').length;
    win.document.write(`<!DOCTYPE html><html><head><title>Bookings Report</title>
      <style>
        body { font-family: -apple-system, Segoe UI, sans-serif; padding: 24px; color: #1a1a2e; }
        h1 { margin: 0 0 8px; font-size: 22px; }
        .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
        .stats { display: flex; gap: 12px; margin-bottom: 16px; }
        .stat { background: #f5f5f9; padding: 8px 12px; border-radius: 6px; font-size: 12px; }
        .stat b { font-size: 18px; display: block; color: #1a1a2e; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #e3e3ea; }
        th { background: #1a1a2e; color: #fff; font-weight: 600; }
        tr:nth-child(even) { background: #fafafd; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Moon Enterprises — Bookings Report</h1>
      <div class="meta">Generated: ${new Date().toLocaleString()}</div>
      <div class="stats">
        <div class="stat"><b>${total}</b>Total</div>
        <div class="stat"><b>${pending}</b>Pending</div>
        <div class="stat"><b>${confirmed}</b>Confirmed</div>
      </div>
      <table>
        <thead><tr><th>Status</th><th>Client</th><th>Phone</th><th>Talent</th><th>Division</th><th>Date</th><th>Time</th><th>Submitted</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:#999">No bookings</td></tr>'}</tbody>
      </table>
      <script>window.onload = () => setTimeout(() => window.print(), 250);<\/script>
      </body></html>`);
    win.document.close();
    showToast('PDF report opened. Use "Save as PDF" in the print dialog.', 'success');
  }

  // CONTACT INFO MANAGER
  function renderContactManager(root) {
    const a = state.data.agency || {};
    const da = state.data.divisions?.division_a || {};
    const db = state.data.divisions?.division_b || {};
    root.innerHTML = `
      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-address-book"></i> Global Contact Info</h2>
        </div>
        <p style="color:var(--d-text-soft);font-size:0.85rem;margin-bottom:1rem;">These values update the contact section on the public site and the WhatsApp routing destinations.</p>
        <form id="contactForm" class="dripp-form-grid">
          <label class="dripp-field"><span>Agency Title</span>
            <div class="dripp-input-wrap"><i class="fas fa-building"></i>
              <input type="text" name="title" value="${escapeHtml(a.title || 'Moon Enterprises')}">
            </div>
          </label>
          <label class="dripp-field"><span>Agency Phone</span>
            <div class="dripp-input-wrap"><i class="fas fa-phone"></i>
              <input type="text" name="contactPhone" value="${escapeHtml(a.contactPhone || '')}">
            </div>
          </label>
          <label class="dripp-field"><span>Agency WhatsApp</span>
            <div class="dripp-input-wrap"><i class="fab fa-whatsapp"></i>
              <input type="text" name="whatsappNumber" value="${escapeHtml(a.whatsappNumber || '')}">
            </div>
          </label>

          <div class="dripp-form-full" style="margin-top:0.5rem;"><h3 style="font-size:0.95rem;color:var(--d-accent);">Division A — Moon</h3></div>
          <label class="dripp-field"><span>Division A WhatsApp</span>
            <div class="dripp-input-wrap"><i class="fab fa-whatsapp"></i>
              <input type="text" name="daWa" value="${escapeHtml(da.whatsappNumber || '923147553161')}">
            </div>
          </label>
          <label class="dripp-field"><span>Division A Phone</span>
            <div class="dripp-input-wrap"><i class="fas fa-phone"></i>
              <input type="text" name="daPhone" value="${escapeHtml(da.contactPhone || '+923147553161')}">
            </div>
          </label>

          <div class="dripp-form-full" style="margin-top:0.5rem;"><h3 style="font-size:0.95rem;color:var(--d-gold);">Division B — Ali Hamza</h3></div>
          <label class="dripp-field"><span>Division B WhatsApp</span>
            <div class="dripp-input-wrap"><i class="fab fa-whatsapp"></i>
              <input type="text" name="dbWa" value="${escapeHtml(db.whatsappNumber || '923036800682')}">
            </div>
          </label>
          <label class="dripp-field"><span>Division B Phone</span>
            <div class="dripp-input-wrap"><i class="fas fa-phone"></i>
              <input type="text" name="dbPhone" value="${escapeHtml(db.contactPhone || '+923036800682')}">
            </div>
          </label>
        </form>
        <div class="dripp-form-actions">
          <button class="dripp-btn dripp-btn-primary" id="saveContactBtn"><i class="fas fa-save"></i> Save Contact Info</button>
        </div>
      </div>
    `;
    $('#saveContactBtn', root).addEventListener('click', () => {
      const fd = new FormData($('#contactForm', root));
      state.data.agency = {
        ...state.data.agency,
        title: String(fd.get('title') || '').trim(),
        contactPhone: String(fd.get('contactPhone') || '').trim(),
        whatsappNumber: String(fd.get('whatsappNumber') || '').trim()
      };
      state.data.divisions = state.data.divisions || {};
      state.data.divisions.division_a = {
        ...state.data.divisions.division_a,
        whatsappNumber: String(fd.get('daWa') || '').trim(),
        contactPhone: String(fd.get('daPhone') || '').trim(),
        id: 'division_a', name: 'Moon Division', key: 'moon'
      };
      state.data.divisions.division_b = {
        ...state.data.divisions.division_b,
        whatsappNumber: String(fd.get('dbWa') || '').trim(),
        contactPhone: String(fd.get('dbPhone') || '').trim(),
        id: 'division_b', name: 'Ali Hamza Division', key: 'ali_hamza'
      };
      saveData();
      commitAndToast('chore(cms): update contact info (agency + divisions)');
      showToast('Contact info saved. Pushing to GitHub…', 'success');
    });
  }

  // REVIEWS & COMMENTS MANAGER
  function renderReviewsManager(root) {
    const all = readCmsReviews();
    const seed = (state.data.reviews && state.data.reviews.division_a) ? state.data.reviews.division_a.concat(state.data.reviews.division_b || []) : [];
    const combined = all.concat(seed);

    root.innerHTML = `
      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-comments"></i> Reviews &amp; Comments</h2>
          <div class="dripp-panel-actions">
            <input type="text" id="rvSearch" placeholder="Search reviews…" style="padding:0.5rem 0.75rem;background:var(--d-bg);border:1px solid var(--d-border);border-radius:6px;color:var(--d-text);font-size:0.85rem;width:200px;">
            <button class="dripp-btn dripp-btn-primary" id="addReviewBtn"><i class="fas fa-plus"></i> Manually Add Review</button>
          </div>
        </div>
        <p style="color:var(--d-text-soft);font-size:0.85rem;margin-bottom:1rem;">
          Approve, edit, or delete reviews. Approved reviews appear instantly on the live public site. Includes both CMS-managed and seed reviews.
        </p>
        ${combined.length === 0 ? `
          <div class="dripp-empty"><i class="fas fa-comment-dots"></i><p>No reviews yet. Add one manually or wait for clients to submit via the public site.</p></div>
        ` : `
          <div class="dripp-table-wrap">
            <table class="dripp-table" id="rvTable">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Rating</th>
                  <th>Comment</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="rvTbody">
                ${combined.map((r, i) => renderReviewRow(r, i)).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    const search = $('#rvSearch', root);
    const tbody = $('#rvTbody', root);
    if (search && tbody) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        $$('tr', tbody).forEach(row => {
          row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }

    $('#addReviewBtn', root).addEventListener('click', () => openReviewModal(null));
    $$('[data-rv-edit]', root).forEach(b => b.addEventListener('click', () => openReviewModal(parseInt(b.dataset.rvEdit, 10))));
    $$('[data-rv-delete]', root).forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.rvDelete, 10);
      if (confirm('Delete this review?')) {
        const list = readCmsReviews();
        list.splice(i, 1);
        persistCmsReviews(list);
        saveData();
        updateCounts();
        renderReviewsManager(root);
        showToast('Review deleted.', 'info');
      }
    }));
    $$('[data-rv-approve]', root).forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.rvApprove, 10);
      const list = readCmsReviews();
      if (list[i]) {
        list[i].status = 'approved';
        list[i].verified = true;
        persistCmsReviews(list);
        saveData();
        updateCounts();
        renderReviewsManager(root);
        showToast('Review approved & published.', 'success');
      }
    }));
  }

  function renderReviewRow(r, i) {
    const status = r.status || (r.verified ? 'approved' : 'pending');
    const statusColor = status === 'approved' ? 'green' : (status === 'rejected' ? 'pink' : 'gold');
    const photoSrc = r.image || 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><rect width="44" height="44" fill="%23262a52"/><text x="50%" y="50%" font-size="14" fill="%239aa0bc" text-anchor="middle" dy=".3em">' + (r.name || '?').charAt(0).toUpperCase() + '</text></svg>';
    const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
    const date = r.date || '—';
    return `
      <tr>
        <td><span class="dripp-badge ${statusColor}">${escapeHtml(status)}</span></td>
        <td><img src="${escapeHtml(photoSrc)}" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=utf-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 44%22><rect width=%2244%22 height=%2244%22 fill=%22%23262a52%22/><text x=%2250%25%22 y=%2250%25%22 font-size=%2214%22 fill=%22%239aa0bc%22 text-anchor=%22middle%22 dy=%22.3em%22>${escapeHtml((r.name||'?').charAt(0).toUpperCase())}</text></svg>'" alt=""></td>
        <td><strong>${escapeHtml(r.name || '—')}</strong></td>
        <td style="color:#fbbf4a">${stars}</td>
        <td><small>${escapeHtml((r.comment || '').slice(0, 80))}${(r.comment || '').length > 80 ? '…' : ''}</small></td>
        <td>${escapeHtml(date)}</td>
        <td class="dripp-actions-cell">
          ${status !== 'approved' ? `<button class="dripp-btn dripp-btn-sm" style="background:rgba(34,197,94,0.18);border-color:rgba(34,197,94,0.4);" data-rv-approve="${i}" title="Approve"><i class="fas fa-check"></i></button>` : ''}
          <button class="dripp-btn dripp-btn-sm" data-rv-edit="${i}" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="dripp-btn dripp-btn-sm dripp-btn-danger" data-rv-delete="${i}" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  }

  function openReviewModal(index) {
    const list = readCmsReviews();
    const r = index != null ? { ...list[index] } : {
      id: 'rv_' + Date.now(),
      name: '', comment: '', commentUr: '',
      rating: 5, date: new Date().toISOString().slice(0, 10),
      image: '', status: 'approved', verified: true
    };
    const editing = index != null;
    const modal = document.createElement('div');
    modal.className = 'dripp-modal open';
    modal.innerHTML = `
      <div class="dripp-modal-card">
        <div class="dripp-modal-head">
          <h2>${editing ? 'Edit' : 'Add'} Review</h2>
          <button class="dripp-modal-close" data-close><i class="fas fa-times"></i></button>
        </div>
        <div class="dripp-modal-body">
          <form id="rvForm" class="dripp-form-grid">
            <label class="dripp-field"><span>Reviewer Name *</span>
              <div class="dripp-input-wrap"><i class="fas fa-user"></i>
                <input type="text" name="name" required value="${escapeHtml(r.name || '')}">
              </div>
            </label>
            <label class="dripp-field"><span>Rating *</span>
              <div class="dripp-input-wrap"><i class="fas fa-star"></i>
                <select name="rating">
                  <option value="5" ${r.rating == 5 ? 'selected' : ''}>5 — Excellent</option>
                  <option value="4" ${r.rating == 4 ? 'selected' : ''}>4 — Very Good</option>
                  <option value="3" ${r.rating == 3 ? 'selected' : ''}>3 — Good</option>
                  <option value="2" ${r.rating == 2 ? 'selected' : ''}>2 — Fair</option>
                  <option value="1" ${r.rating == 1 ? 'selected' : ''}>1 — Poor</option>
                </select>
              </div>
            </label>
            <label class="dripp-field"><span>Status</span>
              <div class="dripp-input-wrap"><i class="fas fa-check-circle"></i>
                <select name="status">
                  <option value="approved" ${r.status !== 'rejected' ? 'selected' : ''}>Approved (visible on site)</option>
                  <option value="rejected" ${r.status === 'rejected' ? 'selected' : ''}>Rejected (hidden)</option>
                </select>
              </div>
            </label>
            <label class="dripp-field"><span>Date</span>
              <div class="dripp-input-wrap"><i class="fas fa-calendar"></i>
                <input type="date" name="date" value="${escapeHtml(r.date || '')}">
              </div>
            </label>
            <label class="dripp-field dripp-form-full"><span>Comment (English)</span>
              <div class="dripp-input-wrap"><i class="fas fa-quote-left"></i>
                <textarea name="comment" rows="2">${escapeHtml(r.comment || '')}</textarea>
              </div>
            </label>
            <label class="dripp-field dripp-form-full"><span>Comment (Urdu, optional)</span>
              <div class="dripp-input-wrap"><i class="fas fa-language"></i>
                <textarea name="commentUr" rows="2">${escapeHtml(r.commentUr || '')}</textarea>
              </div>
            </label>
            <div class="dripp-form-full">
              <span style="display:block;font-size:0.8rem;color:var(--d-text-soft);font-weight:600;margin-bottom:0.4rem;">Reviewer Photo</span>
              <label class="dripp-upload">
                <i class="fas fa-cloud-upload-alt"></i>
                <p><strong>Click to upload</strong> or paste a path</p>
                <input type="file" accept="image/*" id="rvFile">
                <input type="hidden" name="image" id="rvImageData" value="${escapeHtml(r.image || '')}">
                <input type="text" id="rvImagePath" placeholder="or path: assets/images/photo.jpg" value="${r.image && !String(r.image).startsWith('data:') ? escapeHtml(r.image) : ''}" style="margin-top:0.5rem;width:100%;padding:0.5rem;background:var(--d-bg);border:1px solid var(--d-border);border-radius:6px;color:var(--d-text);">
              </label>
              <img id="rvPreview" class="dripp-upload-preview" src="${escapeHtml(r.image || '')}" alt="" style="border-radius:50%;">
            </div>
          </form>
        </div>
        <div class="dripp-modal-foot">
          <button class="dripp-btn dripp-btn-ghost" data-close>Cancel</button>
          <button class="dripp-btn dripp-btn-primary" id="saveReviewBtn"><i class="fas fa-save"></i> ${editing ? 'Save' : 'Add Review'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const fileInput = $('#rvFile', modal);
    const pathInput = $('#rvImagePath', modal);
    const dataInput = $('#rvImageData', modal);
    const preview = $('#rvPreview', modal);
    const updatePreview = (src) => {
      if (src) { preview.src = src; preview.classList.add('visible'); }
      else { preview.classList.remove('visible'); }
    };
    if (r.image) updatePreview(r.image);
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        dataInput.value = ev.target.result;
        pathInput.value = '';
        updatePreview(ev.target.result);
      };
      reader.readAsDataURL(f);
    });
    pathInput.addEventListener('input', () => {
      if (pathInput.value) {
        dataInput.value = pathInput.value;
        updatePreview(pathInput.value);
      }
    });
    $$('[data-close]', modal).forEach(el => el.addEventListener('click', () => modal.remove()));
    $('#saveReviewBtn', modal).addEventListener('click', () => {
      const fd = new FormData($('#rvForm', modal));
      const name = String(fd.get('name') || '').trim();
      if (!name) { showToast('Reviewer name required.', 'error'); return; }
      const updated = {
        id: r.id,
        name,
        comment: String(fd.get('comment') || '').trim(),
        commentUr: String(fd.get('commentUr') || '').trim(),
        rating: parseInt(fd.get('rating'), 10) || 5,
        date: String(fd.get('date') || '').trim(),
        image: String(dataInput.value || '').trim(),
        status: String(fd.get('status') || 'approved'),
        verified: String(fd.get('status') || 'approved') === 'approved'
      };
      const list = readCmsReviews();
      if (editing) list[index] = updated;
      else list.unshift(updated);
      persistCmsReviews(list);
      saveData();
      updateCounts();
      modal.remove();
      renderReviewsManager($('#drippContent'));
      showToast(editing ? 'Review updated.' : 'Review added & published.', 'success');
    });
  }

  // SITE CONTENT (Hero/Footer text)
  function renderSiteContentManager(root) {
    state.data.site_content = state.data.site_content || { hero: {}, contact: {} };
    const sc = state.data.site_content;
    const hero = sc.hero || {};
    const contact = sc.contact || {};
    root.innerHTML = `
      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-pen-fancy"></i> Hero Section Text</h2>
        </div>
        <p style="color:var(--d-text-soft);font-size:0.85rem;margin-bottom:1rem;">Edit the headline, subheading, badge, and CTA button shown on the public homepage.</p>
        <form id="heroTextForm" class="dripp-form-grid">
          <label class="dripp-field"><span>Headline (English)</span>
            <div class="dripp-input-wrap"><i class="fas fa-heading"></i>
              <input type="text" name="title" value="${escapeHtml(hero.title || '')}">
            </div>
          </label>
          <label class="dripp-field"><span>Headline (Urdu)</span>
            <div class="dripp-input-wrap"><i class="fas fa-language"></i>
              <input type="text" name="titleUr" value="${escapeHtml(hero.titleUr || '')}">
            </div>
          </label>
          <label class="dripp-field dripp-form-full"><span>Subheadline (English)</span>
            <div class="dripp-input-wrap"><i class="fas fa-quote-left"></i>
              <textarea name="subtitle" rows="2">${escapeHtml(hero.subtitle || '')}</textarea>
            </div>
          </label>
          <label class="dripp-field dripp-form-full"><span>Subheadline (Urdu)</span>
            <div class="dripp-input-wrap"><i class="fas fa-quote-left"></i>
              <textarea name="subtitleUr" rows="2">${escapeHtml(hero.subtitleUr || '')}</textarea>
            </div>
          </label>
          <label class="dripp-field"><span>CTA Button (English)</span>
            <div class="dripp-input-wrap"><i class="fas fa-mouse-pointer"></i>
              <input type="text" name="cta" value="${escapeHtml(hero.cta || '')}">
            </div>
          </label>
          <label class="dripp-field"><span>CTA Button (Urdu)</span>
            <div class="dripp-input-wrap"><i class="fas fa-language"></i>
              <input type="text" name="ctaUr" value="${escapeHtml(hero.ctaUr || '')}">
            </div>
          </label>
          <label class="dripp-field"><span>Badge / Pill</span>
            <div class="dripp-input-wrap"><i class="fas fa-award"></i>
              <input type="text" name="badge" value="${escapeHtml(hero.badge || '')}" placeholder="Est. 2026">
            </div>
          </label>
        </form>
        <div class="dripp-form-actions">
          <button class="dripp-btn dripp-btn-primary" id="saveHeroTextBtn"><i class="fas fa-save"></i> Save Hero Text</button>
        </div>
      </div>

      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-address-book"></i> Contact &amp; Footer</h2>
        </div>
        <p style="color:var(--d-text-soft);font-size:0.85rem;margin-bottom:1rem;">Address, leadership blurb, footer tagline, copyright — all editable.</p>
        <form id="contactTextForm" class="dripp-form-grid">
          <label class="dripp-field"><span>Address (English)</span>
            <div class="dripp-input-wrap"><i class="fas fa-map-marker-alt"></i>
              <input type="text" name="address" value="${escapeHtml(contact.address || '')}">
            </div>
          </label>
          <label class="dripp-field"><span>Address (Urdu)</span>
            <div class="dripp-input-wrap"><i class="fas fa-language"></i>
              <input type="text" name="addressUr" value="${escapeHtml(contact.addressUr || '')}">
            </div>
          </label>
          <label class="dripp-field dripp-form-full"><span>Leadership Blurb (English)</span>
            <div class="dripp-input-wrap"><i class="fas fa-quote-left"></i>
              <textarea name="leadership_blurb" rows="2">${escapeHtml(contact.leadership_blurb || '')}</textarea>
            </div>
          </label>
          <label class="dripp-field dripp-form-full"><span>Leadership Blurb (Urdu)</span>
            <div class="dripp-input-wrap"><i class="fas fa-quote-left"></i>
              <textarea name="leadership_blurbUr" rows="2">${escapeHtml(contact.leadership_blurbUr || '')}</textarea>
            </div>
          </label>
          <label class="dripp-field"><span>Footer Tagline (English)</span>
            <div class="dripp-input-wrap"><i class="fas fa-tag"></i>
              <input type="text" name="footer_tagline" value="${escapeHtml(contact.footer_tagline || '')}">
            </div>
          </label>
          <label class="dripp-field"><span>Footer Tagline (Urdu)</span>
            <div class="dripp-input-wrap"><i class="fas fa-language"></i>
              <input type="text" name="footer_taglineUr" value="${escapeHtml(contact.footer_taglineUr || '')}">
            </div>
          </label>
          <label class="dripp-field dripp-form-full"><span>Copyright</span>
            <div class="dripp-input-wrap"><i class="fas fa-copyright"></i>
              <input type="text" name="footer_copyright" value="${escapeHtml(contact.footer_copyright || '')}">
            </div>
          </label>
        </form>
        <div class="dripp-form-actions">
          <button class="dripp-btn dripp-btn-primary" id="saveContactTextBtn"><i class="fas fa-save"></i> Save Contact &amp; Footer</button>
        </div>
      </div>
    `;

    $('#saveHeroTextBtn', root).addEventListener('click', () => {
      const fd = new FormData($('#heroTextForm', root));
      state.data.site_content.hero = {
        title: String(fd.get('title') || '').trim(),
        titleUr: String(fd.get('titleUr') || '').trim(),
        subtitle: String(fd.get('subtitle') || '').trim(),
        subtitleUr: String(fd.get('subtitleUr') || '').trim(),
        cta: String(fd.get('cta') || '').trim(),
        ctaUr: String(fd.get('ctaUr') || '').trim(),
        badge: String(fd.get('badge') || '').trim()
      };
      saveData();
      commitAndToast('chore(cms): update hero text → ' + (state.data.site_content.hero.title || '(untitled)'));
      showToast('Hero text saved. Pushing to GitHub…', 'success');
    });

    $('#saveContactTextBtn', root).addEventListener('click', () => {
      const fd = new FormData($('#contactTextForm', root));
      state.data.site_content.contact = {
        address: String(fd.get('address') || '').trim(),
        addressUr: String(fd.get('addressUr') || '').trim(),
        leadership_blurb: String(fd.get('leadership_blurb') || '').trim(),
        leadership_blurbUr: String(fd.get('leadership_blurbUr') || '').trim(),
        footer_tagline: String(fd.get('footer_tagline') || '').trim(),
        footer_taglineUr: String(fd.get('footer_taglineUr') || '').trim(),
        footer_copyright: String(fd.get('footer_copyright') || '').trim()
      };
      saveData();
      commitAndToast('chore(cms): update contact & footer text');
      showToast('Contact & footer saved. Pushing to GitHub…', 'success');
    });
  }

  // GITHUB SYNC
  function renderGithubSync(root) {
    const cfg = getGhConfig() || {};
    const cfgJson = JSON.stringify(cfg, null, 2);

    root.innerHTML = `
      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fab fa-github"></i> GitHub Auto-Sync</h2>
        </div>
        <p style="color:var(--d-text-soft);font-size:0.85rem;margin-bottom:1rem;line-height:1.6;">
          When configured, clicking <strong>Publish</strong> in any CMS panel will commit the updated <code>data.json</code> directly to the GitHub repository. Vercel's GitHub integration will then trigger an automatic production rebuild, making the change visible to all global visitors across all devices.
        </p>
        <p style="color:var(--d-text-soft);font-size:0.8rem;margin-bottom:1rem;padding:0.75rem;background:rgba(249,168,38,0.08);border:1px solid rgba(249,168,38,0.3);border-radius:6px;">
          <i class="fas fa-shield-halved"></i> <strong>Security:</strong> Your GitHub token is stored only in this browser's LocalStorage. It is never sent anywhere except <code>api.github.com</code> for the commit.
        </p>
        <form id="ghForm" class="dripp-form-grid">
          <label class="dripp-field"><span>GitHub Username / Org</span>
            <div class="dripp-input-wrap"><i class="fas fa-user"></i>
              <input type="text" name="owner" value="${escapeHtml(cfg.owner || 'Dadddysboss')}" placeholder="Dadddysboss">
            </div>
          </label>
          <label class="dripp-field"><span>Repository Name</span>
            <div class="dripp-input-wrap"><i class="fas fa-folder"></i>
              <input type="text" name="repo" value="${escapeHtml(cfg.repo || 'moon-enterprises')}" placeholder="moon-enterprises">
            </div>
          </label>
          <label class="dripp-field"><span>Branch</span>
            <div class="dripp-input-wrap"><i class="fas fa-code-branch"></i>
              <input type="text" name="branch" value="${escapeHtml(cfg.branch || 'main')}" placeholder="main">
            </div>
          </label>
          <label class="dripp-field"><span>File Path</span>
            <div class="dripp-input-wrap"><i class="fas fa-file-code"></i>
              <input type="text" name="path" value="${escapeHtml(cfg.path || 'data.json')}" placeholder="data.json">
            </div>
          </label>
          <label class="dripp-field dripp-form-full"><span>Personal Access Token (fine-grained, repo:contents:write)</span>
            <div class="dripp-input-wrap"><i class="fas fa-key"></i>
              <input type="password" name="token" value="${escapeHtml(cfg.token || '')}" placeholder="github_pat_..." autocomplete="off">
            </div>
          </label>
          <label class="dripp-field dripp-form-full"><span>Commit Message Template</span>
            <div class="dripp-input-wrap"><i class="fas fa-message"></i>
              <input type="text" name="commitMsg" value="${escapeHtml(cfg.commitMsg || 'chore(cms): update data.json via Dripp CMS')}" placeholder="chore(cms): update data.json via Dripp CMS">
            </div>
          </label>
        </form>
        <div class="dripp-form-actions">
          <button class="dripp-btn" id="testGhBtn"><i class="fas fa-plug"></i> Test Connection</button>
          <button class="dripp-btn dripp-btn-primary" id="saveGhBtn"><i class="fas fa-save"></i> Save GitHub Config</button>
        </div>
      </div>

      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-rocket"></i> One-Click Publish</h2>
        </div>
        <p style="color:var(--d-text-soft);font-size:0.85rem;margin-bottom:1rem;">
          Commit the current <code>data.json</code> (with all your CMS edits) to the configured repository. Vercel will auto-deploy.
        </p>
        <div class="dripp-form-actions">
          <button class="dripp-btn dripp-btn-gold" id="publishGhBtn"><i class="fas fa-paper-plane"></i> Publish to GitHub &amp; Trigger Deploy</button>
        </div>
        <pre id="ghLog" style="background:var(--d-bg);padding:1rem;border-radius:6px;margin-top:1rem;font-size:0.75rem;max-height:240px;overflow:auto;color:var(--d-text-soft);display:none;white-space:pre-wrap;"></pre>
      </div>
    `;

    const showLog = (lines) => {
      const log = $('#ghLog', root);
      log.textContent = lines.join('\n');
      log.style.display = 'block';
    };

    $('#saveGhBtn', root).addEventListener('click', () => {
      const fd = new FormData($('#ghForm', root));
      cfg = {
        owner: String(fd.get('owner') || '').trim(),
        repo: String(fd.get('repo') || '').trim(),
        branch: String(fd.get('branch') || 'main').trim(),
        path: String(fd.get('path') || 'data.json').trim(),
        token: String(fd.get('token') || '').trim(),
        commitMsg: String(fd.get('commitMsg') || '').trim()
      };
      setGhConfig(cfg);
      showToast('GitHub config saved locally. Every CMS save will now push to GitHub automatically.', 'success');
    });

    $('#testGhBtn', root).addEventListener('click', async () => {
      const fd = new FormData($('#ghForm', root));
      const testCfg = {
        owner: String(fd.get('owner') || '').trim(),
        repo: String(fd.get('repo') || '').trim(),
        branch: String(fd.get('branch') || 'main').trim(),
        token: String(fd.get('token') || '').trim()
      };
      if (!testCfg.owner || !testCfg.repo || !testCfg.token) {
        showToast('Fill in owner, repo, and token first.', 'error');
        return;
      }
      showLog(['Testing connection to https://api.github.com/repos/' + testCfg.owner + '/' + testCfg.repo + ' ...']);
      try {
        const res = await fetch('https://api.github.com/repos/' + testCfg.owner + '/' + testCfg.repo, {
          headers: { 'Authorization': 'Bearer ' + testCfg.token, 'Accept': 'application/vnd.github+json' }
        });
        if (res.ok) {
          const data = await res.json();
          showLog(['✓ Connection successful', 'Repo: ' + data.full_name, 'Default branch: ' + data.default_branch, 'Visibility: ' + (data.private ? 'private' : 'public')]);
          showToast('GitHub connection OK.', 'success');
        } else {
          const err = await res.text();
          showLog(['✗ HTTP ' + res.status, err]);
          showToast('GitHub returned ' + res.status, 'error');
        }
      } catch (e) {
        showLog(['✗ Network error', e.message]);
        showToast('Network error — check console.', 'error');
      }
    });

    $('#publishGhBtn', root).addEventListener('click', async () => {
      const fd = new FormData($('#ghForm', root));
      const newCfg = {
        owner: String(fd.get('owner') || '').trim(),
        repo: String(fd.get('repo') || '').trim(),
        branch: String(fd.get('branch') || 'main').trim(),
        path: String(fd.get('path') || 'data.json').trim(),
        token: String(fd.get('token') || '').trim(),
        commitMsg: String(fd.get('commitMsg') || 'chore(cms): update data.json via Dripp CMS').trim()
      };
      if (!newCfg.owner || !newCfg.repo || !newCfg.token) {
        showToast('Configure GitHub first (owner, repo, token).', 'error');
        return;
      }
      setGhConfig(newCfg);
      showLog(['Publishing to https://api.github.com/repos/' + newCfg.owner + '/' + newCfg.repo + ' ...']);
      const result = await pushToGitHub(newCfg.commitMsg);
      if (result.ok) {
        showLog(['✓ Published!', 'Commit SHA: ' + result.sha, 'URL: ' + result.url, '', 'Vercel will detect the push and rebuild within ~30s.']);
      } else {
        showLog(['✗ Push failed: ' + (result.error || 'unknown')]);
      }
    });
  }

  function trackEvent(type, path, label) {
    try {
      fetch('/api/sync?action=track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type || 'pageview', path: path || '/', label: label || '' }),
        keepalive: true
      }).catch(() => {});
    } catch (e) {}
  }

  async function loadAnalytics() {
    try {
      const res = await fetch('/api/sync?action=analytics', { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  }
  function getGhConfig() {
    try {
      const raw = localStorage.getItem(STORAGE.GITHUB);
      if (raw) {
        const cfg = JSON.parse(raw);
        if (cfg && cfg.token) return cfg;
      }
    } catch (e) {}
    return null;
  }

  function setGhConfig(cfg) {
    try { localStorage.setItem(STORAGE.GITHUB, JSON.stringify(cfg)); } catch (e) {}
  }

  // Fire-and-forget GitHub commit. Returns a promise that resolves to {ok, url, error}
  function pushToGitHub(commitMsg, silent) {
    const cfg = getGhConfig();
    if (!cfg || !cfg.token) {
      if (!silent) showToast('GitHub not configured. Open GitHub Sync tab to set it up.', 'info');
      return Promise.resolve({ ok: false, error: 'no-config' });
    }
    const content = JSON.stringify(state.data, null, 2);
    const apiBase = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + cfg.path;
    const headers = {
      'Authorization': 'Bearer ' + cfg.token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
    const showResult = (result) => {
      if (result.ok) {
        showToast('✓ Published to GitHub (' + result.sha.substring(0,7) + '). Vercel will rebuild shortly.', 'success');
      } else if (result.error !== 'no-config' && !silent) {
        showToast('GitHub push failed: ' + (result.error || 'unknown'), 'error');
      }
    };
    return fetch(apiBase + '?ref=' + encodeURIComponent(cfg.branch), { headers })
      .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(new Error('GET ' + r.status + ': ' + t.substring(0, 200)))))
      .then(j => j.sha)
      .catch(err => {
        if (String(err).indexOf('404') !== -1) return null;
        throw err;
      })
      .then(sha => {
        const body = {
          message: commitMsg || 'chore(cms): update data.json via Dripp',
          content: btoa(unescape(encodeURIComponent(content))),
          branch: cfg.branch
        };
        if (sha) body.sha = sha;
        return fetch(apiBase, { method: 'PUT', headers, body: JSON.stringify(body) })
          .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(new Error('PUT ' + r.status + ': ' + t.substring(0, 200)))));
      })
      .then(r => {
        const result = { ok: true, sha: r.commit.sha, url: r.commit.html_url };
        showResult(result);
        return result;
      })
      .catch(err => {
        const result = { ok: false, error: String(err.message || err) };
        showResult(result);
        return result;
      });
  }

  // Helper to attach GitHub push to any save action. Show toast on success, error on failure.
  function commitAndToast(commitMsg) {
    pushToGitHub(commitMsg).then(r => {
      if (r.ok) console.log('GitHub push ok:', r.sha);
    });
  }

  // ============================================================
  // POS & SALES TERMINAL
  // ============================================================
  function readSales() {
    try {
      const raw = localStorage.getItem(STORAGE.SALES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    if (state.data && Array.isArray(state.data.sales)) return state.data.sales;
    return [];
  }

  function persistSales(sales) {
    try {
      localStorage.setItem(STORAGE.SALES, JSON.stringify(sales));
      state.data.sales = sales;
    } catch (e) {}
  }

  function parsePKR(s) {
    return parseFloat(String(s || '').replace(/[^\d.]/g, '')) || 0;
  }

  function renderPos(root) {
    const sales = readSales();
    const today = new Date().toISOString().slice(0, 10);
    const monthPrefix = today.slice(0, 7);
    const todays = sales.filter(s => s.date === today);
    const monthly = sales.filter(s => (s.date || '').startsWith(monthPrefix));
    const todayRev = todays.reduce((acc, s) => acc + parsePKR(s.amount), 0);
    const monthRev = monthly.reduce((acc, s) => acc + parsePKR(s.amount), 0);
    const totalRev = sales.reduce((acc, s) => acc + parsePKR(s.amount), 0);

    const talentTotals = {};
    sales.forEach(s => {
      const k = s.talentName || 'Unspecified';
      talentTotals[k] = (talentTotals[k] || 0) + parsePKR(s.amount);
    });
    const topTalent = Object.entries(talentTotals).sort((a, b) => b[1] - a[1])[0];

    const models = (state.data && Array.isArray(state.data.models)) ? state.data.models : [];
    const talentB = (state.data && Array.isArray(state.data.division_b_talent)) ? state.data.division_b_talent : [];
    const packages = (state.data && Array.isArray(state.data.package_deals)) ? state.data.package_deals : [];
    const allTalent = [
      ...models.map(m => ({ name: m.name, division: 'moon' })),
      ...talentB.map(m => ({ name: m.name, division: 'ali_hamza' })),
      ...packages.map(p => ({ name: 'Package: ' + p.title, division: p.division === 'division_b' ? 'ali_hamza' : 'moon' }))
    ];

    root.innerHTML = `
      <div class="dripp-stats">
        <div class="dripp-stat" style="border-color: rgba(34, 197, 94, 0.4);">
          <i class="fas fa-coins"></i>
          <div><div class="dripp-stat-value">PKR ${todayRev.toLocaleString()}</div><div class="dripp-stat-label">Today's Revenue</div></div>
        </div>
        <div class="dripp-stat gold">
          <i class="fas fa-calendar"></i>
          <div><div class="dripp-stat-value">PKR ${monthRev.toLocaleString()}</div><div class="dripp-stat-label">This Month</div></div>
        </div>
        <div class="dripp-stat blue">
          <i class="fas fa-chart-line"></i>
          <div><div class="dripp-stat-value">PKR ${totalRev.toLocaleString()}</div><div class="dripp-stat-label">All-Time Revenue</div></div>
        </div>
        <div class="dripp-stat">
          <i class="fas fa-receipt"></i>
          <div><div class="dripp-stat-value">${sales.length}</div><div class="dripp-stat-label">Total Sales</div></div>
        </div>
        <div class="dripp-stat" style="border-color: rgba(249, 168, 38, 0.4);">
          <i class="fas fa-trophy"></i>
          <div><div class="dripp-stat-value" style="font-size:1.1rem;">${topTalent ? escapeHtml(topTalent[0]) : '—'}</div><div class="dripp-stat-label">Top Talent ${topTalent ? '(PKR ' + topTalent[1].toLocaleString() + ')' : ''}</div></div>
        </div>
      </div>

      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-cash-register"></i> Manual Sale Entry</h2>
          <div class="dripp-panel-actions">
            <input type="text" id="posSearch" placeholder="Filter sales…" style="padding:0.5rem 0.75rem;background:var(--d-bg);border:1px solid var(--d-border);border-radius:6px;color:var(--d-text);font-size:0.85rem;width:180px;">
            <button class="dripp-btn" id="exportSalesCsvBtn"><i class="fas fa-file-csv"></i> Export CSV</button>
          </div>
        </div>
        <form id="posForm" class="dripp-form-grid">
          <label class="dripp-field"><span>Client Name *</span>
            <div class="dripp-input-wrap"><i class="fas fa-user"></i>
              <input type="text" name="clientName" required placeholder="e.g. Sara Khan">
            </div>
          </label>
          <label class="dripp-field"><span>Contact Number *</span>
            <div class="dripp-input-wrap"><i class="fas fa-phone"></i>
              <input type="tel" name="clientPhone" required placeholder="+92 300 1234567">
            </div>
          </label>
          <label class="dripp-field"><span>Model / Package *</span>
            <div class="dripp-input-wrap"><i class="fas fa-star"></i>
              <select name="talentName" required>
                <option value="">-- select talent --</option>
                ${allTalent.map(t => `<option value="${escapeHtml(t.name)}" data-division="${t.division}">${escapeHtml(t.name)} (${t.division === 'ali_hamza' ? 'Ali Hamza' : 'Moon'})</option>`).join('')}
              </select>
            </div>
          </label>
          <label class="dripp-field"><span>Total Amount (PKR) *</span>
            <div class="dripp-input-wrap"><i class="fas fa-coins"></i>
              <input type="text" name="amount" required placeholder="5000" inputmode="decimal">
            </div>
          </label>
          <label class="dripp-field"><span>Payment Method</span>
            <div class="dripp-input-wrap"><i class="fas fa-credit-card"></i>
              <select name="paymentMethod">
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="JazzCash">JazzCash</option>
                <option value="EasyPaisa">EasyPaisa</option>
                <option value="Card">Card</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </label>
          <label class="dripp-field"><span>Date &amp; Time</span>
            <div class="dripp-input-wrap"><i class="fas fa-calendar"></i>
              <input type="datetime-local" name="dateTime">
            </div>
          </label>
        </form>
        <div class="dripp-form-actions">
          <button class="dripp-btn dripp-btn-primary" id="submitPosBtn"><i class="fas fa-check"></i> Record Sale &amp; Push to GitHub</button>
          <button class="dripp-btn" id="resetPosBtn" type="button"><i class="fas fa-rotate"></i> Reset Form</button>
        </div>
      </div>

      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-list"></i> Sales Ledger</h2>
        </div>
        ${sales.length === 0 ? `
          <div class="dripp-empty"><i class="fas fa-cash-register"></i><p>No sales recorded yet. Use the form above to record your first sale.</p></div>
        ` : `
          <div class="dripp-table-wrap">
            <table class="dripp-table" id="posTable">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Phone</th>
                  <th>Model / Package</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="posTbody">
                ${sales.map((s, i) => `
                  <tr>
                    <td><code>${escapeHtml(s.id)}</code></td>
                    <td>${escapeHtml(s.dateTime || s.date || '')}</td>
                    <td><strong>${escapeHtml(s.clientName || '—')}</strong></td>
                    <td>${escapeHtml(s.clientPhone || '—')}</td>
                    <td>${escapeHtml(s.talentName || '—')}</td>
                    <td><strong>PKR ${parsePKR(s.amount).toLocaleString()}</strong></td>
                    <td>${escapeHtml(s.paymentMethod || '—')}</td>
                    <td class="dripp-actions-cell">
                      <button class="dripp-btn dripp-btn-sm" data-pos-receipt="${i}" title="Print Receipt"><i class="fas fa-print"></i></button>
                      <button class="dripp-btn dripp-btn-sm dripp-btn-danger" data-pos-delete="${i}" title="Delete"><i class="fas fa-trash"></i></button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    const posForm = $('#posForm', root);
    if (posForm) {
      const dateField = posForm.querySelector('[name="dateTime"]');
      if (dateField && !dateField.value) {
        const d = new Date();
        const pad = n => String(n).padStart(2, '0');
        dateField.value = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      }
    }

    const search = $('#posSearch', root);
    const tbody = $('#posTbody', root);
    if (search && tbody) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        $$('tr', tbody).forEach(row => {
          row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }

    const submitBtn = $('#submitPosBtn', root);
    if (submitBtn) submitBtn.addEventListener('click', () => {
      const fd = new FormData(posForm);
      const clientName = String(fd.get('clientName') || '').trim();
      const clientPhone = String(fd.get('clientPhone') || '').trim();
      const talentName = String(fd.get('talentName') || '').trim();
      const amount = String(fd.get('amount') || '').trim();
      const paymentMethod = String(fd.get('paymentMethod') || 'Cash');
      const dateTime = String(fd.get('dateTime') || '').trim();
      if (!clientName || !clientPhone || !talentName || !amount) {
        showToast('Please fill all required sale fields.', 'error');
        return;
      }
      const list = readSales();
      const sale = {
        id: 'INV-' + String(list.length + 1).padStart(4, '0') + '-' + Date.now().toString().slice(-4),
        clientName, clientPhone, talentName, amount, paymentMethod,
        date: dateTime ? dateTime.slice(0, 10) : new Date().toISOString().slice(0, 10),
        dateTime: dateTime || new Date().toISOString().slice(0, 16),
        createdAt: new Date().toISOString()
      };
      list.unshift(sale);
      persistSales(list);
      saveData();
      commitAndToast('chore(pos): record sale ' + sale.id + ' for ' + clientName);
      showToast('✓ Sale recorded: ' + sale.id, 'success');
      renderPos(root);
      updateCounts();
      if (confirm('Sale saved to GitHub!\n\nPrint receipt for ' + clientName + '?')) {
        printReceipt(sale);
      }
    });

    const resetBtn = $('#resetPosBtn', root);
    if (resetBtn) resetBtn.addEventListener('click', () => { posForm.reset(); });

    $$('[data-pos-receipt]', root).forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.posReceipt, 10);
      printReceipt(readSales()[i]);
    }));
    $$('[data-pos-delete]', root).forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.posDelete, 10);
      if (!confirm('Delete this sale record?')) return;
      const list = readSales();
      list.splice(i, 1);
      persistSales(list);
      saveData();
      commitAndToast('chore(pos): delete sale record');
      updateCounts();
      renderPos(root);
      showToast('Sale deleted.', 'info');
    }));

    const exp = $('#exportSalesCsvBtn', root);
    if (exp) exp.addEventListener('click', () => exportSalesCSV());
  }

  function printReceipt(sale) {
    const win = window.open('', '_blank', 'width=480,height=720');
    if (!win) { showToast('Allow pop-ups to print receipt.', 'error'); return; }
    const items = [
      ['Client', sale.clientName],
      ['Phone', sale.clientPhone],
      ['Talent / Package', sale.talentName],
      ['Amount', 'PKR ' + parsePKR(sale.amount).toLocaleString()],
      ['Payment', sale.paymentMethod],
      ['Date', sale.dateTime || sale.date]
    ];
    win.document.write(`<!DOCTYPE html><html><head><title>Receipt ${escapeHtml(sale.id)}</title>
      <style>
        body { font-family: 'Courier New', monospace; padding: 24px; max-width: 480px; margin: 0 auto; color: #1a1a2e; }
        h1 { text-align: center; margin: 0 0 4px; font-size: 18px; letter-spacing: 0.05em; }
        .sub { text-align: center; color: #666; font-size: 11px; margin-bottom: 16px; }
        hr { border: none; border-top: 1px dashed #ccc; margin: 12px 0; }
        .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .total { font-size: 16px; font-weight: bold; padding: 8px 0; border-top: 1px dashed #999; margin-top: 8px; }
        .footer { text-align: center; color: #888; font-size: 10px; margin-top: 24px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>MOON ENTERPRISES</h1>
      <div class="sub">Old Mandi Pattoki, Punjab, Pakistan</div>
      <div class="sub">WhatsApp: +92 314 755 3161 / +92 303 680 0682</div>
      <hr>
      <div class="row"><strong>Receipt</strong><span>${escapeHtml(sale.id)}</span></div>
      <div class="row"><span>Date</span><span>${escapeHtml(sale.dateTime || sale.date)}</span></div>
      <hr>
      ${items.map(([k, v]) => `<div class="row"><span>${k}</span><span>${escapeHtml(String(v))}</span></div>`).join('')}
      <div class="row total"><span>TOTAL</span><span>PKR ${parsePKR(sale.amount).toLocaleString()}</span></div>
      <div class="footer">Thank you for your business!<br>Generated by Dripp CMS</div>
      <script>window.onload = () => setTimeout(() => window.print(), 250);<\/script>
      </body></html>`);
    win.document.close();
  }

  function exportSalesCSV() {
    const sales = readSales();
    const headers = ['ID', 'Date', 'Client', 'Phone', 'Talent', 'Amount', 'Method', 'Created'];
    const rows = sales.map(s => [
      s.id, s.dateTime || s.date, s.clientName, s.clientPhone, s.talentName, s.amount, s.paymentMethod, s.createdAt
    ]);
    const escape = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sales-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('Sales CSV exported.', 'success');
  }

  // ============================================================
  // PENDING REVIEWS (public submission queue)
  // ============================================================
  function readPendingReviews() {
    try {
      const raw = localStorage.getItem(STORAGE.PENDING_REVIEWS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    if (state.data && Array.isArray(state.data.pending_reviews)) return state.data.pending_reviews;
    return [];
  }

  function persistPendingReviews(list) {
    try { localStorage.setItem(STORAGE.PENDING_REVIEWS, JSON.stringify(list)); } catch (e) {}
    state.data.pending_reviews = list;
  }

  function renderPendingReviews(root) {
    const pending = readPendingReviews();
    root.innerHTML = `
      <div class="dripp-panel">
        <div class="dripp-panel-header">
          <h2 class="dripp-panel-title"><i class="fas fa-hourglass-half"></i> Pending Public Reviews</h2>
          <div class="dripp-panel-actions">
            <button class="dripp-btn dripp-btn-danger" id="clearPendingBtn"><i class="fas fa-trash"></i> Clear All</button>
          </div>
        </div>
        <p style="color:var(--d-text-soft);font-size:0.85rem;margin-bottom:1rem;">
          Reviews submitted by visitors on the public site land here for moderation. Click <strong>Approve &amp; Publish</strong> to push them to GitHub — they will appear instantly on the public site for all visitors.
        </p>
        ${pending.length === 0 ? `
          <div class="dripp-empty"><i class="fas fa-inbox"></i><p>No pending reviews. Visitor submissions will queue here automatically.</p></div>
        ` : `
          <div class="dripp-table-wrap">
            <table class="dripp-table">
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Reviewer</th>
                  <th>Rating</th>
                  <th>Comment</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${pending.map((r, i) => {
                  const initials = (r.name || '?').charAt(0).toUpperCase();
                  return `
                    <tr>
                      <td>${r.image ? `<img src="${escapeHtml(r.image)}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 44%22><rect width=%2244%22 height=%2244%22 fill=%22%23262a52%22/><text x=%2250%25%22 y=%2250%25%22 font-size=%2214%22 fill=%22%239aa0bc%22 text-anchor=%22middle%22 dy=%22.3em%22>${initials}</text></svg>'" style="width:44px;height:44px;border-radius:50%;object-fit:cover;">` : `<div class="review-avatar" style="width:44px;height:44px;">${initials}</div>`}</td>
                      <td><strong>${escapeHtml(r.name || 'Anonymous')}</strong></td>
                      <td style="color:#fbbf4a">${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</td>
                      <td><small>${escapeHtml((r.comment || '').slice(0, 80))}${(r.comment || '').length > 80 ? '…' : ''}</small></td>
                      <td>${escapeHtml(r.submittedAt || r.date || '')}</td>
                      <td class="dripp-actions-cell">
                        <button class="dripp-btn dripp-btn-sm" style="background:rgba(34,197,94,0.18);border-color:rgba(34,197,94,0.4);" data-pa-approve="${i}" title="Approve & Publish"><i class="fas fa-check"></i></button>
                        <button class="dripp-btn dripp-btn-sm" data-pa-edit="${i}" title="Edit"><i class="fas fa-pen"></i></button>
                        <button class="dripp-btn dripp-btn-sm dripp-btn-danger" data-pa-delete="${i}" title="Delete"><i class="fas fa-trash"></i></button>
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    $$('[data-pa-approve]', root).forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.paApprove, 10);
      const list = readPendingReviews();
      const r = list[i];
      if (!r) return;
      r.status = 'approved';
      r.verified = true;
      r.approvedAt = new Date().toISOString();
      const all = readCmsReviews();
      all.unshift(r);
      persistCmsReviews(all);
      list.splice(i, 1);
      persistPendingReviews(list);
      saveData();
      updateCounts();
      commitAndToast('chore(reviews): approve ' + r.name);
      renderPendingReviews(root);
      showToast('✓ Review approved & published to GitHub.', 'success');
    }));
    $$('[data-pa-edit]', root).forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.paEdit, 10);
      const r = readPendingReviews()[i];
      if (!r) return;
      const newName = prompt('Reviewer name:', r.name);
      if (newName === null) return;
      const newComment = prompt('Comment:', r.comment);
      if (newComment === null) return;
      const newRating = prompt('Rating (1-5):', String(r.rating || 5));
      if (newRating === null) return;
      const list = readPendingReviews();
      list[i].name = newName.trim();
      list[i].comment = newComment.trim();
      list[i].rating = parseInt(newRating, 10) || 5;
      persistPendingReviews(list);
      commitAndToast('chore(reviews): edit pending review');
      renderPendingReviews(root);
      showToast('Pending review updated.', 'success');
    }));
    $$('[data-pa-delete]', root).forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.paDelete, 10);
      if (!confirm('Delete this pending review?')) return;
      const list = readPendingReviews();
      list.splice(i, 1);
      persistPendingReviews(list);
      commitAndToast('chore(reviews): delete pending review');
      updateCounts();
      renderPendingReviews(root);
      showToast('Pending review deleted.', 'info');
    }));

    const clear = $('#clearPendingBtn', root);
    if (clear) clear.addEventListener('click', () => {
      if (!confirm('Clear ALL pending reviews?')) return;
      persistPendingReviews([]);
      updateCounts();
      renderPendingReviews(root);
    });
  }

  async function init() {
    setupLogin();
    setupLogout();
    setupNav();
    setupIdleWatchdog();
    if (checkAuth()) {
      await loadData();
      showDashboard();
    } else {
      showLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();