const AdminPage = (() => {
  let currentTab = 'users';

  async function render(currentUser) {
    if (currentUser.role !== 'admin') {
      document.getElementById('main-content').innerHTML = '<div class="page-inner"><div class="empty-state">Нет доступа</div></div>';
      return;
    }

    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page-inner">
      <div class="page-header">
        <div class="page-title">Администратор</div>
        <div class="page-subtitle">@${currentUser.username}</div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="users">Пользователи</button>
        <button class="tab-btn" data-tab="channels">Каналы</button>
        <button class="tab-btn" data-tab="posts">Посты</button>
        <button class="tab-btn" data-tab="reports">Жалобы</button>
        <button class="tab-btn" data-tab="verification">Верификация</button>
        <button class="tab-btn" data-tab="storage">База данных</button>
      </div>
      <div id="admin-content"><div class="spinner"></div></div>
      </div>
    `;

    main.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        main.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        loadTab(currentTab);
      });
    });

    await loadTab('users');
  }

  async function loadTab(tab) {
    const container = document.getElementById('admin-content');
    container.innerHTML = '<div class="spinner"></div>';

    if (tab === 'users') await renderUsers(container);
    else if (tab === 'channels') await renderChannels(container);
    else if (tab === 'posts') await renderPosts(container);
    else if (tab === 'reports') await renderReports(container);
    else if (tab === 'verification') await renderVerification(container);
    else if (tab === 'storage') await renderStorage(container);
  }

  async function renderUsers(container) {
    try {
      const users = await API.get('/admin/users');
      container.innerHTML = `
        <div style="overflow-x:auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Дата</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr data-user-id="${u.id}">
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <div>
                        <div style="font-weight:600">${escapeHTML(u.display_name)}</div>
                        <div style="font-size:12px;color:var(--text3)">@${u.username}</div>
                      </div>
                      ${u.verified ? verifiedBadge() : ''}
                    </div>
                  </td>
                  <td>
                    ${u.role === 'admin' ? adminBadge() : `<span class="pill">${u.role}</span>`}
                  </td>
                  <td>
                    ${u.banned
                      ? `<span class="pill pill-danger">Забанен</span>`
                      : `<span class="pill pill-success">Активен</span>`
                    }
                  </td>
                  <td style="color:var(--text3);font-size:13px">${u.created_at.split('T')[0]}</td>
                  <td>
                    <div class="user-row-actions">
                      ${u.role !== 'admin' ? `
                        <button class="btn btn-ghost btn-sm" data-action="${u.banned ? 'unban' : 'ban'}" data-user-id="${u.id}" data-username="${u.username}">
                          ${u.banned ? 'Разбанить' : 'Забанить'}
                        </button>
                        <button class="btn btn-ghost btn-sm" data-action="verify" data-user-id="${u.id}">
                          ${u.verified ? 'Снять галочку' : 'Верифицировать'}
                        </button>
                      ` : '<span style="color:var(--text3);font-size:13px">—</span>'}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      container.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const userId = btn.dataset.userId;
          const username = btn.dataset.username;

          if (action === 'ban' && !confirm(`Забанить @${username}?`)) return;

          try {
            if (action === 'ban') {
              await API.post(`/admin/users/${userId}/ban`);
              toast(`@${username} забанен`, 'success');
            } else if (action === 'unban') {
              await API.post(`/admin/users/${userId}/unban`);
              toast(`@${username} разбанен`, 'success');
            } else if (action === 'verify') {
              const res = await API.post(`/admin/users/${userId}/verify`);
              toast(res.verified ? 'Верифицирован' : 'Галочка снята', 'success');
            }
            await renderUsers(container);
          } catch (e) { toast(e.message, 'error'); }
        });
      });

    } catch (e) {
      container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
  }

  async function renderChannels(container) {
    try {
      const channels = await API.get('/admin/channels');
      container.innerHTML = `
        <div style="overflow-x:auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Канал</th>
                <th>Владелец</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              ${channels.map(ch => `
                <tr>
                  <td>
                    <div style="font-weight:600">${escapeHTML(ch.name)} ${ch.verified ? verifiedBadge() : ''}</div>
                  </td>
                  <td style="color:var(--text2)">@${ch.owner_username}</td>
                  <td>
                    ${ch.banned
                      ? `<span class="pill pill-danger">Заблокирован</span>`
                      : `<span class="pill pill-success">Активен</span>`
                    }
                  </td>
                  <td>
                    <div class="user-row-actions">
                      <button class="btn btn-ghost btn-sm" data-action="${ch.banned ? 'unban-ch' : 'ban-ch'}" data-channel-id="${ch.id}" data-name="${escapeHTML(ch.name)}">
                        ${ch.banned ? 'Разблокировать' : 'Заблокировать'}
                      </button>
                      <button class="btn btn-ghost btn-sm" data-action="verify-ch" data-channel-id="${ch.id}">
                        ${ch.verified ? 'Снять галочку' : 'Верифицировать'}
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      container.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const id = btn.dataset.channelId;

          try {
            if (action === 'ban-ch') {
              if (!confirm(`Заблокировать канал "${btn.dataset.name}"?`)) return;
              await API.post(`/admin/channels/${id}/ban`);
              toast('Канал заблокирован', 'success');
            } else if (action === 'unban-ch') {
              await API.post(`/admin/channels/${id}/unban`);
              toast('Канал разблокирован', 'success');
            } else if (action === 'verify-ch') {
              const res = await API.post(`/admin/channels/${id}/verify`);
              toast(res.verified ? 'Верифицирован' : 'Галочка снята', 'success');
            }
            await renderChannels(container);
          } catch (e) { toast(e.message, 'error'); }
        });
      });

    } catch (e) {
      container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
  }

  async function renderPosts(container) {
    try {
      const posts = await API.get('/posts?page=1');
      if (posts.length === 0) {
        container.innerHTML = '<div class="empty-state">Постов нет</div>';
        return;
      }

      container.innerHTML = `
        <div style="overflow-x:auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Автор</th>
                <th>Текст</th>
                <th>Дата</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              ${posts.map(p => `
                <tr data-post-row="${p.id}">
                  <td style="white-space:nowrap">@${p.author ? p.author.username : '—'}</td>
                  <td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    ${escapeHTML((p.text || '').slice(0, 120))}
                  </td>
                  <td style="color:var(--text3);font-size:13px;white-space:nowrap">${formatDate(p.created_at)}</td>
                  <td>
                    <button class="btn btn-danger btn-sm" data-delete-admin-post="${p.id}">Удалить</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      container.querySelectorAll('[data-delete-admin-post]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Удалить этот пост?')) return;
          const id = btn.dataset.deleteAdminPost;
          try {
            await API.delete(`/admin/posts/${id}`);
            const row = container.querySelector(`[data-post-row="${id}"]`);
            if (row) row.remove();
            toast('Пост удалён', 'success');
          } catch (e) { toast(e.message, 'error'); }
        });
      });

    } catch (e) {
      container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
  }

  async function renderReports(container) {
    try {
      const reports = await API.get('/reports');
      if (!reports.length) { container.innerHTML = '<div class="empty-state">Жалоб нет</div>'; return; }
      container.innerHTML = `
        <div style="overflow-x:auto">
          <table class="admin-table">
            <thead><tr><th>Жалоба от</th><th>Автор поста</th><th>Причина</th><th>Текст поста</th><th>Действия</th></tr></thead>
            <tbody>
              ${reports.map(r => `
                <tr data-report-row="${r.id}">
                  <td>@${r.reporter_username}</td>
                  <td>@${r.author_username}</td>
                  <td><span class="pill">${escapeHTML(r.reason)}</span></td>
                  <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML((r.post_text||'').slice(0,80))}</td>
                  <td>
                    <div class="user-row-actions">
                      <button class="btn btn-ghost btn-sm" data-resolve="${r.id}" data-action="dismiss">Отклонить</button>
                      <button class="btn btn-danger btn-sm" data-resolve="${r.id}" data-action="delete_post">Удалить пост</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      container.querySelectorAll('[data-resolve]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.resolve;
          const action = btn.dataset.action;
          try {
            await API.post(`/reports/${id}/resolve`, { action });
            const row = container.querySelector(`[data-report-row="${id}"]`);
            if (row) row.remove();
            toast('Готово', 'success');
          } catch(e) { toast(e.message, 'error'); }
        });
      });
    } catch(e) { container.innerHTML = '<div class="empty-state">Ошибка</div>'; }
  }

  async function renderVerification(container) {
    try {
      const requests = await API.get('/verification/requests');
      if (!requests.length) { container.innerHTML = '<div class="empty-state">Заявок нет</div>'; return; }
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${requests.map(r => `
            <div class="post-card fade-in" data-vr-row="${r.id}">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                ${avatarHTML(r)}
                <div>
                  <div style="font-weight:700">${escapeHTML(r.display_name)} <span style="color:var(--text3);font-size:13px">@${r.username}</span></div>
                  <div style="font-size:12px;color:var(--text3)">${r.post_count} постов · ${r.follower_count} подписчиков</div>
                </div>
              </div>
              <div style="color:var(--text2);font-size:14px;margin-bottom:14px">"${escapeHTML(r.reason)}"</div>
              <div class="user-row-actions">
                <button class="btn btn-primary btn-sm" data-vr-approve="${r.id}">Одобрить</button>
                <button class="btn btn-ghost btn-sm" data-vr-reject="${r.id}">Отклонить</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      container.querySelectorAll('[data-vr-approve]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await API.post(`/verification/requests/${btn.dataset.vrApprove}/approve`);
            container.querySelector(`[data-vr-row="${btn.dataset.vrApprove}"]`)?.remove();
            toast('Верифицирован', 'success');
          } catch(e) { toast(e.message, 'error'); }
        });
      });

      container.querySelectorAll('[data-vr-reject]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await API.post(`/verification/requests/${btn.dataset.vrReject}/reject`);
            container.querySelector(`[data-vr-row="${btn.dataset.vrReject}"]`)?.remove();
            toast('Отклонено', 'success');
          } catch(e) { toast(e.message, 'error'); }
        });
      });
    } catch(e) { container.innerHTML = '<div class="empty-state">Ошибка</div>'; }
  }

  async function renderStorage(container) {
    try {
      const s = await API.get('/admin/stats');
      const usedPct = Math.min(100, (s.mediaSizeMB / 230 * 100)).toFixed(1); // 230MB лимит free tier

      container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="post-card">
            <div class="section-title" style="margin-bottom:16px">Использование базы данных</div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px">
              <div style="background:var(--bg3);border-radius:var(--radius-sm);padding:16px">
                <div style="font-size:24px;font-weight:800">${s.userCount}</div>
                <div style="color:var(--text3);font-size:13px;margin-top:4px">пользователей</div>
              </div>
              <div style="background:var(--bg3);border-radius:var(--radius-sm);padding:16px">
                <div style="font-size:24px;font-weight:800">${s.postCount}</div>
                <div style="color:var(--text3);font-size:13px;margin-top:4px">постов</div>
              </div>
              <div style="background:var(--bg3);border-radius:var(--radius-sm);padding:16px">
                <div style="font-size:24px;font-weight:800">${s.mediaCount}</div>
                <div style="color:var(--text3);font-size:13px;margin-top:4px">постов с картинками</div>
              </div>
              <div style="background:var(--bg3);border-radius:var(--radius-sm);padding:16px">
                <div style="font-size:24px;font-weight:800">${s.mediaToday}</div>
                <div style="color:var(--text3);font-size:13px;margin-top:4px">картинок сегодня</div>
              </div>
            </div>
            <div style="margin-bottom:8px;display:flex;justify-content:space-between;font-size:14px">
              <span>Медиа в БД</span>
              <span style="font-weight:700">${s.mediaSizeMB} MB / 230 MB</span>
            </div>
            <div style="background:var(--bg3);border-radius:99px;height:10px;overflow:hidden">
              <div style="height:100%;border-radius:99px;width:${usedPct}%;background:${usedPct > 80 ? 'var(--danger)' : usedPct > 60 ? '#f0a500' : 'var(--accent)'}"></div>
            </div>
            <div style="color:var(--text3);font-size:12px;margin-top:6px">${usedPct}% использовано</div>
          </div>

          <div class="post-card">
            <div class="section-title" style="margin-bottom:14px">Топ по загрузке картинок</div>
            <table class="admin-table">
              <thead><tr><th>Пользователь</th><th>Картинок</th></tr></thead>
              <tbody>
                ${s.topMedia.map(u => `
                  <tr>
                    <td>@${u.username}</td>
                    <td><span class="pill">${u.cnt}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch(e) { container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>'; }
  }

  return { render };
})();
