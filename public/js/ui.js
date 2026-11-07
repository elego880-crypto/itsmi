// UI helpers — toast, modal, avatar, formatDate, post rendering

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  const container = document.getElementById('toast-container');
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return Math.floor(diff / 60) + ' мин';
  if (diff < 86400) return Math.floor(diff / 3600) + ' ч';
  if (diff < 604800) return Math.floor(diff / 86400) + ' д';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function avatarHTML(user, size = '') {
  const sizeClass = size ? ' avatar-' + size : '';
  if (user && user.avatar_url) {
    return `<div class="avatar${sizeClass}"><img src="${user.avatar_url}" alt="" loading="lazy" /></div>`;
  }
  const letter = user ? (user.display_name || user.username || '?')[0].toUpperCase() : '?';
  return `<div class="avatar${sizeClass}">${letter}</div>`;
}

function verifiedBadge() {
  return `<span class="badge-verified" title="Верифицирован"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="display:inline-block;vertical-align:text-bottom"><path d="M12 2C11.5 2 11 2.19 10.59 2.59L8.5 4.5L5.5 5C4.67 5.17 4 5.84 4 6.67V9.5L2.09 11.41C1.29 12.21 1.29 13.53 2.09 14.33L4 16.24V19.17C4 20 4.67 20.67 5.5 20.84L8.5 21.34L10.59 23.25C11.39 24.05 12.71 24.05 13.51 23.25L15.6 21.34L18.6 20.84C19.43 20.67 20.1 20 20.1 19.17V16.24L22.01 14.33C22.81 13.53 22.81 12.21 22.01 11.41L20.1 9.5V6.67C20.1 5.84 19.43 5.17 18.6 5L15.6 4.5L13.51 2.59C13.1 2.19 12.6 2 12.1 2H12Z" fill="#5865F2"/><path d="M10.5 16.5L7 13L8.41 11.59L10.5 13.67L15.59 8.59L17 10L10.5 16.5Z" fill="white"/></svg></span>`;
}

function adminBadge() {
  // Only shown in profile/admin panel, not in post feed
  return '';
}

