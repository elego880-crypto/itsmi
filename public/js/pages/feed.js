const FeedPage = (() => {
  let page = 1;
  let loading = false;
  let hasMore = true;
  let currentUser = null;

  function composeHTML(user) {
    return `
      <div class="compose-card">
        <div class="compose-inner">
          ${avatarHTML(user)}
          <div class="compose-fields">
            <textarea id="compose-text" placeholder="Что происходит?" maxlength="2000"></textarea>
            <div id="compose-preview" class="hidden"></div>
            <div class="compose-footer">
              <div class="compose-toolbar">
                <label class="compose-img-btn" title="Прикрепить фото">
                  <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <input type="file" id="compose-file" accept="image/*" style="display:none" />
                </label>
              </div>
              <div style="display:flex;align-items:center;gap:12px">
                <span class="compose-char-count" id="compose-chars">0/2000</span>
                <button class="btn btn-primary btn-sm" id="compose-submit">Опубликовать</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function render(user) {
    currentUser = user;
    page = 1; hasMore = true;
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page-inner">
        <div class="page-header"><div class="page-title">Лента</div></div>
        ${composeHTML(user)}
        <div id="feed-posts">${renderSkeletons(3)}</div>
        <div class="load-more hidden"><button class="btn btn-ghost" id="feed-load-more">Загрузить ещё</button></div>
        <div id="feed-load-spinner" class="hidden"><div class="spinner"></div></div>
      </div>
    `;

    bindCompose(user);
    await loadPosts(false);
    bindPostActions(document.getElementById('feed-posts'), user);
    bindLoadMore();
    bindWS();
  }

  function bindCompose(user) {
    const textarea = document.getElementById('compose-text');
    const charsEl = document.getElementById('compose-chars');
    const fileInput = document.getElementById('compose-file');
    const preview = document.getElementById('compose-preview');
    const submitBtn = document.getElementById('compose-submit');
    let selectedFile = null;

    function updateSubmit() {
      const hasText = textarea.value.trim().length > 0;
      submitBtn.disabled = !hasText && !selectedFile;
    }

    textarea.addEventListener('input', () => {
      charsEl.textContent = `${textarea.value.length}/2000`;
      updateSubmit();
      // auto-grow
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      selectedFile = file;
      const url = URL.createObjectURL(file);
      preview.innerHTML = `
        <div class="compose-preview">
          <img src="${url}" alt="" />
          <button class="compose-preview-remove" id="preview-remove">&times;</button>
        </div>
      `;
      preview.classList.remove('hidden');
      updateSubmit();
      document.getElementById('preview-remove').addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        preview.innerHTML = '';
        preview.classList.add('hidden');
        updateSubmit();
      });
    });

    submitBtn.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text && !selectedFile) return;
      submitBtn.disabled = true;
      submitBtn.textContent = '...';
      try {
        let post;
        if (selectedFile) {
          const fd = new FormData();
          fd.append('text', text);
          fd.append('media', selectedFile);
          post = await API.upload('/posts', fd);
        } else {
          post = await API.post('/posts', { text });
        }
        textarea.value = '';
        textarea.style.height = '';
        charsEl.textContent = '0/2000';
        selectedFile = null;
        fileInput.value = '';
        preview.innerHTML = '';
        preview.classList.add('hidden');
        prependPost(post);
      } catch (e) { toast(e.message, 'error'); }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Опубликовать';
      updateSubmit();
    });

    // Initial state — disabled
    updateSubmit();
  }

  async function loadPosts(append = true) {
    if (loading || !hasMore) return;
    loading = true;
    const spinner = document.getElementById('feed-load-spinner');
    if (spinner) spinner.classList.remove('hidden');
    try {
      const posts = await API.get(`/posts?page=${page}`);
      const container = document.getElementById('feed-posts');
      if (!container) return;

      const loadMoreBtn = document.getElementById('feed-load-more');

      if (posts.length === 0) {
        hasMore = false;
        if (loadMoreBtn) loadMoreBtn.closest('.load-more').classList.add('hidden');
        if (!append) container.innerHTML = '<div class="empty-state">Пока нет постов</div>';
        return;
      }

      if (append) {
        container.insertAdjacentHTML('beforeend', posts.map(p => renderPost(p, currentUser)).join(''));
      } else {
        // Replace skeletons with real posts
        container.innerHTML = posts.map(p => renderPost(p, currentUser)).join('');
      }

      // Show load more button after first load
      const lm = document.querySelector('.load-more');
      if (lm) lm.classList.remove('hidden');

      page++;
    } catch (e) {
      const container = document.getElementById('feed-posts');
      if (container) container.innerHTML = '<div class="empty-state">Не удалось загрузить ленту</div>';
      toast('Не удалось загрузить ленту', 'error');
    } finally {
      loading = false;
      if (spinner) spinner.classList.add('hidden');
    }
  }

  function prependPost(post) {
    const container = document.getElementById('feed-posts');
    if (!container) return;
    container.insertAdjacentHTML('afterbegin', renderPost(post, currentUser));
  }

  function bindLoadMore() {
    const btn = document.getElementById('feed-load-more');
    if (btn) btn.addEventListener('click', () => loadPosts(true));
  }

  function bindWS() {
    WS.on('new_post', (post) => {
      if (!document.getElementById('feed-posts')) return;
      if (currentUser && post.author && post.author.id === currentUser.id) return; // already added
      prependPost(post);
    });

    WS.on('delete_post', ({ id }) => {
      const el = document.querySelector(`[data-post-id="${id}"]`);
      if (el) el.remove();
    });

    WS.on('like_post', ({ postId, count }) => {
      const btn = document.querySelector(`[data-post-id="${postId}"] [data-like-post]`);
      if (btn) btn.querySelector('span').textContent = count;
    });
  }

  return { render };
})();
