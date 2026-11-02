const SearchPage = (() => {
  let _user = null;
  let _debounce = null;

  async function render(user, opts = {}) {
    _user = user;
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page-inner">
        <h2 class="page-title">Поиск</h2>
        <div class="search-bar-wrap">
          <div class="search-input-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="search-input" class="search-input" type="text" placeholder="Поиск по постам и людям..." autocomplete="off" value="${escapeHTML(opts.q || '')}" />
          </div>
          <div class="search-tabs">
            <button class="search-tab active" data-tab="all">Всё</button>
            <button class="search-tab" data-tab="posts">Посты</button>
            <button class="search-tab" data-tab="users">Люди</button>
          </div>
        </div>
        <div id="search-results"></div>
      </div>
    `;

    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    let activeTab = 'all';

    document.querySelectorAll('.search-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        doSearch(input.value.trim(), activeTab);
      });
    });

    input.addEventListener('input', () => {
      clearTimeout(_debounce);
      _debounce = setTimeout(() => doSearch(input.value.trim(), activeTab), 350);
    });

    if (opts.q) doSearch(opts.q, activeTab);
    else results.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>Введите запрос для поиска</p></div>`;

    bindPostActions(results, user);
    input.focus();
  }

  async function doSearch(q, type) {
    const results = document.getElementById('search-results');
    if (!q || q.length < 2) {
      results.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>Введите минимум 2 символа</p></div>`;
      return;
    }
    results.innerHTML = renderSkeletons(3);
    try {
      const data = await API.get(`/search?q=${encodeURIComponent(q)}&type=${type}`);
      let html = '';

      if ((type === 'all' || type === 'users') && data.users && data.users.length) {
        html += `<div class="search-section-title">Люди</div><div class="users-list">`;
        html += data.users.map(u => `
          <div class="user-row fade-in">
            <a href="#" data-nav-profile="${u.username}" style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
              ${avatarHTML(u, 'avatar-sm')}
              <div style="min-width:0">
                <div style="font-weight:600;font-size:14px;display:flex;align-items:center;gap:5px">
                  ${escapeHTML(u.display_name || u.username)}
                  ${u.verified ? verifiedBadge() : ''}
                </div>
                <div style="font-size:13px;color:var(--text3)">@${u.username} · ${u.follower_count} подписчиков</div>
              </div>
            </a>
            ${u.id !== _user.id ? `
            <button class="btn btn-sm ${u.is_following ? 'btn-ghost' : 'btn-primary'}" data-follow-user="${u.username}">
              ${u.is_following ? 'Отписаться' : 'Подписаться'}
            </button>` : ''}
          </div>
        `).join('');
        html += `</div>`;
      }

      if ((type === 'all' || type === 'posts') && data.posts && data.posts.length) {
        html += `<div class="search-section-title">Посты</div>`;
        html += data.posts.map(p => renderPost(p, _user)).join('');
      }

      if (!html) {
        html = `<div class="empty-state"><p>Ничего не найдено по запросу «${escapeHTML(q)}»</p></div>`;
      }

      results.innerHTML = html;

      // bind follow buttons
      results.querySelectorAll('[data-follow-user]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const username = btn.dataset.followUser;
          try {
            const res = await API.post(`/users/${username}/follow`);
            btn.textContent = res.following ? 'Отписаться' : 'Подписаться';
            btn.className = `btn btn-sm ${res.following ? 'btn-ghost' : 'btn-primary'}`;
          } catch(e) { toast(e.message, 'error'); }
        });
      });

      // bind profile nav
      results.querySelectorAll('[data-nav-profile]').forEach(el => {
        el.addEventListener('click', e => {
          e.preventDefault();
          App.navigateTo('profile', { username: el.dataset.navProfile });
        });
      });

    } catch(e) {
      results.innerHTML = `<div class="empty-state"><p>Ошибка поиска</p></div>`;
    }
  }

  return { render };
})();
