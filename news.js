(function () {
  'use strict';

  function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function imageFallback(name) {
    const initials = String(name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1a1a2e"/><stop offset="100%" stop-color="#e94560"/>
      </linearGradient></defs>
      <rect width="400" height="250" fill="url(#g)"/>
      <text x="50%" y="50%" font-family="Segoe UI, sans-serif" font-size="80" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${initials}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function loadNews() {
    const grid = document.getElementById('newsGrid');
    const empty = document.getElementById('newsEmpty');
    if (!grid) return;

    const cmsNewsRaw = (() => {
      try {
        const raw = localStorage.getItem('dripp_cms_news');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      try {
        const raw = localStorage.getItem('dripp_data');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.payload) return parsed.payload.news || [];
        }
      } catch (e) {}
      return null;
    })();

    if (cmsNewsRaw && Array.isArray(cmsNewsRaw)) {
      renderNews(grid, empty, cmsNewsRaw);
      return;
    }

    fetch('data.json?_=' + Date.now(), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const news = (data && data.news) || [];
        renderNews(grid, empty, news);
      })
      .catch(() => {
        renderNews(grid, empty, []);
      });
  }

  function renderNews(grid, empty, news) {
    grid.innerHTML = '';
    if (!news.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    news.forEach(n => {
      const card = document.createElement('article');
      card.className = 'news-card';

      if (n.image) {
        const img = document.createElement('img');
        img.className = 'news-card-image';
        img.src = n.image;
        img.alt = n.title || 'News';
        img.onerror = () => { img.onerror = null; img.src = imageFallback(n.title); };
        card.appendChild(img);
      }

      const body = document.createElement('div');
      body.className = 'news-card-body';

      const mode = document.createElement('span');
      mode.className = 'news-card-mode';
      mode.textContent = (n.mode || 'text').replace('+', ' + ');
      body.appendChild(mode);

      if (n.title) {
        const t = document.createElement('h3');
        t.className = 'news-card-title';
        t.textContent = n.title;
        body.appendChild(t);
      }

      if (n.content && n.mode !== 'image') {
        const c = document.createElement('p');
        c.className = 'news-card-content';
        c.textContent = n.content;
        body.appendChild(c);
      }

      if (n.date) {
        const d = document.createElement('div');
        d.className = 'news-card-date';
        d.innerHTML = `<i class="far fa-calendar"></i> ${escapeHtml(n.date)}`;
        body.appendChild(d);
      }

      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadNews();
      window.addEventListener('storage', (e) => {
        if (!e.key) return;
        if (e.key === 'dripp_cms_news' || e.key === 'dripp_cms_data' || e.key === 'dripp_data') {
          loadNews();
        }
      });
    });
  } else {
    loadNews();
    window.addEventListener('storage', (e) => {
      if (!e.key) return;
      if (e.key === 'dripp_cms_news' || e.key === 'dripp_cms_data' || e.key === 'dripp_data') {
        loadNews();
      }
    });
  }
})();