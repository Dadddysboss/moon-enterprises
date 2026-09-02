(function () {
  'use strict';

  const WHATSAPP_NUMBER = '923147553161';
  const DEFAULT_LANG = 'en';
  const LANG_STORAGE_KEY = 'moon_enterprises_lang';
  const DATA_URL = 'data.json';
  const CMS_KEYS = ['dripp_cms_data', 'dripp_data'];
  const HERO_KEYS = ['dripp_cms_hero', 'dripp_hero'];
  const NEWS_KEY = 'dripp_cms_news';
  const REVIEWS_KEY = 'dripp_cms_reviews';
  const PENDING_REVIEWS_KEY = 'dripp_cms_pending_reviews';

  function trackEvent(type, path, label) {
    try {
      fetch('/api/sync?action=track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type || 'pageview', path: path || (typeof location !== 'undefined' ? location.pathname : '/'), label: label || '' }),
        keepalive: true
      }).catch(() => {});
    } catch (e) {}
  }

  const I18N_STRINGS = {
    en: {
      brandName: 'Moon Enterprises',
      navLeadership: 'Leadership',
      navModels: 'Our Talent',
      navDivisionB: 'Division B',
      navPackages: 'Packages',
      navReviews: 'Reviews',
      navContact: 'Contact',
      heroTitle: 'Premier Talent Agency',
      heroSubtitle: 'Connecting exceptional talent with world-class opportunities',
      heroCta: 'View Our Talent',
      leadershipTitle: 'Leadership Team',
      leadershipSubtitle: 'Meet the visionaries behind Moon Enterprises',
      modelsTitle: 'Our Talent',
      modelsSubtitle: 'Discover our diverse roster of professional models',
      contactTitle: 'Get In Touch',
      contactSubtitle: 'Ready to book talent? Contact our manager directly',
      managerName: 'Moon (Muni)',
      managerRole: 'Operations Manager & Lead Broker',
      whatsappChat: 'Chat on WhatsApp',
      staffCount: 'Service Staff',
      modelsCount: 'Models',
      priceRange: 'PKR Range',
      divisionBBadge: 'Division B',
      divisionBTitle: 'Ali Hamza Division',
      divisionBSubtitle: 'Commercial & Event Talent — Stage, Hosting, Ushering and More',
      divisionATab: 'Moon Division',
      divisionBTab: 'Ali Hamza Division',
      packagesTitle: 'Special Package Deals',
      packagesSubtitle: 'Curated multi-talent bundles at exclusive discounted rates',
      reviewsTitle: 'Client Reviews',
      reviewsSubtitle: 'Trusted by brands and event organizers across the country',
      leaveReview: 'Leave a Review',
      formName: 'Your Name',
      formRating: 'Your Rating',
      formComment: 'Your Review',
      formSubmit: 'Submit Review',
      formStatusReview: 'Your review is saved locally. Thank you!',
      formStatusError: 'Please fill in all fields and pick a rating.',
      packageBookCta: 'Book Package',
      packageOriginal: 'Original',
      packageSavings: 'SAVE',
      packageRoutedTo: 'Routed to:',
      packageRoutedMoon: 'Moon Division',
      packageRoutedAli: 'Ali Hamza Division',
      avgRating: 'Average Rating',
      basedOn: 'Based on',
      reviewsCount: 'reviews',
      footerTagline: 'Empowering talent, delivering excellence',
      footerCopyright: '© 2026 Moon Enterprises. All rights reserved.',
      ageLabel: 'Age',
      genderLabel: 'Gender',
      occupationLabel: 'Occupation',
      pricingLabel: 'Pricing',
      inquiryButton: 'Inquire on WhatsApp',
      viewMore: 'Inquire Now',
      langButton: 'EN',
      modalMetrics: 'Profile Metrics',
      modalBio: 'Biography',
      modalReviews: 'Reviews',
      modalWriteReview: 'Write a Review',
      modalReviewerName: 'Your Name',
      modalReviewerComment: 'Your Review',
      modalReviewerRating: 'Your Rating',
      modalUploadImage: 'Upload Your Photo',
      modalImageRequired: 'Image upload is required to submit a review.',
      modalSubmitReview: 'Submit Review',
      modalNoReviews: 'No reviews yet. Be the first!',
      modalInquiry: 'Inquire on WhatsApp',
      modalClose: 'Close',
      metricHeight: 'Height',
      metricWeight: 'Weight',
      metricWaist: 'Waist',
      metricAge: 'Age',
      metricOccupation: 'Occupation',
      metricLocation: 'Location',
      metricCategory: 'Category',
      rtl: false
    },
    ur: {
      brandName: 'مون انٹرپرائزز',
      navLeadership: 'قیادت',
      navModels: 'ہماری ٹیلنٹ',
      navDivisionB: 'ڈویژن بی',
      navPackages: 'پیکجز',
      navReviews: 'جائزے',
      navContact: 'رابطہ',
      heroTitle: 'پریمیئر ٹیلنٹ ایجنسی',
      heroSubtitle: 'بہترین ٹیلنٹ کو عالمی معیار کے مواقع سے جوڑنا',
      heroCta: 'ہماری ٹیلنٹ دیکھیں',
      leadershipTitle: 'قیادت کی ٹیم',
      leadershipSubtitle: 'مون انٹرپرائزز کے پیچھے کے وژنریز سے ملیں',
      modelsTitle: 'ہماری ٹیلنٹ',
      modelsSubtitle: 'ہمارے متنوع پیشہ ور ماڈلز دریافت کریں',
      contactTitle: 'رابطے میں رہیں',
      contactSubtitle: 'ٹیلنٹ بک کرنے کے لیے تیار ہیں؟ ہمارے مینیجر سے براہ راست رابطہ کریں',
      managerName: 'مون (مونی)',
      managerRole: 'آپریشنز مینیجر اور لیڈ بروکر',
      whatsappChat: 'واٹس ایپ پر چیٹ کریں',
      staffCount: 'سروس سٹاف',
      modelsCount: 'ماڈلز',
      priceRange: 'PKR رینج',
      divisionBBadge: 'ڈویژن بی',
      divisionBTitle: 'علی حمزہ ڈویژن',
      divisionBSubtitle: 'کمرشل اور ایونٹ ٹیلنٹ — اسٹیج، ہوسٹنگ، اشرنگ اور مزید',
      divisionATab: 'مون ڈویژن',
      divisionBTab: 'علی حمزہ ڈویژن',
      packagesTitle: 'خصوصی پیکج ڈیلز',
      packagesSubtitle: 'خصوصی رعایتی قیمتوں پر منتخب کثیر ٹیلنٹ بنڈلز',
      reviewsTitle: 'کلائنٹ کے جائزے',
      reviewsSubtitle: 'ملک بھر کے برانڈز اور ایونٹ آرگنائزرز کا اعتماد',
      leaveReview: 'جائزہ دیں',
      formName: 'آپ کا نام',
      formRating: 'آپ کی درجہ بندی',
      formComment: 'آپ کا جائزہ',
      formSubmit: 'جائزہ جمع کریں',
      formStatusReview: 'آپ کا جائزہ مقامی طور پر محفوظ ہو گیا ہے۔ شکریہ!',
      formStatusError: 'براہ کرم تمام خانے بھریں اور درجہ بندی منتخب کریں۔',
      packageBookCta: 'پیکج بک کریں',
      packageOriginal: 'اصل',
      packageSavings: 'بچت',
      packageRoutedTo: 'رابطہ:',
      packageRoutedMoon: 'مون ڈویژن',
      packageRoutedAli: 'علی حمزہ ڈویژن',
      avgRating: 'اوسط درجہ بندی',
      basedOn: 'کی بنیاد پر',
      reviewsCount: 'جائزے',
      footerTagline: 'ٹیلنٹ کو بااختیار بنانا، بہترین خدمات فراہم کرنا',
      footerCopyright: '© 2026 مون انٹرپرائزز۔ جملہ حقوق محفوظ ہیں۔',
      ageLabel: 'عمر',
      genderLabel: 'جنس',
      occupationLabel: 'پیشہ',
      pricingLabel: 'قیمت',
      inquiryButton: 'واٹس ایپ پر پوچھ گچھ',
      viewMore: 'ابھی پوچھیں',
      langButton: 'UR',
      modalMetrics: 'پروفائل میٹرکس',
      modalBio: 'سوانح',
      modalReviews: 'جائزے',
      modalWriteReview: 'جائزہ لکھیں',
      modalReviewerName: 'آپ کا نام',
      modalReviewerComment: 'آپ کا جائزہ',
      modalReviewerRating: 'آپ کی درجہ بندی',
      modalUploadImage: 'اپنی تصویر اپ لوڈ کریں',
      modalImageRequired: 'جائزہ جمع کرانے کے لیے تصویر اپ لوڈ کرنا ضروری ہے۔',
      modalSubmitReview: 'جائزہ جمع کریں',
      modalNoReviews: 'ابھی تک کوئی جائزہ نہیں ہے۔ پہلے آپ بنیں!',
      modalInquiry: 'واٹس ایپ پر پوچھ گچھ',
      modalClose: 'بند کریں',
      metricHeight: 'قد',
      metricWeight: 'وزن',
      metricWaist: 'کمر',
      metricAge: 'عمر',
      metricOccupation: 'پیشہ',
      metricLocation: 'مقام',
      metricCategory: 'زمرہ',
      rtl: true
    }
  };

  const state = {
    lang: DEFAULT_LANG,
    data: null
  };

  function getStoredLang() {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored && I18N_STRINGS[stored]) return stored;
    } catch (e) {
      console.warn('LocalStorage unavailable:', e);
    }
    return DEFAULT_LANG;
  }

  function setStoredLang(lang) {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (e) {
      console.warn('Could not persist language preference:', e);
    }
  }

  function t(key) {
    return I18N_STRINGS[state.lang][key] || I18N_STRINGS.en[key] || key;
  }

  function splitBilingual(text) {
    if (!text) return { en: '', ur: '' };
    const parts = String(text).split('/').map(s => s.trim());
    return {
      en: parts[0] || '',
      ur: parts[1] || parts[0] || ''
    };
  }

  function getLocalizedBilingual(text) {
    const split = splitBilingual(text);
    return state.lang === 'ur' ? split.ur : split.en;
  }

  function readCmsPayload() {
    for (const k of CMS_KEYS) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.payload && typeof parsed.payload === 'object') {
          return { source: k, payload: parsed.payload, savedAt: parsed.savedAt || null };
        }
        if (parsed && typeof parsed === 'object' && !parsed.savedAt) {
          return { source: k, payload: parsed, savedAt: null };
        }
      } catch (e) {}
    }
    return null;
  }

  function readCmsHero() {
    for (const k of HERO_KEYS) {
      try {
        const v = localStorage.getItem(k);
        if (v) return v;
      } catch (e) {}
    }
    return null;
  }

  function readCmsNews() {
    try {
      const raw = localStorage.getItem(NEWS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  async function fetchData() {
    const cms = readCmsPayload();
    const cmsHero = readCmsHero();
    const cmsNews = readCmsNews();

    let liveData = null;
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      liveData = await response.json();
    } catch (error) {
      console.warn('Could not fetch data.json (will rely on localStorage if present):', error);
    }

    let finalData;
    if (cms && cms.payload) {
      finalData = cms.payload;
    } else if (liveData) {
      finalData = liveData;
    } else {
      finalData = { models: [], division_b_talent: [], package_deals: [], news: [], divisions: {}, agency: {}, leadership: {} };
    }

    if (liveData && cms && cms.payload) {
      finalData = mergeData(cms.payload, liveData);
    }

    if (cmsNews && Array.isArray(cmsNews)) {
      finalData.news = cmsNews;
    }

    state.cmsHero = cmsHero;
    state.data = finalData;
    applyHeroOverride();
    return state.data;
  }

  function mergeData(stored, live) {
    if (!live) return stored;
    return {
      ...live,
      models: (stored.models && stored.models.length) ? stored.models : (live.models || []),
      division_b_talent: (stored.division_b_talent && stored.division_b_talent.length) ? stored.division_b_talent : (live.division_b_talent || []),
      package_deals: (stored.package_deals && stored.package_deals.length) ? stored.package_deals : (live.package_deals || []),
      news: (stored.news && stored.news.length) ? stored.news : (live.news || [])
    };
  }

  function applyHeroOverride() {
    if (state.cmsHero) {
      const img = document.querySelector('.hero-image');
      if (img && img.tagName === 'IMG') img.src = state.cmsHero;
    }
    const sc = state.data && state.data.site_content;
    if (!sc) return;
    const isUr = state.lang === 'ur';
    const hero = sc.hero || {};
    const titleEl = document.querySelector('[data-i18n="heroTitle"]');
    if (titleEl && (isUr ? hero.titleUr : hero.title)) titleEl.textContent = isUr ? hero.titleUr : hero.title;
    const subEl = document.querySelector('[data-i18n="heroSubtitle"]');
    if (subEl && (isUr ? hero.subtitleUr : hero.subtitle)) subEl.textContent = isUr ? hero.subtitleUr : hero.subtitle;
    const ctaEl = document.querySelector('[data-i18n="heroCta"]');
    if (ctaEl && (isUr ? hero.ctaUr : hero.cta)) ctaEl.textContent = isUr ? hero.ctaUr : hero.cta;
    const contact = sc.contact || {};
    const tagEl = document.querySelector('[data-i18n="footerTagline"]');
    if (tagEl && (isUr ? contact.footer_taglineUr : contact.footer_tagline)) tagEl.textContent = isUr ? contact.footer_taglineUr : contact.footer_tagline;
    const cpEl = document.querySelector('[data-i18n="footerCopyright"]');
    if (cpEl && contact.footer_copyright) cpEl.textContent = contact.footer_copyright;
  }

  async function refreshFromCms() {
    try {
      await fetchData();
      renderLeadership();
      renderModels();
      renderDivisionB();
      renderPackages();
      renderAllReviews();
      applyHeroOverride();
    } catch (e) {
      console.warn('CMS refresh failed:', e);
    }
  }

  function setupCmsSync() {
    window.addEventListener('storage', (e) => {
      if (!e.key) return;
      const watched = [...CMS_KEYS, ...HERO_KEYS, NEWS_KEY, REVIEWS_KEY, PENDING_REVIEWS_KEY];
      if (watched.indexOf(e.key) !== -1) {
        refreshFromCms();
      }
    });
  }

  function showError(message) {
    const main = document.querySelector('main');
    if (!main) return;
    const errorEl = document.createElement('div');
    errorEl.className = 'error-banner';
    errorEl.style.cssText = 'background:#fee;border:1px solid #fcc;color:#c33;padding:1rem;margin:1rem;border-radius:8px;text-align:center;';
    errorEl.textContent = message;
    main.prepend(errorEl);
  }

  function getImageFallback(name) {
    const initials = String(name).trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1a1a2e"/>
          <stop offset="100%" stop-color="#e94560"/>
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#g)"/>
      <text x="50%" y="50%" font-family="Segoe UI, sans-serif" font-size="120" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${initials}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function handleImageError(img) {
    const alt = img.alt || 'Talent';
    img.onerror = null;
    img.src = getImageFallback(alt);
    img.style.objectFit = 'cover';
  }

  function createLeadershipCard(leader, type, divisionKey) {
    const card = document.createElement('article');
    card.className = `leadership-card ${type}`;
    card.setAttribute('data-card-type', 'leadership');
    card.setAttribute('data-name', leader.name);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Inquire about ${leader.name}`);

    const img = document.createElement('img');
    img.className = 'leadership-image';
    img.src = leader.image;
    img.alt = leader.name;
    img.loading = 'lazy';
    img.onerror = () => handleImageError(img);

    const content = document.createElement('div');
    content.className = 'leadership-content';

    const name = document.createElement('h3');
    name.className = 'leadership-name';
    name.textContent = leader.name;

    const title = document.createElement('span');
    title.className = 'leadership-title';
    title.textContent = getLocalizedBilingual(leader.title);

    const details = document.createElement('div');
    details.className = 'leadership-details';

    if (leader.age != null) details.appendChild(createDetail('fas fa-birthday-cake', `${t('ageLabel')}: ${leader.age}`));
    if (leader.gender) details.appendChild(createDetail('fas fa-venus-mars', `${t('genderLabel')}: ${getLocalizedBilingual(leader.gender)}`));
    if (leader.occupation) details.appendChild(createDetail('fas fa-briefcase', `${t('occupationLabel')}: ${getLocalizedBilingual(leader.occupation)}`));

    const pricing = document.createElement('div');
    pricing.className = 'leadership-pricing';
    pricing.innerHTML = `<strong>${t('pricingLabel')}:</strong> ${getLocalizedBilingual(leader.pricing)}`;

    content.append(name, title, details, pricing);
    card.append(img, content);

    card.addEventListener('click', () => handleInquiry(leader, divisionKey));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleInquiry(leader, divisionKey);
      }
    });

    return card;
  }

  function createDetail(iconClass, text) {
    const detail = document.createElement('div');
    detail.className = 'leadership-detail';
    detail.innerHTML = `<i class="${iconClass}"></i><span>${escapeHtml(text)}</span>`;
    return detail;
  }

  function createModelCard(model, divisionKey) {
    const card = document.createElement('article');
    card.className = 'model-card';
    card.setAttribute('data-card-type', 'model');
    card.setAttribute('data-id', model.id);
    card.setAttribute('data-name', model.name);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Inquire about ${model.name}`);

    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'model-image-wrapper';

    const img = document.createElement('img');
    img.className = 'model-image';
    img.src = model.image;
    img.alt = model.name;
    img.loading = 'lazy';
    img.onerror = () => handleImageError(img);

    const overlay = document.createElement('div');
    overlay.className = 'model-overlay';
    const overlayContent = document.createElement('div');
    overlayContent.className = 'model-overlay-content';
    const overlayName = document.createElement('div');
    overlayName.className = 'model-overlay-name';
    overlayName.textContent = model.name;
    const overlaySpecialty = document.createElement('div');
    overlaySpecialty.className = 'model-overlay-specialty';
    overlaySpecialty.textContent = getLocalizedBilingual(model.specialty);
    overlayContent.append(overlayName, overlaySpecialty);
    overlay.appendChild(overlayContent);
    imgWrapper.append(img, overlay);

    const content = document.createElement('div');
    content.className = 'model-content';

    if (model.category) {
      const cat = document.createElement('span');
      cat.className = 'model-category';
      cat.textContent = model.category;
      content.appendChild(cat);
    }

    const name = document.createElement('h3');
    name.className = 'model-name';
    name.textContent = model.name;

    const specialty = document.createElement('p');
    specialty.className = 'model-specialty';
    specialty.textContent = getLocalizedBilingual(model.specialty);

    const pricing = document.createElement('div');
    pricing.className = 'model-pricing';
    pricing.textContent = model.pricing;

    const btn = document.createElement('button');
    btn.className = 'btn btn-whatsapp model-btn';
    btn.type = 'button';
    btn.innerHTML = `<i class="fas fa-eye"></i><span>${t('viewMore')}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModelModal(model, divisionKey);
    });

    content.append(name, specialty, pricing, btn);
    card.append(imgWrapper, content);

    card.addEventListener('click', () => {
      trackEvent('talent-click', '#' + (divisionKey === 'ali_hamza' ? 'division-b' : 'models'), model.name);
      recordTalentView(model, divisionKey);
      openModelModal(model, divisionKey);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trackEvent('talent-click', '#' + (divisionKey === 'ali_hamza' ? 'division-b' : 'models'), model.name);
        recordTalentView(model, divisionKey);
        openModelModal(model, divisionKey);
      }
    });

    return card;
  }

  function renderLeadership() {
    const container = document.getElementById('leadershipGrid');
    if (!container || !state.data) return;
    container.innerHTML = '';
    const { ceo, manager } = state.data.leadership;
    container.append(
      createLeadershipCard(ceo, 'ceo', 'moon'),
      createLeadershipCard(manager, 'manager', 'moon')
    );
  }

  function renderModels() {
    const container = document.getElementById('modelsGrid');
    if (!container || !state.data) return;
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    state.data.models.forEach(model => fragment.appendChild(createModelCard(model, 'moon')));
    container.appendChild(fragment);
  }

  function renderDivisionB() {
    const leadershipContainer = document.getElementById('divisionBLeadership');
    const gridContainer = document.getElementById('divisionBGrid');
    if (!state.data) return;
    if (leadershipContainer) {
      leadershipContainer.innerHTML = '';
      const m = state.data.division_b_leadership.manager;
      leadershipContainer.appendChild(createLeadershipCard(m, 'manager-b', 'ali_hamza'));
    }
    if (gridContainer) {
      gridContainer.innerHTML = '';
      const fragment = document.createDocumentFragment();
      (state.data.division_b_talent || []).forEach(model => fragment.appendChild(createModelCard(model, 'ali_hamza')));
      gridContainer.appendChild(fragment);
    }
  }

  function computeSavings(original, discounted) {
    const o = parseFloat(String(original).replace(/[^\d.]/g, ''));
    const d = parseFloat(String(discounted).replace(/[^\d.]/g, ''));
    if (!isFinite(o) || !isFinite(d) || o <= 0) return 0;
    return Math.round(((o - d) / o) * 100);
  }

  function createPackageCard(deal) {
    const card = document.createElement('article');
    const divisionKey = deal.targetManager || 'moon';
    card.className = `package-card ${deal.division === 'division_b' ? 'division-b' : 'division-a'}`;
    card.setAttribute('data-deal-id', deal.id);
    card.setAttribute('data-card-type', 'package');
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Book package: ${deal.title}`);

    if (deal.badge) {
      const badge = document.createElement('span');
      badge.className = 'package-badge';
      badge.textContent = deal.badge;
      card.appendChild(badge);
    }

    const collage = document.createElement('div');
    collage.className = 'package-collage';
    (deal.collageImages || []).slice(0, 2).forEach((src, i) => {
      const img = document.createElement('img');
      img.className = 'package-collage-image';
      img.src = src;
      img.alt = deal.title + ' model ' + (i + 1);
      img.loading = 'lazy';
      img.onerror = () => handleImageError(img);
      collage.appendChild(img);
    });
    if ((deal.collageImages || []).length === 2) {
      const divider = document.createElement('div');
      divider.className = 'package-collage-divider';
      collage.appendChild(divider);
      const tag = document.createElement('span');
      tag.className = 'package-collage-tag';
      tag.textContent = '2-MODEL BUNDLE';
      collage.appendChild(tag);
    }
    card.appendChild(collage);

    const body = document.createElement('div');
    body.className = 'package-body';

    const title = document.createElement('h3');
    title.className = 'package-title';
    title.textContent = state.lang === 'ur' && deal.titleUr ? deal.titleUr : deal.title;
    body.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'package-description';
    desc.textContent = getLocalizedBilingual(deal.description);
    body.appendChild(desc);

    const target = document.createElement('div');
    target.className = 'package-target';
    const targetLabel = document.createElement('i');
    targetLabel.className = divisionKey === 'ali_hamza' ? 'fas fa-user-tie' : 'fas fa-user-astronaut';
    target.appendChild(targetLabel);
    const targetText = document.createElement('span');
    targetText.textContent = `${t('packageRoutedTo')} ${divisionKey === 'ali_hamza' ? t('packageRoutedAli') : t('packageRoutedMoon')}`;
    target.appendChild(targetText);
    body.appendChild(target);

    const pricing = document.createElement('div');
    pricing.className = 'package-pricing';
    const original = document.createElement('span');
    original.className = 'package-original';
    original.textContent = `${t('packageOriginal')}: ${deal.originalPrice}`;
    pricing.appendChild(original);
    const discounted = document.createElement('span');
    discounted.className = 'package-discounted';
    discounted.textContent = deal.discountedPrice;
    pricing.appendChild(discounted);
    const pct = computeSavings(deal.originalPrice, deal.discountedPrice);
    if (pct > 0) {
      const save = document.createElement('span');
      save.className = 'package-savings';
      save.textContent = `${t('packageSavings')} ${pct}%`;
      pricing.appendChild(save);
    }
    body.appendChild(pricing);

    const btn = document.createElement('button');
    btn.className = 'btn btn-whatsapp';
    btn.type = 'button';
    btn.innerHTML = `<i class="fab fa-whatsapp"></i><span>${t('packageBookCta')}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePackageInquiry(deal);
    });
    body.appendChild(btn);

    card.appendChild(body);

    card.addEventListener('click', () => { trackEvent('package-view', '#packages', deal.title); handlePackageInquiry(deal); });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trackEvent('package-view', '#packages', deal.title);
        handlePackageInquiry(deal);
      }
    });

    return card;
  }

  function renderPackages() {
    const container = document.getElementById('packagesGrid');
    if (!container || !state.data) return;
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    (state.data.package_deals || []).forEach(deal => fragment.appendChild(createPackageCard(deal)));
    container.appendChild(fragment);
  }

  function createStarIcons(rating) {
    const max = 5;
    let html = '';
    for (let i = 1; i <= max; i++) {
      const filled = i <= rating;
      html += `<i class="${filled ? 'fas' : 'far'} fa-star${filled ? '' : ' empty'}"></i>`;
    }
    return html;
  }

  function getInitials(name) {
    return String(name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  function createReviewCard(review) {
    const card = document.createElement('article');
    card.className = 'review-card';

    const header = document.createElement('div');
    header.className = 'review-card-header';

    const avatar = document.createElement('div');
    avatar.className = 'review-avatar';
    avatar.textContent = getInitials(review.name);
    header.appendChild(avatar);

    const meta = document.createElement('div');
    meta.className = 'review-meta';
    const author = document.createElement('div');
    author.className = 'review-author';
    const authorName = document.createElement('span');
    authorName.textContent = review.name;
    author.appendChild(authorName);
    if (review.verified) {
      const v = document.createElement('span');
      v.className = 'review-verified';
      v.innerHTML = '<i class="fas fa-check-circle"></i> Verified';
      author.appendChild(v);
    }
    meta.appendChild(author);
    if (review.date) {
      const date = document.createElement('div');
      date.className = 'review-date';
      try {
        const d = new Date(review.date);
        date.textContent = isNaN(d.getTime()) ? review.date : d.toLocaleDateString(state.lang === 'ur' ? 'ur-PK' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      } catch (e) { date.textContent = review.date; }
      meta.appendChild(date);
    }
    header.appendChild(meta);
    card.appendChild(header);

    const stars = document.createElement('div');
    stars.className = 'review-stars';
    stars.innerHTML = createStarIcons(review.rating || 0);
    card.appendChild(stars);

    const comment = document.createElement('p');
    comment.className = 'review-comment';
    const commentText = state.lang === 'ur' && review.commentUr ? review.commentUr : review.comment;
    comment.textContent = commentText;
    card.appendChild(comment);

    return card;
  }

  function computeAverage(reviews) {
    if (!reviews || !reviews.length) return { avg: 0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return { avg: sum / reviews.length, count: reviews.length };
  }

  function renderReviewsSummary(containerId, reviews) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    const { avg, count } = computeAverage(reviews);
    const rounded = Math.round(avg * 10) / 10;

    const score = document.createElement('div');
    score.className = 'reviews-summary-score';
    score.textContent = rounded.toFixed(1);
    el.appendChild(score);

    const center = document.createElement('div');
    const stars = document.createElement('div');
    stars.className = 'reviews-summary-stars';
    stars.innerHTML = createStarIcons(Math.round(avg));
    center.appendChild(stars);
    const meta = document.createElement('div');
    meta.className = 'reviews-summary-meta';
    meta.textContent = `${t('basedOn')} ${count} ${t('reviewsCount')}`;
    center.appendChild(meta);
    el.appendChild(center);
  }

  function renderReviewsGrid(containerId, reviews) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    const fragment = document.createDocumentFragment();
    reviews.forEach(r => fragment.appendChild(createReviewCard(r)));
    el.appendChild(fragment);
  }

  function getUserReviews(divisionKey) {
    try {
      const raw = localStorage.getItem('moon_user_reviews_' + divisionKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveUserReview(divisionKey, review) {
    try {
      const list = getUserReviews(divisionKey);
      list.unshift(review);
      localStorage.setItem('moon_user_reviews_' + divisionKey, JSON.stringify(list));
    } catch (e) { console.warn('Could not save review:', e); }
  }

  function getCmsReviews() {
    try {
      const raw = localStorage.getItem('dripp_cms_reviews');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(r => r && r.status === 'approved' && r.name);
      }
    } catch (e) {}
    return (state.data && Array.isArray(state.data.cms_reviews)) ? state.data.cms_reviews.filter(r => r && r.status === 'approved' && r.name) : [];
  }

  function renderAllReviews() {
    if (!state.data || !state.data.reviews) return;
    const cmsAll = getCmsReviews();
    ['division_a', 'division_b'].forEach(key => {
      const seeded = state.data.reviews[key] || [];
      const user = getUserReviews(key);
      const combined = user.concat(cmsAll, seeded);
      renderReviewsSummary('reviewsSummary' + (key === 'division_a' ? 'A' : 'B'), combined);
      renderReviewsGrid('reviewsGrid' + (key === 'division_a' ? 'A' : 'B'), combined);
    });
  }

  function queuePendingReview(review) {
    try {
      const key = 'dripp_cms_pending_reviews';
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      review.submittedAt = new Date().toISOString();
      review.status = 'pending';
      list.unshift(review);
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) { console.warn('Could not queue review:', e); }
  }

  // Direct GitHub push from public site (no admin needed). Best-effort.
  async function tryDirectGitHubPublish(review) {
    try {
      const cfgRaw = localStorage.getItem('dripp_github_config');
      if (!cfgRaw) return;
      const cfg = JSON.parse(cfgRaw);
      if (!cfg.token || !cfg.owner || !cfg.repo) return;
      const apiBase = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + (cfg.path || 'data.json');
      const headers = {
        'Authorization': 'Bearer ' + cfg.token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      };
      const getRes = await fetch(apiBase + '?ref=' + encodeURIComponent(cfg.branch || 'main'), { headers });
      if (!getRes.ok) return;
      const file = await getRes.json();
      let data = {};
      try { data = JSON.parse(decodeURIComponent(escape(atob(file.content)))); } catch (e) { return; }
      data.pending_reviews = Array.isArray(data.pending_reviews) ? data.pending_reviews : [];
      data.pending_reviews.unshift(review);
      const putBody = {
        message: 'chore(reviews): queue public review from ' + review.name,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
        branch: cfg.branch || 'main',
        sha: file.sha
      };
      await fetch(apiBase, { method: 'PUT', headers, body: JSON.stringify(putBody) });
    } catch (e) { /* silent */ }
  }

  function setupReviewForm(formId, statusId, divisionKey) {
    const form = document.getElementById(formId);
    const status = document.getElementById(statusId);
    if (!form) return;
    const stars = form.querySelectorAll('.star-btn');
    const ratingInput = { value: 0 };

    stars.forEach(btn => {
      const setVisual = (val, hover) => {
        stars.forEach(s => {
          const v = parseInt(s.getAttribute('data-value'), 10);
          const icon = s.querySelector('i');
          if (v <= val) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            s.classList.add(hover ? 'hovered' : 'active');
          } else {
            icon.classList.add('far');
            icon.classList.remove('fas');
            s.classList.remove('active', 'hovered');
          }
        });
      };
      btn.addEventListener('mouseenter', () => setVisual(parseInt(btn.getAttribute('data-value'), 10), true));
      btn.addEventListener('mouseleave', () => setVisual(ratingInput.value, false));
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        ratingInput.value = parseInt(btn.getAttribute('data-value'), 10);
        setVisual(ratingInput.value, false);
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const comment = String(data.get('comment') || '').trim();
      if (!name || !comment || !ratingInput.value) {
        status.textContent = t('formStatusError');
        status.className = 'form-status error';
        return;
      }
      const review = {
        id: 'user_' + Date.now(),
        name,
        comment,
        commentUr: comment,
        rating: ratingInput.value,
        date: new Date().toISOString().slice(0, 10),
        division: divisionKey,
        verified: false
      };
      // Always store locally for instant UX
      saveUserReview(divisionKey, review);
      // Also queue to the admin's pending-reviews list so the Dripp admin can approve + push to GitHub
      queuePendingReview({ ...review, division: divisionKey });
      // Best-effort direct GitHub push if a token is already configured in this browser
      tryDirectGitHubPublish({ ...review, division: divisionKey, status: 'pending' });
      form.reset();
      ratingInput.value = 0;
      stars.forEach(s => { s.classList.remove('active', 'hovered'); s.querySelector('i').classList.add('far'); s.querySelector('i').classList.remove('fas'); });
      status.textContent = '✓ Review submitted! It will appear once approved by the admin.';
      status.className = 'form-status success';
      renderAllReviews();
    });
  }

  function setupReviewTabs() {
    const tabs = document.querySelectorAll('.review-tab');
    const panels = document.querySelectorAll('.reviews-panel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        panels.forEach(p => {
          const isMatch = p.getAttribute('data-panel') === target;
          p.classList.toggle('hidden', !isMatch);
          if (p.hasAttribute('hidden')) p.removeAttribute('hidden');
          if (!isMatch) p.setAttribute('hidden', '');
        });
      });
    });
  }

  function getDivisionWhatsApp(divisionKey) {
    if (!state.data || !state.data.divisions) return WHATSAPP_NUMBER;
    const div = state.data.divisions['division_' + (divisionKey === 'ali_hamza' ? 'b' : 'a')];
    return (div && div.whatsappNumber) ? div.whatsappNumber : WHATSAPP_NUMBER;
  }

  function openWhatsApp(number, message) {
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = url;
    } catch (e) {
      window.location.href = url;
    }
  }

  function handleInquiry(item, divisionKey) {
    const labelName = item.name || (item.title ? item.title : 'Talent');
    openBookingModal({ kind: 'talent', name: labelName, divisionKey: divisionKey || 'moon' });
  }

  function handlePackageInquiry(deal) {
    const title = state.lang === 'ur' && deal.titleUr ? deal.titleUr : deal.title;
    openBookingModal({ kind: 'package', name: 'Package: ' + title, divisionKey: deal.targetManager || 'moon' });
  }

  const BOOKING_KEY = 'moon_bookings';

  function getBookings() {
    try {
      const raw = localStorage.getItem(BOOKING_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveBooking(booking) {
    try {
      const list = getBookings();
      list.unshift(booking);
      localStorage.setItem(BOOKING_KEY, JSON.stringify(list));
    } catch (e) { console.warn('Could not save booking:', e); }
  }

  // Auto-record a talent view in the admin's bookings log.
  // Triggered when a visitor clicks on a model card.
  function recordTalentView(model, divisionKey) {
    try {
      const list = getBookings();
      const view = {
        id: 'view_' + Date.now(),
        type: 'talent-view',
        clientName: '(visitor view)',
        clientPhone: '',
        modelName: model.name,
        modelId: model.id,
        division: divisionKey,
        eventDate: '',
        eventTime: '',
        notes: 'Auto-logged on card click',
        status: 'Viewed',
        createdAt: new Date().toISOString()
      };
      list.unshift(view);
      // cap at 200 entries
      if (list.length > 200) list.length = 200;
      localStorage.setItem(BOOKING_KEY, JSON.stringify(list));
    } catch (e) { /* silent */ }
  }

  // Auto-create a sale record in the admin's POS terminal when a booking is confirmed.
  // Triggered by the booking form submission (i.e. when the user clicks "Confirm & Open WhatsApp").
  function recordSaleFromBooking(booking) {
    try {
      const SALES_KEY = 'dripp_cms_sales';
      const raw = localStorage.getItem(SALES_KEY);
      const list = raw ? JSON.parse(raw) : [];
      // Avoid double-recording same booking (by booking id)
      if (list.find(s => s.bookingId === booking.id)) return;
      // Try to derive a default price from the model pricing
      const allModels = (state.data && state.data.models) || [];
      const allTalentB = (state.data && state.data.division_b_talent) || [];
      const match = [...allModels, ...allTalentB].find(m => m.name === booking.modelName);
      let amount = 0;
      let currency = 'PKR';
      if (match && match.pricing) {
        const m = String(match.pricing).replace(/[^\d.]/g, '');
        amount = parseFloat(m) || 0;
      }
      const sale = {
        id: 'INV-' + String(list.length + 1).padStart(4, '0') + '-' + Date.now().toString().slice(-4),
        bookingId: booking.id,
        clientName: booking.clientName,
        clientPhone: booking.clientPhone,
        talentName: booking.modelName,
        amount: amount,
        currency: currency,
        paymentMethod: 'Pending (WhatsApp)',
        date: (booking.eventDate || new Date().toISOString().slice(0, 10)),
        dateTime: (booking.eventDate && booking.eventTime) ? (booking.eventDate + 'T' + booking.eventTime) : new Date().toISOString().slice(0, 16),
        division: booking.division,
        status: 'Awaiting confirmation',
        notes: booking.notes || 'Auto-created from WhatsApp booking flow',
        createdAt: new Date().toISOString()
      };
      list.unshift(sale);
      localStorage.setItem(SALES_KEY, JSON.stringify(list));
      return sale;
    } catch (e) { console.warn('Could not record sale:', e); return null; }
  }

  let bookingCtx = null;

  function openBookingModal(ctx) {
    const modal = document.getElementById('bookingModal');
    if (!modal) return;
    bookingCtx = ctx;
    const form = document.getElementById('bookingForm');
    if (form) form.reset();
    const modelField = document.getElementById('bookingModelName');
    if (modelField) modelField.value = ctx.name || '';
    const badge = document.getElementById('bookingBadge');
    if (badge) {
      const div = ctx.divisionKey === 'ali_hamza' ? 'Ali Hamza Division' : 'Moon Division';
      badge.innerHTML = '<i class="fab fa-whatsapp"></i> Routed to ' + div;
    }
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const firstInput = form && form.querySelector('input');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }

  function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (!modal) return;
    modal.setAttribute('hidden', '');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function setupBookingModal() {
    const modal = document.getElementById('bookingModal');
    const form = document.getElementById('bookingForm');
    if (!modal || !form) return;
    modal.querySelectorAll('[data-booking-close]').forEach(el => {
      el.addEventListener('click', closeBookingModal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hasAttribute('hidden')) {
        closeBookingModal();
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!bookingCtx) return;
      const fd = new FormData(form);
      const clientName = String(fd.get('clientName') || '').trim();
      const clientPhone = String(fd.get('clientPhone') || '').trim();
      const eventDate = String(fd.get('eventDate') || '').trim();
      const eventTime = String(fd.get('eventTime') || '').trim();
      const modelName = String(fd.get('modelName') || '').trim();
      const notes = String(fd.get('notes') || '').trim();

      if (!clientName || !clientPhone || !eventDate || !eventTime) {
        alert('Please fill in all required fields (Name, Phone, Date, Time).');
        return;
      }

      const divisionKey = bookingCtx.divisionKey || 'moon';
      const number = getDivisionWhatsApp(divisionKey);
      const itemName = bookingCtx.name || modelName;
      const greeting = divisionKey === 'ali_hamza' ? 'Hello Ali Hamza,' : 'Hello Manager,';
      let message = `${greeting} I want to book ${itemName}.\n` +
                    `Client: ${clientName}\n` +
                    `Phone: ${clientPhone}\n` +
                    `Event Date: ${eventDate}\n` +
                    `Event Time: ${eventTime}`;
      if (notes) message += `\nNotes: ${notes}`;

      const booking = {
        id: 'bk_' + Date.now(),
        clientName,
        clientPhone,
        modelName: itemName,
        division: divisionKey,
        eventDate,
        eventTime,
        notes,
        whatsappNumber: number,
        status: 'Pending',
        createdAt: new Date().toISOString()
      };
      saveBooking(booking);
      const sale = recordSaleFromBooking(booking);
      closeBookingModal();
      openWhatsApp(number, message);
      // Surface a small confirmation that a sale record was queued for the POS terminal
      if (sale) {
        try {
          showToast('Booking recorded. POS sale draft created: ' + sale.id, 'success');
        } catch (e) { /* noop */ }
      }
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function applyLanguage() {
    const html = document.documentElement;
    const strings = I18N_STRINGS[state.lang];
    html.setAttribute('lang', state.lang);
    html.setAttribute('dir', strings.rtl ? 'rtl' : 'ltr');
    document.body.style.fontFamily = strings.rtl ? "'Noto Nastaliq Urdu', 'Noto Sans Arabic', system-ui, sans-serif" : '';

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (strings[key]) el.textContent = strings[key];
    });

    const langCurrent = document.getElementById('langCurrent');
    if (langCurrent) langCurrent.textContent = strings.langButton;

    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
      langToggle.setAttribute('aria-label', state.lang === 'en' ? 'Switch to Urdu' : 'Switch to English');
    }

    if (state.data) {
      renderLeadership();
      renderModels();
      renderDivisionB();
      renderPackages();
      renderAllReviews();
      applyHeroOverride();
    }
  }

  function toggleLanguage() {
    state.lang = state.lang === 'en' ? 'ur' : 'en';
    setStoredLang(state.lang);
    applyLanguage();
  }

  function setupHeader() {
    const header = document.getElementById('header');
    let lastScroll = 0;
    const handleScroll = () => {
      const current = window.pageYOffset;
      if (current > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      lastScroll = current;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  function setupMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const nav = document.getElementById('nav');
    if (!btn || !nav) return;

    const closeMenu = () => {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
    });

    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !btn.contains(e.target)) closeMenu();
    });
  }

  function setupLanguageToggle() {
    const btn = document.getElementById('langToggle');
    if (!btn) return;
    btn.addEventListener('click', toggleLanguage);
  }

  function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#' || href.length < 2) return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        const headerHeight = document.getElementById('header').offsetHeight;
        const top = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }

  function setupActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    if (sections.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + entry.target.id) {
              link.classList.add('active');
            }
          });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    sections.forEach(section => observer.observe(section));
  }

  function getModelUserReviews(modelId) {
    try {
      const raw = localStorage.getItem('moon_model_reviews_' + modelId);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveModelUserReview(modelId, review) {
    try {
      const list = getModelUserReviews(modelId);
      list.unshift(review);
      localStorage.setItem('moon_model_reviews_' + modelId, JSON.stringify(list));
    } catch (e) { console.warn('Could not save model review:', e); }
  }

  function getAllModelReviews(modelId) {
    if (!state.data || !state.data.model_reviews) return [];
    const seeded = state.data.model_reviews[String(modelId)] || [];
    const user = getModelUserReviews(modelId);
    return user.concat(seeded);
  }

  function createMetricCard(icon, label, value) {
    if (!value) return null;
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `<div class="metric-icon"><i class="${icon}"></i></div><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${escapeHtml(String(value))}</div>`;
    return card;
  }

  function createModalReview(review) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-review';

    const photoSrc = review.image || getImageFallback(review.name);
    const photo = document.createElement('img');
    photo.className = 'modal-review-photo';
    photo.src = photoSrc;
    photo.alt = review.name;
    photo.onerror = () => { photo.onerror = null; photo.src = getImageFallback(review.name); };
    wrap.appendChild(photo);

    const body = document.createElement('div');
    body.className = 'modal-review-body';

    const header = document.createElement('div');
    header.className = 'modal-review-header';
    const name = document.createElement('span');
    name.className = 'modal-review-name';
    name.textContent = review.name;
    header.appendChild(name);
    const stars = document.createElement('div');
    stars.className = 'modal-review-stars';
    stars.innerHTML = createStarIcons(review.rating || 0);
    header.appendChild(stars);
    body.appendChild(header);

    const comment = document.createElement('div');
    comment.className = 'modal-review-comment';
    comment.textContent = review.comment;
    body.appendChild(comment);

    if (review.date) {
      const date = document.createElement('div');
      date.className = 'modal-review-date';
      try {
        const d = new Date(review.date);
        date.textContent = isNaN(d.getTime()) ? review.date : d.toLocaleDateString(state.lang === 'ur' ? 'ur-PK' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      } catch (e) { date.textContent = review.date; }
      body.appendChild(date);
    }

    wrap.appendChild(body);
    return wrap;
  }

  function buildModalContent(model, divisionKey) {
    const root = document.createElement('div');

    const hero = document.createElement('div');
    hero.className = 'modal-hero';
    const heroImg = document.createElement('img');
    heroImg.className = 'modal-hero-image';
    heroImg.src = model.image;
    heroImg.alt = model.name;
    heroImg.onerror = () => handleImageError(heroImg);
    hero.appendChild(heroImg);
    const heroOverlay = document.createElement('div');
    heroOverlay.className = 'modal-hero-overlay';
    const heroContent = document.createElement('div');
    heroContent.className = 'modal-hero-content';
    const nameEl = document.createElement('h2');
    nameEl.className = 'modal-name';
    nameEl.id = 'modalTitle';
    nameEl.textContent = model.name;
    heroContent.appendChild(nameEl);
    if (model.specialty) {
      const spec = document.createElement('p');
      spec.className = 'modal-specialty';
      spec.textContent = getLocalizedBilingual(model.specialty);
      heroContent.appendChild(spec);
    }
    if (model.category) {
      const cat = document.createElement('span');
      cat.className = 'modal-category-badge';
      cat.innerHTML = `<i class="fas fa-tag"></i> ${escapeHtml(model.category)}`;
      heroContent.appendChild(cat);
    }
    if (model.pricing) {
      const price = document.createElement('span');
      price.className = 'modal-pricing-tag';
      price.textContent = model.pricing;
      heroContent.appendChild(price);
    }
    heroOverlay.appendChild(heroContent);
    hero.appendChild(heroOverlay);
    root.appendChild(hero);

    const content = document.createElement('div');
    content.className = 'modal-content';

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const inquireBtn = document.createElement('button');
    inquireBtn.className = 'btn btn-whatsapp';
    inquireBtn.type = 'button';
    inquireBtn.innerHTML = `<i class="fab fa-whatsapp"></i><span>${t('modalInquiry')}</span>`;
    inquireBtn.addEventListener('click', () => handleInquiry(model, divisionKey));
    actions.appendChild(inquireBtn);
    content.appendChild(actions);

    const metricsSection = document.createElement('div');
    metricsSection.className = 'modal-section';
    const metricsTitle = document.createElement('h3');
    metricsTitle.className = 'modal-section-title';
    metricsTitle.innerHTML = `<i class="fas fa-id-card"></i> ${escapeHtml(t('modalMetrics'))}`;
    metricsSection.appendChild(metricsTitle);
    const grid = document.createElement('div');
    grid.className = 'modal-metrics';
    const metrics = [
      ['fas fa-ruler-vertical', t('metricHeight'), model.height],
      ['fas fa-weight', t('metricWeight'), model.weight],
      ['fas fa-arrows-alt-h', t('metricWaist'), model.waist],
      ['fas fa-birthday-cake', t('metricAge'), model.age],
      ['fas fa-briefcase', t('metricOccupation'), model.occupation],
      ['fas fa-map-marker-alt', t('metricLocation'), model.location],
      ['fas fa-tag', t('metricCategory'), model.category]
    ];
    metrics.forEach(([icon, label, value]) => {
      const card = createMetricCard(icon, label, value);
      if (card) grid.appendChild(card);
    });
    metricsSection.appendChild(grid);
    content.appendChild(metricsSection);

    if (model.bio) {
      const bioSection = document.createElement('div');
      bioSection.className = 'modal-section';
      const bioTitle = document.createElement('h3');
      bioTitle.className = 'modal-section-title';
      bioTitle.innerHTML = `<i class="fas fa-user"></i> ${escapeHtml(t('modalBio'))}`;
      bioSection.appendChild(bioTitle);
      const bio = document.createElement('p');
      bio.className = 'modal-bio';
      bio.textContent = getLocalizedBilingual(model.bio);
      bioSection.appendChild(bio);
      content.appendChild(bioSection);
    }

    const reviewsSection = document.createElement('div');
    reviewsSection.className = 'modal-section';
    const reviewsTitle = document.createElement('h3');
    reviewsTitle.className = 'modal-section-title';
    reviewsTitle.innerHTML = `<i class="fas fa-star"></i> ${escapeHtml(t('modalReviews'))}`;
    reviewsSection.appendChild(reviewsTitle);

    const reviews = getAllModelReviews(model.id);
    if (reviews.length > 0) {
      const list = document.createElement('div');
      list.className = 'modal-reviews-list';
      reviews.forEach(r => list.appendChild(createModalReview(r)));
      reviewsSection.appendChild(list);
    } else {
      const empty = document.createElement('div');
      empty.className = 'modal-no-reviews';
      empty.innerHTML = `<i class="far fa-comment-dots"></i> ${escapeHtml(t('modalNoReviews'))}`;
      reviewsSection.appendChild(empty);
    }

    const formWrap = document.createElement('div');
    formWrap.className = 'modal-review-form';
    const formTitle = document.createElement('h4');
    formTitle.className = 'modal-review-form-title';
    formTitle.innerHTML = `<i class="fas fa-pen"></i> ${escapeHtml(t('modalWriteReview'))}`;
    formWrap.appendChild(formTitle);

    const warning = document.createElement('div');
    warning.className = 'form-warning';
    warning.id = 'modalReviewWarning_' + model.id;
    warning.setAttribute('role', 'alert');
    warning.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>${escapeHtml(t('modalImageRequired'))}</span>`;
    formWrap.appendChild(warning);

    const form = document.createElement('form');
    form.className = 'modal-review-form-inner';
    form.noValidate = true;

    const row = document.createElement('div');
    row.className = 'form-row';

    const nameField = document.createElement('label');
    nameField.className = 'form-field';
    nameField.innerHTML = `<span>${escapeHtml(t('modalReviewerName'))}</span><input type="text" name="name" required maxlength="60" autocomplete="name">`;
    row.appendChild(nameField);

    const ratingField = document.createElement('div');
    ratingField.className = 'form-field';
    ratingField.innerHTML = `<span>${escapeHtml(t('modalReviewerRating'))}</span>`;
    const starInput = document.createElement('div');
    starInput.className = 'star-input';
    starInput.setAttribute('role', 'radiogroup');
    starInput.setAttribute('aria-label', t('modalReviewerRating'));
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('button');
      star.type = 'button';
      star.className = 'star-btn';
      star.setAttribute('data-value', String(i));
      star.setAttribute('aria-label', i + ' star' + (i > 1 ? 's' : ''));
      star.innerHTML = '<i class="far fa-star"></i>';
      starInput.appendChild(star);
    }
    ratingField.appendChild(starInput);
    row.appendChild(ratingField);
    form.appendChild(row);

    const commentField = document.createElement('label');
    commentField.className = 'form-field';
    commentField.innerHTML = `<span>${escapeHtml(t('modalReviewerComment'))}</span><textarea name="comment" required maxlength="500" rows="3"></textarea>`;
    form.appendChild(commentField);

    const fileField = document.createElement('div');
    fileField.className = 'form-field';
    const fileLabel = document.createElement('span');
    fileLabel.textContent = t('modalUploadImage');
    fileField.appendChild(fileLabel);

    const fileWrap = document.createElement('div');
    fileWrap.className = 'file-input-wrapper';
    const fileInputLabel = document.createElement('label');
    fileInputLabel.className = 'file-input-label';
    fileInputLabel.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> <span class="file-label-text">Choose image…</span>';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'file-input';
    fileInput.required = true;
    fileInput.setAttribute('aria-required', 'true');
    fileInputLabel.appendChild(fileInput);
    fileWrap.appendChild(fileInputLabel);

    const preview = document.createElement('div');
    preview.className = 'file-preview';
    const previewImg = document.createElement('img');
    previewImg.alt = 'Preview';
    preview.appendChild(previewImg);
    fileWrap.appendChild(preview);

    fileField.appendChild(fileWrap);
    form.appendChild(fileField);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn-primary';
    submit.style.marginTop = '1rem';
    submit.style.width = '100%';
    submit.innerHTML = `<i class="fas fa-paper-plane"></i><span>${escapeHtml(t('modalSubmitReview'))}</span>`;
    form.appendChild(submit);

    const status = document.createElement('p');
    status.className = 'form-status';
    status.setAttribute('role', 'status');
    form.appendChild(status);

    formWrap.appendChild(form);
    reviewsSection.appendChild(formWrap);
    content.appendChild(reviewsSection);

    root.appendChild(content);

    const ratingRef = { value: 0 };
    const stars = starInput.querySelectorAll('.star-btn');
    const setStarVisual = (val) => {
      stars.forEach(s => {
        const v = parseInt(s.getAttribute('data-value'), 10);
        const icon = s.querySelector('i');
        if (v <= val) { icon.classList.remove('far'); icon.classList.add('fas'); }
        else { icon.classList.add('far'); icon.classList.remove('fas'); }
      });
    };
    stars.forEach(btn => {
      btn.addEventListener('mouseenter', () => setStarVisual(parseInt(btn.getAttribute('data-value'), 10)));
      btn.addEventListener('mouseleave', () => setStarVisual(ratingRef.value));
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        ratingRef.value = parseInt(btn.getAttribute('data-value'), 10);
        setStarVisual(ratingRef.value);
      });
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) {
        fileInputLabel.classList.add('has-file');
        fileInputLabel.querySelector('.file-label-text').textContent = file.name;
        const reader = new FileReader();
        reader.onload = (ev) => {
          previewImg.src = ev.target.result;
          preview.classList.add('visible');
        };
        reader.readAsDataURL(file);
      } else {
        fileInputLabel.classList.remove('has-file');
        fileInputLabel.querySelector('.file-label-text').textContent = 'Choose image…';
        preview.classList.remove('visible');
        previewImg.removeAttribute('src');
      }
      warning.classList.remove('visible');
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const reviewerName = String(data.get('name') || '').trim();
      const commentText = String(data.get('comment') || '').trim();
      const file = fileInput.files && fileInput.files[0];

      if (!file) {
        warning.classList.add('visible');
        status.textContent = '';
        status.className = 'form-status error';
        fileInputLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (!reviewerName || !commentText || !ratingRef.value) {
        status.textContent = t('formStatusError');
        status.className = 'form-status error';
        return;
      }

      warning.classList.remove('visible');
      const reader = new FileReader();
      reader.onload = (ev) => {
        const review = {
          id: 'user_modal_' + Date.now(),
          name: reviewerName,
          comment: commentText,
          rating: ratingRef.value,
          date: new Date().toISOString().slice(0, 10),
          verified: false,
          image: ev.target.result
        };
        saveModelUserReview(model.id, review);
        form.reset();
        ratingRef.value = 0;
        setStarVisual(0);
        fileInputLabel.classList.remove('has-file');
        fileInputLabel.querySelector('.file-label-text').textContent = 'Choose image…';
        preview.classList.remove('visible');
        previewImg.removeAttribute('src');
        status.textContent = t('formStatusReview');
        status.className = 'form-status success';

        reviewsSection.querySelectorAll('.modal-reviews-list, .modal-no-reviews').forEach(el => el.remove());
        const newReviews = getAllModelReviews(model.id);
        const list = document.createElement('div');
        list.className = 'modal-reviews-list';
        newReviews.forEach(r => list.appendChild(createModalReview(r)));
        reviewsSection.insertBefore(list, formWrap);
      };
      reader.readAsDataURL(file);
    });

    return root;
  }

  let modalLastFocus = null;

  function openModelModal(model, divisionKey) {
    const modal = document.getElementById('modelModal');
    const body = document.getElementById('modalBody');
    if (!modal || !body) return;
    modalLastFocus = document.activeElement;
    body.innerHTML = '';
    body.appendChild(buildModalContent(model, divisionKey));
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeModelModal() {
    const modal = document.getElementById('modelModal');
    if (!modal) return;
    modal.setAttribute('hidden', '');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    const body = document.getElementById('modalBody');
    if (body) body.innerHTML = '';
    if (modalLastFocus && typeof modalLastFocus.focus === 'function') {
      modalLastFocus.focus();
    }
  }

  function setupModal() {
    const modal = document.getElementById('modelModal');
    if (!modal) return;
    modal.querySelectorAll('[data-modal-close]').forEach(el => {
      el.addEventListener('click', closeModelModal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hasAttribute('hidden')) {
        closeModelModal();
      }
    });
  }

  function init() {
    state.lang = getStoredLang();

    setupLanguageToggle();
    setupHeader();
    setupMobileMenu();
    setupSmoothScroll();
    setupModal();
    setupBookingModal();
    setupReviewTabs();
    setupReviewForm('reviewFormA', 'reviewFormAStatus', 'division_a');
    setupReviewForm('reviewFormB', 'reviewFormBStatus', 'division_b');
    setupCmsSync();
    applyLanguage();
    trackEvent('pageview', location.pathname, document.title);

    fetchData()
      .then(() => {
        renderLeadership();
        renderModels();
        renderDivisionB();
        renderPackages();
        renderAllReviews();
        applyHeroOverride();
        setupActiveNav();
      })
      .catch(err => {
        console.error('Initialization error:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();