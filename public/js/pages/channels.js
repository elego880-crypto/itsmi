const ChannelsPage = (() => {
  let currentUser = null;

  async function render(user, opts = {}) {
    currentUser = user;
    if (opts.channelId) {
      await renderChannel(opts.channelId);
      return;
    }
    await renderList();
  }

  async function renderList() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page-inner">
        <div class="page-header">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div class="page-title">Каналы</div>
            <button class="btn btn-primary btn-sm" id="btn-create-channel">Создать канал</button>
          </div>
        </div>
        <div id="channels-list">${renderChannelSkeletons(4)}</div>
      </div>
    `;

    document.getElementById('btn-create-channel').addEventListener('click', () => showCreateModal());

    try {
      const channels = await API.get('/channels');
      const container = document.getElementById('channels-list');
      if (channels.length === 0) {
        container.innerHTML = '<div class="empty-state">Каналов пока нет</div>';
        return;
      }
      container.innerHTML = channels.map(ch => `
        <div class="channel-card fade-in" data-channel-id="${ch.id}">
          ${avatarHTML({ avatar_url: ch.avatar_url, display_name: ch.name })}
          <div class="channel-info">
            <div class="channel-name">
              ${escapeHTML(ch.name)}
              ${ch.verified ? verifiedBadge() : ''}
            </div>
            ${ch.description ? `<div class="channel-desc">${escapeHTML(ch.description)}</div>` : ''}
            <div class="channel-meta">${ch.subscriber_count} подписчиков · @${ch.owner_username}</div>
          </div>
          <button class="btn btn-ghost btn-sm sub-btn" data-channel-id="${ch.id}" data-subscribed="${ch.subscribed ? '1' : '0'}">
            ${ch.subscribed ? 'Отписаться' : 'Подписаться'}
          </button>
        </div>
      `).join('');

      container.querySelectorAll('.channel-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.sub-btn')) return;
          App.navigateTo('channel', { channelId: card.dataset.channelId });
        });
      });

      container.querySelectorAll('.sub-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.dataset.channelId;
          try {
            const res = await API.post(`/channels/${id}/subscribe`);
            btn.dataset.subscribed = res.subscribed ? '1' : '0';
            btn.textContent = res.subscribed ? 'Отписаться' : 'Подписаться';
            const meta = btn.closest('.channel-card').querySelector('.channel-meta');
            if (meta) {
              const parts = meta.textContent.split('·');
              if (parts[1]) meta.textContent = `${res.subscriberCount} подписчиков ·${parts[1]}`;
            }
          } catch (e) { toast(e.message, 'error'); }
        });
      });
    } catch (e) {
      document.getElementById('channels-list').innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
  }

  async function renderChannel(channelId) {
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="spinner"></div>';

    try {
      const channel = await API.get(`/channels/${channelId}`);
      const isOwner = currentUser && channel.owner_id === currentUser.id;
      const isAdmin = currentUser && currentUser.role === 'admin';

      main.innerHTML = `
        <div class="page-inner">
        <a href="#" class="back-btn" id="back-channels">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          Каналы
        </a>
        <div class="channel-header fade-in">
          <div class="profile-top">
            ${avatarHTML({ avatar_url: channel.avatar_url, display_name: channel.name }, 'lg')}
            <div class="profile-info">
              <div class="profile-name">
                ${escapeHTML(channel.name)}
                ${channel.verified ? verifiedBadge() : ''}
              </div>
              <div class="profile-handle">Владелец: @${channel.owner_username}</div>
              ${channel.description ? `<div class="profile-bio">${escapeHTML(channel.description)}</div>` : ''}
              <div class="profile-stats">
                <div class="profile-stat"><span>${channel.subscriber_count}</span><small>подписчиков</small></div>
              </div>
              <div style="margin-top:16px;display:flex;gap:8px">
                <button class="btn btn-primary btn-sm" id="sub-btn">
                  ${channel.subscribed ? 'Отписаться' : 'Подписаться'}
                </button>
              </div>
            </div>
          </div>
        </div>
        ${(isOwner || isAdmin) ? `
          <div class="compose-card">
            <textarea id="channel-compose-text" placeholder="Новый пост в канале..." maxlength="2000"></textarea>
            <div id="channel-compose-preview" class="hidden"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">
              <label class="compose-img-btn">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <input type="file" id="channel-compose-file" accept="image/*" style="display:none" />
              </label>
              <button class="btn btn-primary btn-sm" id="channel-post-submit">Опубликовать</button>
            </div>
          </div>
        ` : ''}
        <div id="channel-posts"><div class="spinner"></div></div>
        </div>
      `;

      document.getElementById('back-channels').addEventListener('click', (e) => {
        e.preventDefault();
        App.navigateTo('channels');
      });

      document.getElementById('sub-btn').addEventListener('click', async () => {
        try {
          const res = await API.post(`/channels/${channelId}/subscribe`);
          document.getElementById('sub-btn').textContent = res.subscribed ? 'Отписаться' : 'Подписаться';
        } catch (e) { toast(e.message, 'error'); }
      });

      if (isOwner || isAdmin) {
        bindChannelCompose(channelId);
      }

      await loadChannelPosts(channelId);
      bindPostActions(document.getElementById('channel-posts'), currentUser);

      WS.on('new_channel_post', ({ channelId: cid, post }) => {
        if (String(cid) !== String(channelId)) return;
        const container = document.getElementById('channel-posts');
        if (!container) return;
        container.insertAdjacentHTML('afterbegin', renderPost(post, currentUser, { isChannelPost: true }));
      });

    } catch (e) {
      main.innerHTML = '<div class="empty-state">Канал не найден</div>';
    }
  }

  async function loadChannelPosts(channelId) {
    const container = document.getElementById('channel-posts');
    if (!container) return;
    try {
      const posts = await API.get(`/channels/${channelId}/posts`);
      if (posts.length === 0) {
        container.innerHTML = '<div class="empty-state">Постов пока нет</div>';
        return;
      }
      container.innerHTML = posts.map(p => renderPost(p, currentUser, { isChannelPost: true })).join('');
    } catch (e) {
      container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
  }

  function bindChannelCompose(channelId) {
    const fileInput = document.getElementById('channel-compose-file');
    const preview = document.getElementById('channel-compose-preview');
    let selectedFile = null;

    fileInput && fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      selectedFile = file;
      const url = URL.createObjectURL(file);
      preview.innerHTML = `<div class="compose-preview"><img src="${url}" /><button class="compose-preview-remove" id="ch-preview-remove">&times;</button></div>`;
      preview.classList.remove('hidden');
      document.getElementById('ch-preview-remove').addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        preview.innerHTML = '';
        preview.classList.add('hidden');
      });
    });

    const submitBtn = document.getElementById('channel-post-submit');
    submitBtn && submitBtn.addEventListener('click', async () => {
      const text = document.getElementById('channel-compose-text').value.trim();
      if (!text && !selectedFile) return;
      submitBtn.disabled = true;
      try {
        if (selectedFile) {
          const fd = new FormData();
          fd.append('text', text);
          fd.append('media', selectedFile);
          await API.upload(`/channels/${channelId}/posts`, fd);
        } else {
          await API.post(`/channels/${channelId}/posts`, { text });
        }
        document.getElementById('channel-compose-text').value = '';
        selectedFile = null;
        if (fileInput) fileInput.value = '';
        preview.innerHTML = '';
        preview.classList.add('hidden');
        toast('Опубликовано', 'success');
      } catch (e) { toast(e.message, 'error'); }
      submitBtn.disabled = false;
    });
  }

  function showCreateModal() {
    openModal(`
      <div class="auth-title" style="margin-bottom:20px">Создать канал</div>
      <div class="form-group">
        <label class="form-label">Название</label>
        <input type="text" id="ch-name" placeholder="Название канала" maxlength="80" />
      </div>
      <div class="form-group">
        <label class="form-label">Описание</label>
        <textarea id="ch-desc" placeholder="О чём канал..." maxlength="300"></textarea>
      </div>
      <div class="form-error" id="ch-error"></div>
      <button class="btn btn-primary btn-full" id="ch-create-btn" style="margin-top:8px">Создать</button>
    `);

    document.getElementById('ch-create-btn').addEventListener('click', async () => {
      const name = document.getElementById('ch-name').value.trim();
      const desc = document.getElementById('ch-desc').value.trim();
      const errEl = document.getElementById('ch-error');
      errEl.classList.remove('show');
      try {
        await API.post('/channels', { name, description: desc });
        closeModal();
        toast('Канал создан', 'success');
        await renderList();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.add('show');
      }
    });
  }

  return { render };
})();