function renderPost(post, currentUser, opts = {}) {
  const isOwner = currentUser && post.author_id === currentUser.id;
  const isAdmin = currentUser && currentUser.role === 'admin';
  const canDelete = isOwner || isAdmin;
  const author = post.author || {};

  const likeCount = post.likeCount ?? post.like_count ?? 0;
  const repostCount = post.repostCount ?? post.repost_count ?? 0;
  const commentCount = post.commentCount ?? post.comment_count ?? 0;

  const repostBar = post.reposted_by_username ? `
    <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text3);margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
      <span>Репост от <a href="#" data-nav-profile="${post.reposted_by_username}" style="color:var(--text2);font-weight:600">@${post.reposted_by_username}</a></span>
    </div>
  ` : '';

  return `
    <div class="post-card fade-in" data-post-id="${post.id}">
      ${repostBar}
      <div class="post-header">
        <a href="#" data-nav-profile="${author.username}">
          ${avatarHTML(author)}
        </a>
        <div class="post-author">
          <div class="post-author-name">
            <a href="#" data-nav-profile="${author.username}">${author.display_name || author.username}</a>
            ${author.verified ? verifiedBadge() : ''}
            ${author.role === 'admin' ? adminBadge() : ''}
          </div>
          <div class="post-author-handle">@${author.username}</div>
        </div>
        <span class="post-time">${formatDate(post.created_at)}</span>
        ${canDelete ? `
          <div style="display:flex;gap:4px">
            ${isOwner ? `
              <button class="action-btn-delete" data-edit-post="${post.id}" title="Редактировать" style="color:var(--text3)">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            ` : ''}
            <button class="action-btn-delete" data-delete-post="${post.id}" title="Удалить">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        ` : `
          <button class="action-btn-delete" data-report-post="${post.id}" title="Пожаловаться" style="opacity:0">
            <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
        `}
      </div>
      ${post.text ? `<div class="post-text">${renderText(post.text)}</div>` : ''}
      ${post.media_url ? `<div class="post-media"><img src="${post.media_url}" alt="" loading="lazy" /></div>` : ''}
      <div class="post-actions">
        <button class="action-btn ${post.liked ? 'liked' : ''}" data-like-post="${post.id}">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>${likeCount}</span>
        </button>
        <button class="action-btn" data-comments-post="${post.id}">
          <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>${commentCount}</span>
        </button>
        ${!opts.isChannelPost ? `
        <button class="action-btn ${post.reposted ? 'reposted' : ''}" data-repost-post="${post.id}">
          <svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          <span>${repostCount}</span>
        </button>
        ` : ''}
      </div>
      <div class="comments-section hidden" id="comments-${post.id}"></div>
    </div>
  `;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Превращает @username в кликабельные ссылки
function renderText(text) {
  return escapeHTML(text).replace(
    /@([a-zA-Z0-9_]+)/g,
    '<a href="#" data-nav-profile="$1" style="color:var(--accent);font-weight:500">@$1</a>'
  );
}

function renderComment(c, currentUser) {
  const isOwner = currentUser && c.author_id === currentUser.id;
  const isAdmin = currentUser && currentUser.role === 'admin';
  const canDelete = isOwner || isAdmin;
  return `
    <div class="comment fade-in" data-comment-id="${c.id}">
      ${avatarHTML(c, 'sm')}
      <div class="comment-body">
        <div class="comment-author">
          ${escapeHTML(c.display_name || c.username)}
          ${c.verified ? verifiedBadge() : ''}
          <span>@${c.username} · ${formatDate(c.created_at)}</span>
        </div>
        <div class="comment-text">${renderText(c.text)}</div>
        <div class="comment-actions">
          <button class="comment-like-btn ${c.liked ? 'liked' : ''}" data-like-comment="${c.id}">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>${c.like_count || 0}</span>
          </button>
          ${canDelete ? `<button class="comment-like-btn" data-delete-comment="${c.id}" data-post-id="${c.post_id}" style="color:var(--danger)">удалить</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

async function loadComments(postId, container, currentUser) {
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const comments = await API.get(`/posts/${postId}/comments`);
    container.innerHTML = `
      ${comments.map(c => renderComment(c, currentUser)).join('')}
      <div class="comment-form">
        <input type="text" placeholder="Комментарий..." id="comment-input-${postId}" maxlength="500" />
        <button class="btn btn-primary btn-sm" data-submit-comment="${postId}">Отправить</button>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Не удалось загрузить комментарии</div>`;
  }
}

// Delegate post interactions to document
function bindPostActions(container, currentUser) {
  container.addEventListener('click', async (e) => {
    const likeBtn = e.target.closest('[data-like-post]');
    const commentsBtn = e.target.closest('[data-comments-post]');
    const repostBtn = e.target.closest('[data-repost-post]');
    const deleteBtn = e.target.closest('[data-delete-post]');
    const editBtn = e.target.closest('[data-edit-post]');
    const submitCommentBtn = e.target.closest('[data-submit-comment]');
    const likeCommentBtn = e.target.closest('[data-like-comment]');
    const deleteCommentBtn = e.target.closest('[data-delete-comment]');
    const navProfile = e.target.closest('[data-nav-profile]');

    const reportBtn = e.target.closest('[data-report-post]');

    if (reportBtn) {
      const postId = reportBtn.dataset.reportPost;
      openModal(`
        <div class="auth-title" style="margin-bottom:20px">Пожаловаться на пост</div>
        <div class="form-group">
          <label class="form-label">Причина</label>
          <select id="report-reason" style="background:var(--bg3);border:1.5px solid var(--border);border-radius:12px;padding:11px 14px;color:var(--text);width:100%;font-size:15px;outline:none">
            <option value="spam">Спам</option>
            <option value="hate">Оскорбления / Ненависть</option>
            <option value="misinformation">Дезинформация</option>
            <option value="other">Другое</option>
          </select>
        </div>
        <div class="form-error" id="report-error"></div>
        <button class="btn btn-danger btn-full" id="report-submit" style="margin-top:8px">Отправить жалобу</button>
      `);
      document.getElementById('report-submit').addEventListener('click', async () => {
        const reason = document.getElementById('report-reason').value;
        try {
          await API.post('/reports', { postId, reason });
          closeModal();
          toast('Жалоба отправлена', 'success');
        } catch(e) {
          document.getElementById('report-error').textContent = e.message;
          document.getElementById('report-error').classList.add('show');
        }
      });
      return;
    }

    if (navProfile) {
      e.preventDefault();
      App.navigateTo('profile', { username: navProfile.dataset.navProfile });
      return;
    }

    if (likeBtn) {
      const postId = likeBtn.dataset.likePost;
      try {
        const res = await API.post(`/posts/${postId}/like`);
        likeBtn.classList.toggle('liked', res.liked);
        likeBtn.querySelector('span').textContent = res.count;
        if (res.liked) likeBtn.classList.add('like-pop');
        setTimeout(() => likeBtn.classList.remove('like-pop'), 400);
      } catch (e) { toast(e.message, 'error'); }
      return;
    }

    if (commentsBtn) {
      const postId = commentsBtn.dataset.commentsPost;
      const section = document.getElementById('comments-' + postId);
      if (!section) return;
      const isVisible = !section.classList.contains('hidden');
      section.classList.toggle('hidden', isVisible);
      if (!isVisible) loadComments(postId, section, currentUser);
      return;
    }

    if (repostBtn) {
      const postId = repostBtn.dataset.repostPost;
      try {
        const res = await API.post(`/posts/${postId}/repost`);
        repostBtn.classList.toggle('reposted', res.reposted);
        repostBtn.querySelector('span').textContent = res.count;
      } catch (e) { toast(e.message, 'error'); }
      return;
    }

    if (deleteBtn) {
      if (!confirm('Удалить пост?')) return;
      const postId = deleteBtn.dataset.deletePost;
      try {
        await API.delete(`/posts/${postId}`);
        const card = container.querySelector(`[data-post-id="${postId}"]`);
        if (card) card.remove();
      } catch (e) { toast(e.message, 'error'); }
      return;
    }

    if (editBtn) {
      const postId = editBtn.dataset.editPost;
      const card = container.querySelector(`[data-post-id="${postId}"]`);
      const textEl = card ? card.querySelector('.post-text') : null;
      const currentText = textEl ? textEl.innerText : '';
      openModal(`
        <div class="auth-title" style="margin-bottom:20px">Редактировать пост</div>
        <div class="form-group">
          <textarea id="edit-post-text" style="background:var(--bg3);border:1.5px solid var(--border);border-radius:12px;padding:11px 14px;color:var(--text);width:100%;font-size:15px;outline:none;resize:vertical;min-height:100px;font-family:inherit;box-sizing:border-box" maxlength="2000">${escapeHTML(currentText)}</textarea>
        </div>
        <div class="form-error" id="edit-post-error"></div>
        <button class="btn btn-primary btn-full" id="edit-post-submit" style="margin-top:8px">Сохранить</button>
      `);
      document.getElementById('edit-post-submit').addEventListener('click', async () => {
        const text = document.getElementById('edit-post-text').value.trim();
        if (!text) return;
        try {
          const res = await API.patch(`/posts/${postId}`, { text });
          if (textEl) textEl.innerHTML = renderText(res.text || text);
          closeModal();
          toast('Пост обновлён', 'success');
        } catch(e) {
          document.getElementById('edit-post-error').textContent = e.message;
          document.getElementById('edit-post-error').classList.add('show');
        }
      });
      return;
    }

    if (submitCommentBtn) {
      const postId = submitCommentBtn.dataset.submitComment;
      const input = document.getElementById('comment-input-' + postId);
      const text = input.value.trim();
      if (!text) return;
      try {
        const comment = await API.post(`/posts/${postId}/comments`, { text });
        const section = document.getElementById('comments-' + postId);
        const form = section.querySelector('.comment-form');
        const el = document.createElement('div');
        el.innerHTML = renderComment({ ...comment, ...currentUser, like_count: 0, liked: false }, currentUser);
        section.insertBefore(el.firstChild, form);
        input.value = '';
      } catch (e) { toast(e.message, 'error'); }
      return;
    }

    if (likeCommentBtn) {
      const commentId = likeCommentBtn.dataset.likeComment;
      try {
        const res = await API.post(`/posts/comments/${commentId}/like`);
        likeCommentBtn.classList.toggle('liked', res.liked);
        likeCommentBtn.querySelector('span').textContent = res.count;
      } catch (e) { toast(e.message, 'error'); }
      return;
    }

    if (deleteCommentBtn) {
      const commentId = deleteCommentBtn.dataset.deleteComment;
      const postId = deleteCommentBtn.dataset.postId;
      if (!confirm('Удалить комментарий?')) return;
      try {
        await API.delete(`/posts/${postId}/comments/${commentId}`);
        const el = deleteCommentBtn.closest('.comment');
        if (el) el.remove();
      } catch (e) { toast(e.message, 'error'); }
    }
  });
}

// Skeleton loader — имитирует N постов
function renderSkeletons(count = 3) {
  return Array.from({ length: count }, (_, i) => `
    <div class="skeleton-card" style="animation-delay:${i * 0.07}s">
      <div class="skeleton-row">
        <div class="skeleton-circle" style="width:40px;height:40px"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px">
          <div class="skeleton-line" style="width:35%;animation-delay:${i*0.07+0.05}s"></div>
          <div class="skeleton-line" style="width:20%;height:11px;animation-delay:${i*0.07+0.1}s"></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        <div class="skeleton-line" style="width:100%;animation-delay:${i*0.07+0.05}s"></div>
        <div class="skeleton-line" style="width:85%;animation-delay:${i*0.07+0.1}s"></div>
        <div class="skeleton-line" style="width:60%;animation-delay:${i*0.07+0.15}s"></div>
      </div>
      <div class="skeleton-row" style="gap:8px;margin-bottom:0">
        <div class="skeleton-line" style="width:44px;height:28px;border-radius:99px;animation-delay:${i*0.07+0.1}s"></div>
        <div class="skeleton-line" style="width:44px;height:28px;border-radius:99px;animation-delay:${i*0.07+0.15}s"></div>
        <div class="skeleton-line" style="width:44px;height:28px;border-radius:99px;animation-delay:${i*0.07+0.2}s"></div>
      </div>
    </div>
  `).join('');
}

function renderChannelSkeletons(count = 4) {
  return Array.from({ length: count }, (_, i) => `
    <div class="skeleton-card" style="animation-delay:${i * 0.07}s;display:flex;align-items:center;gap:14px">
      <div class="skeleton-circle" style="width:44px;height:44px;animation-delay:${i*0.07}s"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <div class="skeleton-line" style="width:40%;animation-delay:${i*0.07+0.05}s"></div>
        <div class="skeleton-line" style="width:65%;height:11px;animation-delay:${i*0.07+0.1}s"></div>
        <div class="skeleton-line" style="width:25%;height:10px;animation-delay:${i*0.07+0.15}s"></div>
      </div>
      <div class="skeleton-line" style="width:88px;height:32px;border-radius:12px;animation-delay:${i*0.07+0.1}s"></div>
    </div>
  `).join('');
}
