const NotificationsPage = (() => {

  function notifIcon(type) {
    if (type === 'like') return `<svg width="14" height="14" viewBox="0 0 24 24" fill="#f04747" stroke="#f04747" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    if (type === 'comment') return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    if (type === 'follow') return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`;
    return '';
  }

  function notifText(n) {
    const name = `<strong>${escapeHTML(n.actor_display_name || n.actor_username)}</strong>`;
    if (n.type === 'like') return `${name} лайкнул ваш пост`;
    if (n.type === 'comment') return `${name} прокомментировал ваш пост`;
    if (n.type === 'follow') return `${name} подписался на вас`;
    return '';
  }

  function renderNotif(n) {
    return `
      <div class="notif-item ${n.read ? '' : 'notif-unread'} fade-in" data-notif-actor="${n.actor_username}" ${n.post_id ? `data-notif-post="${n.post_id}"` : ''}>
        <div class="notif-avatar-wrap">
          ${avatarHTML({ username: n.actor_username, display_name: n.actor_display_name, avatar_url: n.actor_avatar }, 'avatar-sm')}
          <span class="notif-type-icon">${notifIcon(n.type)}</span>
        </div>
        <div class="notif-body">
          <div class="notif-text">${notifText(n)}</div>
          ${n.post_text ? `<div class="notif-post-preview">${escapeHTML(n.post_text.slice(0, 80))}${n.post_text.length > 80 ? '…' : ''}</div>` : ''}
          <div class="notif-time">${formatDate(n.created_at)}</div>
        </div>
      </div>
    `;
  }

  async function render(user) {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page-inner">
        <div class="section-header">
          <h2 class="page-title">Уведомления</h2>
          <button class="btn btn-ghost btn-sm" id="btn-read-all">Прочитать все</button>
        </div>
        <div id="notif-list">${renderSkeletons(3)}</div>
      </div>
    `;

    const list = document.getElementById('notif-list');

    // mark all read
    document.getElementById('btn-read-all').addEventListener('click', async () => {
      await API.post('/notifications/read-all');
      App.updateNotifBadge(0);
      list.querySelectorAll('.notif-unread').forEach(el => el.classList.remove('notif-unread'));
    });

    // bind clicks
    list.addEventListener('click', e => {
      const item = e.target.closest('[data-notif-actor]');
      if (!item) return;
      if (item.dataset.notifPost) {
        // go to feed — ideally open post, for now just navigate
        App.navigateTo('feed');
      } else {
        App.navigateTo('profile', { username: item.dataset.notifActor });
      }
    });

    try {
      const notifs = await API.get('/notifications');
      // mark as read
      await API.post('/notifications/read-all');
      App.updateNotifBadge(0);

      if (!notifs.length) {
        list.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><p>Уведомлений пока нет</p></div>`;
        return;
      }
      list.innerHTML = notifs.map(renderNotif).join('');
    } catch(e) {
      list.innerHTML = `<div class="empty-state"><p>Ошибка загрузки</p></div>`;
    }
  }

  return { render };
})();
