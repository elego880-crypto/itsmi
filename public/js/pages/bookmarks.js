const BookmarksPage = (() => {
  async function render(user) {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page-inner">
        <h2 class="page-title">Закладки</h2>
        <div id="bookmarks-list">${renderSkeletons(3)}</div>
      </div>
    `;

    const list = document.getElementById('bookmarks-list');
    bindPostActions(list, user);

    try {
      const posts = await API.get('/bookmarks');
      if (!posts.length) {
        list.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><p>Нет сохранённых постов</p></div>`;
        return;
      }
      list.innerHTML = posts.map(p => renderPost(p, user)).join('');
    } catch(e) {
      list.innerHTML = `<div class="empty-state"><p>Ошибка загрузки</p></div>`;
    }
  }

  return { render };
})();
