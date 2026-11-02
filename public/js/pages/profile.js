const ProfilePage = (() => {
  async function render(currentUser, opts = {}) {
    const username = opts.username || currentUser.username;
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page-inner">
        <div class="skeleton-card" style="margin-bottom:16px">
          <div class="skeleton-row">
            <div class="skeleton-circle" style="width:76px;height:76px"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:10px">
              <div class="skeleton-line" style="width:40%"></div>
              <div class="skeleton-line" style="width:25%;height:11px"></div>
            </div>
          </div>
        </div>
        ${renderSkeletons(2)}
      </div>
    `;

    try {
      const user = await API.get(`/users/${username}`);
      const isOwn = currentUser && user.id === currentUser.id;
      const isAdmin = currentUser && currentUser.role === 'admin';

      const isOnline = user.isOnline;

      main.innerHTML = `
        <div class="page-inner">
        ${opts.username && opts.username !== currentUser.username ? `
          <a href="#" class="back-btn" id="back-btn">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            Назад
          </a>
        ` : ''}
        <div class="profile-header fade-in">
          <div class="profile-top">
            <div style="position:relative;display:inline-block">
              ${avatarHTML(user, 'lg')}
              <span style="position:absolute;bottom:2px;right:2px;width:14px;height:14px;border-radius:50%;background:${user.isOnline ? 'var(--success)' : 'var(--bg5)'};border:2px solid var(--bg2)"></span>
            </div>
            <div class="profile-info">
              <div class="profile-name">
                ${escapeHTML(user.display_name)}
                ${user.verified ? verifiedBadge() : ''}
              </div>
              <div class="profile-handle">@${user.username}</div>
              ${user.bio ? `<div class="profile-bio">${escapeHTML(user.bio)}</div>` : ''}
              <div class="profile-stats">
                <div class="profile-stat" style="cursor:pointer" id="show-followers">
                  <span>${user.followerCount}</span><small>подписчиков</small>
                </div>
                <div class="profile-stat" style="cursor:pointer" id="show-following">
                  <span>${user.followingCount}</span><small>подписок</small>
                </div>
              </div>
              <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
                ${!isOwn ? `
                  <button class="btn btn-primary btn-sm" id="follow-btn">
                    ${user.isFollowing ? 'Отписаться' : 'Подписаться'}
                  </button>
                ` : `
                  <button class="btn btn-ghost btn-sm" id="edit-profile-btn">Редактировать</button>
                  <button class="btn btn-ghost btn-sm" id="verify-apply-btn">Верификация</button>
                `}
                ${isAdmin && !isOwn ? `
                  <button class="btn btn-danger btn-sm" id="ban-user-btn" data-user-id="${user.id}">
                    ${user.banned ? 'Разбанить' : 'Забанить'}
                  </button>
                  <button class="btn btn-ghost btn-sm" id="verify-user-btn" data-user-id="${user.id}">
                    ${user.verified ? 'Снять галочку' : 'Верифицировать'}
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <div class="tabs" id="profile-tabs">
          <button class="tab-btn active" data-tab="posts">Посты</button>
          <button class="tab-btn" data-tab="liked">Лайки</button>
          <button class="tab-btn" data-tab="reposts">Репосты</button>
        </div>
        <div id="profile-posts"></div>
        </div>
      `;

      // Back button
      const backBtn = document.getElementById('back-btn');
      if (backBtn) backBtn.addEventListener('click', (e) => { e.preventDefault(); App.navigateTo('feed'); });

      // Follow
      if (!isOwn) {
        document.getElementById('follow-btn').addEventListener('click', async () => {
          try {
            const res = await API.post(`/users/${username}/follow`);
            document.getElementById('follow-btn').textContent = res.following ? 'Отписаться' : 'Подписаться';
            document.querySelector('#show-followers span').textContent = res.followerCount;
          } catch (e) { toast(e.message, 'error'); }
        });
      }

      // Edit profile
      if (isOwn) {
        document.getElementById('edit-profile-btn').addEventListener('click', () => showEditModal(user));
        document.getElementById('verify-apply-btn').addEventListener('click', () => showVerifyModal());

        const avatarUpload = document.getElementById('avatar-upload');
        avatarUpload && avatarUpload.addEventListener('change', async () => {
          const file = avatarUpload.files[0];
          if (!file) return;
          const fd = new FormData();
          fd.append('avatar', file);
          try {
            const updated = await API.patchUpload('/users/me', fd);
            API.setUser(updated);
            toast('Аватар обновлён', 'success');
            render(updated, opts);
          } catch (e) { toast(e.message, 'error'); }
        });
      }

      // Admin actions
      if (isAdmin && !isOwn) {
        document.getElementById('ban-user-btn').addEventListener('click', async () => {
          try {
            if (user.banned) {
              await API.post(`/admin/users/${user.id}/unban`);
              toast('Разбанен', 'success');
            } else {
              if (!confirm(`Забанить @${user.username}?`)) return;
              await API.post(`/admin/users/${user.id}/ban`);
              toast('Забанен', 'success');
            }
            render(currentUser, opts);
          } catch (e) { toast(e.message, 'error'); }
        });

        document.getElementById('verify-user-btn').addEventListener('click', async () => {
          try {
            const res = await API.post(`/admin/users/${user.id}/verify`);
            toast(res.verified ? 'Верифицирован' : 'Галочка снята', 'success');
            render(currentUser, opts);
          } catch (e) { toast(e.message, 'error'); }
        });
      }

      // Followers/following modals
      document.getElementById('show-followers').addEventListener('click', () => showFollowList(username, 'followers'));
      document.getElementById('show-following').addEventListener('click', () => showFollowList(username, 'following'));

      // Tabs
      document.getElementById('profile-tabs').addEventListener('click', async (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        document.querySelectorAll('#profile-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        await loadTab(btn.dataset.tab, username, currentUser);
      });

      await loadTab('posts', username, currentUser);

    } catch (e) {
      main.innerHTML = '<div class="page-inner"><div class="empty-state">Пользователь не найден</div></div>';
    }
  }

  async function loadTab(tab, username, currentUser) {
    const container = document.getElementById('profile-posts');
    if (!container) return;
    container.innerHTML = '<div class="spinner"></div>';

    try {
      let posts;
      if (tab === 'posts') posts = await API.get(`/users/${username}/posts`);
      else if (tab === 'liked') posts = await API.get(`/users/${username}/liked`);
      else if (tab === 'reposts') posts = await API.get(`/users/${username}/reposts`);

      if (!posts.length) {
        container.innerHTML = '<div class="empty-state">Пусто</div>';
        return;
      }

      container.innerHTML = posts.map(p => renderPost({
        ...p,
        author: { id: p.author_id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, verified: p.verified },
        likeCount: p.like_count, repostCount: p.repost_count, commentCount: p.comment_count,
        liked: !!p.liked, reposted: !!p.reposted
      }, currentUser)).join('');

      bindPostActions(container, currentUser);
    } catch (e) {
      container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
  }

  async function showFollowList(username, type) {
    openModal(`<div class="spinner"></div>`);
    try {
      const list = await API.get(`/users/${username}/${type}`);
      const title = type === 'followers' ? 'Подписчики' : 'Подписки';
      document.getElementById('modal-content').innerHTML = `
        <div class="auth-title" style="margin-bottom:16px">${title}</div>
        ${list.length === 0 ? '<div class="empty-state" style="padding:20px">Пусто</div>' : list.map(u => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
            ${avatarHTML(u)}
            <div style="flex:1">
              <div style="font-weight:600;display:flex;align-items:center;gap:5px">
                ${escapeHTML(u.display_name)} ${u.verified ? verifiedBadge() : ''}
              </div>
              <div style="font-size:13px;color:var(--text3)">@${u.username}</div>
            </div>
          </div>
        `).join('')}
      `;
    } catch(e) {
      document.getElementById('modal-content').innerHTML = '<div class="empty-state">Ошибка</div>';
    }
  }

  function showEditModal(user) {
    openModal(`
      <div class="auth-title" style="margin-bottom:20px">Редактировать профиль</div>
      <div class="form-group">
        <label class="form-label">Имя</label>
        <input type="text" id="edit-display" value="${escapeHTML(user.display_name)}" maxlength="50" />
      </div>
      <div class="form-group">
        <label class="form-label">О себе</label>
        <textarea id="edit-bio" maxlength="200">${escapeHTML(user.bio || '')}</textarea>
      </div>
      <div class="form-error" id="edit-error"></div>
      <button class="btn btn-primary btn-full" id="edit-save-btn" style="margin-top:8px">Сохранить</button>
    `);

    document.getElementById('edit-save-btn').addEventListener('click', async () => {
      const fd = new FormData();
      fd.append('displayName', document.getElementById('edit-display').value.trim());
      fd.append('bio', document.getElementById('edit-bio').value.trim());
      const errEl = document.getElementById('edit-error');
      errEl.classList.remove('show');
      try {
        const updated = await API.patchUpload('/users/me', fd);
        API.setUser(updated);
        closeModal();
        toast('Профиль обновлён', 'success');
        App.navigateTo('profile');
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.add('show');
      }
    });
  }

  async function showVerifyModal() {
    openModal(`<div class="spinner"></div>`);
    try {
      const status = await API.get('/verification/status');
      let html = '';

      if (App.getUser().verified) {
        html = '<div class="empty-state">Ты уже верифицирован</div>';
      } else if (status.request && status.request.status === 'pending') {
        html = `
          <div class="auth-title" style="margin-bottom:16px">Заявка на верификацию</div>
          <div style="text-align:center;color:var(--text2);padding:20px 0">
            Заявка отправлена и ожидает рассмотрения администратором.
          </div>
        `;
      } else if (status.cooldownUntil && new Date(status.cooldownUntil) > new Date()) {
        html = `
          <div class="auth-title" style="margin-bottom:16px">Верификация</div>
          <div style="text-align:center;color:var(--danger);padding:20px 0">
            Заявка отклонена. Повторно можно подать ${new Date(status.cooldownUntil).toLocaleDateString('ru-RU')}.
          </div>
        `;
      } else {
        const r = status.requirements;
        html = `
          <div class="auth-title" style="margin-bottom:16px">Заявка на верификацию</div>
          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px">
              <span>Дней на платформе</span>
              <span style="color:${r.daysSince >= r.minDays ? 'var(--success)' : 'var(--danger)'}">${r.daysSince} / ${r.minDays}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px">
              <span>Постов опубликовано</span>
              <span style="color:${r.postCount >= r.minPosts ? 'var(--success)' : 'var(--danger)'}">${r.postCount} / ${r.minPosts}</span>
            </div>
          </div>
          <div class="form-group" style="margin-top:16px">
            <label class="form-label">Почему ты хочешь верификацию?</label>
            <textarea id="verify-reason" placeholder="Расскажи о себе, зачем тебе галочка..." maxlength="500"></textarea>
          </div>
          <div class="form-error" id="verify-error"></div>
          <button class="btn btn-primary btn-full ${status.eligible ? '' : 'btn-disabled'}" id="verify-submit" ${status.eligible ? '' : 'disabled'}>
            ${status.eligible ? 'Отправить заявку' : 'Выполни требования выше'}
          </button>        `;
      }

      document.getElementById('modal-content').innerHTML = html;

      const submitBtn = document.getElementById('verify-submit');
      if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
          const reason = document.getElementById('verify-reason').value.trim();
          const errEl = document.getElementById('verify-error');
          errEl.classList.remove('show');
          try {
            await API.post('/verification/apply', { reason });
            closeModal();
            toast('Заявка отправлена', 'success');
          } catch(e) {
            errEl.textContent = e.message;
            errEl.classList.add('show');
          }
        });
      }
    } catch(e) {
      document.getElementById('modal-content').innerHTML = '<div class="empty-state">Ошибка</div>';
    }
  }

  return { render };
})();
