// ИТСМИ — главный роутер приложения

const App = (() => {
  let currentUser = null;
  let currentPage = null;
  let currentOpts = {};

  async function init() {
    const theme = localStorage.getItem('itsmi_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const logoImg = document.getElementById('sidebar-logo-img');
    if (logoImg) logoImg.src = theme === 'light' ? '/assets/logo_light.png' : '/assets/logo.png';

    const { access } = API.getTokens();

    // No token — show login immediately, no fetch needed
    if (!access) {
      showAuth();
      return;
    }

    // Has token — try to verify, but show login on any failure
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + access },
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.banned) {
          showBanned();
          return;
        }
      }
      if (!res.ok) throw new Error('not ok');
      currentUser = await res.json();
      API.setUser(currentUser);
    } catch {
      API.clearTokens();
      showAuth();
      return;
    }

    if (currentUser && currentUser.banned) {
      showBanned();
      return;
    }

    showApp();
    setupNav();
    WS.connect();
    navigateTo('feed');
    loadNotifBadge();

    // Realtime уведомления
    WS.on('notification', (notif) => {
      const badge = document.getElementById('notif-badge');
      const current = badge && !badge.classList.contains('hidden') ? parseInt(badge.textContent) || 0 : 0;
      updateNotifBadge(current + 1);
      toast(
        notif.type === 'like' ? `${notif.actor_display_name} лайкнул ваш пост` :
        notif.type === 'comment' ? `${notif.actor_display_name} прокомментировал пост` :
        notif.type === 'mention' ? `${notif.actor_display_name} упомянул вас` :
        `${notif.actor_display_name} подписался на вас`,
        'success'
      );
    });
  }

  function showBanned() {
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:24px;z-index:9999">
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:40px 36px;max-width:460px;width:100%;text-align:center">
          <div style="margin-bottom:20px;display:flex;justify-content:center">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          </div>
          <div style="font-size:20px;font-weight:800;margin-bottom:20px;color:var(--danger)">Ваш аккаунт заблокирован</div>
          <div style="font-size:14px;color:var(--text2);line-height:1.8;text-align:left;display:flex;flex-direction:column;gap:12px">
            <p>Ваш аккаунт был заблокирован администрацией платформы ИТСМИ в связи с нарушением правил сообщества. Это решение было принято после тщательного рассмотрения вашей активности на платформе.</p>
            <p>Блокировка означает, что вы больше не можете публиковать сообщения, комментировать, ставить лайки и взаимодействовать с другими пользователями.</p>
            <p>Если вы считаете, что блокировка была применена ошибочно, вы можете обратиться к администратору платформы через доступные каналы связи. Администрация рассмотрит ваше обращение в течение нескольких рабочих дней.</p>
          </div>
          <button id="banned-logout-btn" style="margin-top:28px;padding:11px 28px;background:var(--danger);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;width:100%">Выйти</button>
        </div>
      </div>
    `;
    document.getElementById('banned-logout-btn').addEventListener('click', () => {
      localStorage.clear();
      sessionStorage.clear();
      location.reload();
    });
  }

  function showAuth() {
    const pageAuth = document.getElementById('page-auth');
    const pageApp = document.getElementById('page-app');
    if (!pageAuth || !pageApp) {
      document.body.style.background = '#0a0a0a';
      document.body.innerHTML = '<div style="color:#f44;padding:20px;font-family:monospace">ELEMENT NOT FOUND</div>';
      return;
    }
    pageAuth.classList.remove('hidden');
    pageApp.classList.add('hidden');
    try {
      AuthPage.renderLogin();
    } catch(e) {
      pageAuth.innerHTML = '<div style="color:#f44;padding:20px;font-family:monospace;font-size:12px;white-space:pre-wrap">renderLogin error:\n' + (e.stack || e) + '</div>';
    }
  }

  function showApp() {
    document.getElementById('page-auth').classList.add('hidden');
    document.getElementById('page-app').classList.remove('hidden');

    if (currentUser && currentUser.role === 'admin') {
      document.getElementById('nav-admin').classList.remove('hidden');
    }

    bindFooter();

    document.getElementById('sidebar-logo').addEventListener('click', () => {
      App.navigateTo('feed');
    });
  }

  function setupNav() {
    // Sidebar nav
    document.querySelectorAll('[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        navigateTo(page);
      });
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', async () => {
      const { refresh } = API.getTokens();
      try { await API.post('/auth/logout', { token: refresh }); } catch {}
      API.clearTokens();
      location.reload();
    });
  }

  function setActiveNav(page) {
    document.querySelectorAll('.nav-item, .mnav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  }

  async function navigateTo(page, opts = {}) {
    currentPage = page;
    currentOpts = opts;

    const main = document.getElementById('main-content');

    // Fade out
    main.classList.add('page-leaving');
    await new Promise(r => setTimeout(r, 160));
    main.classList.remove('page-leaving');

    const mainPages = ['feed', 'channels', 'profile', 'settings', 'admin', 'search', 'notifications'];
    if (mainPages.includes(page)) setActiveNav(page);

    switch (page) {
      case 'feed':
        await FeedPage.render(currentUser);
        break;
      case 'channels':
        await ChannelsPage.render(currentUser, opts);
        break;
      case 'channel':
        await ChannelsPage.render(currentUser, { channelId: opts.channelId });
        break;
      case 'profile':
        await ProfilePage.render(currentUser, opts);
        break;
      case 'settings':
        SettingsPage.render(currentUser);
        break;
      case 'admin':
        await AdminPage.render(currentUser);
        break;
      case 'search':
        await SearchPage.render(currentUser, opts);
        break;
      case 'notifications':
        await NotificationsPage.render(currentUser);
        break;
      default:
        await FeedPage.render(currentUser);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindFooter() {
    document.querySelectorAll('[data-legal-footer]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        SettingsPage.showLegal(link.dataset.legalFooter);
      });
    });


  }

  function updateNotifBadge(count) {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  async function loadNotifBadge() {
    try {
      const data = await API.get('/notifications/unread-count');
      updateNotifBadge(data.count);
    } catch {}
  }

  // Expose for pages
  return { init, navigateTo, getUser: () => currentUser, updateNotifBadge };
})();

// Swipe navigation on mobile
(function() {
  const pages = ['feed', 'channels', 'search', 'notifications', 'profile', 'settings'];
  let startX = 0, startY = 0;

  document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    // Только горизонтальный свайп (dx > 60, dy < 40)
    if (Math.abs(dx) < 60 || Math.abs(dy) > 40) return;

    const pageApp = document.getElementById('page-app');
    if (!pageApp || pageApp.classList.contains('hidden')) return;

    const currentPage = App.getUser ? (() => {
      const active = document.querySelector('.mnav-item.active');
      return active ? active.dataset.page : 'feed';
    })() : 'feed';

    const idx = pages.indexOf(currentPage);
    if (idx === -1) return;

    if (dx < 0 && idx < pages.length - 1) {
      App.navigateTo(pages[idx + 1]);
    } else if (dx > 0 && idx > 0) {
      App.navigateTo(pages[idx - 1]);
    }
  }, { passive: true });
})();

// Start
try {
  App.init().catch(function(e) {
    document.body.innerHTML = '<div style="position:fixed;inset:0;background:#0a0a0a;color:#f44;padding:20px;font-family:monospace;font-size:12px;white-space:pre-wrap;z-index:9999">ASYNC ERROR:\n' + (e.stack || e) + '</div>';
  });
} catch(e) {
  document.body.innerHTML = '<div style="position:fixed;inset:0;background:#0a0a0a;color:#f44;padding:20px;font-family:monospace;font-size:12px;white-space:pre-wrap;z-index:9999">SYNC ERROR:\n' + (e.stack || e) + '</div>';
}