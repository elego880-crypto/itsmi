const SettingsPage = (() => {
  function render(currentUser) {
    const main = document.getElementById('main-content');
    const theme = localStorage.getItem('itsmi_theme') || 'dark';

    main.innerHTML = `
      <div class="page-inner">
      <div class="page-header">
        <div class="page-title">Настройки</div>
      </div>

      <div class="settings-section fade-in">
        <div class="settings-title">Внешний вид</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Тёмная тема</div>
            <div class="settings-row-desc">Переключение между тёмным и светлым оформлением</div>
          </div>
          <div class="toggle ${theme === 'dark' ? 'on' : ''}" id="theme-toggle"></div>
        </div>
      </div>

      <div class="settings-section fade-in">
        <div class="settings-title">Аккаунт</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Аватар</div>
            <div class="settings-row-desc">Сменить фото профиля</div>
          </div>
          <label class="btn btn-ghost btn-sm" style="cursor:pointer">
            Загрузить
            <input type="file" id="settings-avatar-upload" accept="image/*" style="display:none" />
          </label>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Никнейм</div>
            <div class="settings-row-desc">@${currentUser.username}</div>
          </div>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Смена пароля</div>
            <div class="settings-row-desc">Обновить пароль от аккаунта</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="change-password-btn">Изменить</button>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Выйти из аккаунта</div>
            <div class="settings-row-desc">Завершить текущую сессию</div>
          </div>
          <button class="btn btn-danger btn-sm" id="logout-btn-settings">Выйти</button>
        </div>
      </div>

      <div class="settings-section fade-in">
        <div class="settings-title">О платформе</div>
        <div class="settings-row">
          <div class="settings-row-label">Политика конфиденциальности</div>
          <a href="#" data-legal="privacy" class="btn btn-ghost btn-sm">Читать</a>
        </div>
        <div class="settings-row">
          <div class="settings-row-label">Политика использования cookies</div>
          <a href="#" data-legal="cookies" class="btn btn-ghost btn-sm">Читать</a>
        </div>
        <div class="settings-row">
          <div class="settings-row-label">Пользовательское соглашение</div>
          <a href="#" data-legal="terms" class="btn btn-ghost btn-sm">Читать</a>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Версия</div>
            <div class="settings-row-desc">ИТСМИ 1.0.0</div>
          </div>
        </div>
      </div>
    </div>
    `;

    // Avatar upload
    const avatarUpload = document.getElementById('settings-avatar-upload');
    avatarUpload && avatarUpload.addEventListener('change', async () => {
      const file = avatarUpload.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('avatar', file);
      try {
        const updated = await API.patchUpload('/users/me', fd);
        API.setUser(updated);
        toast('Аватар обновлён', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });

    // Theme toggle
    const toggle = document.getElementById('theme-toggle');
    toggle.addEventListener('click', () => {
      const isDark = toggle.classList.contains('on');
      const newTheme = isDark ? 'light' : 'dark';
      toggle.classList.toggle('on', !isDark);
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('itsmi_theme', newTheme);
    });

    // Logout
    document.getElementById('logout-btn-settings').addEventListener('click', async () => {
      const { refresh } = API.getTokens();
      try { await API.post('/auth/logout', { token: refresh }); } catch {}
      API.clearTokens();
      location.reload();
    });

    // Change password
    document.getElementById('change-password-btn').addEventListener('click', () => {
      showChangePasswordModal();
    });

    // Legal links
    main.querySelectorAll('[data-legal]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        showLegal(link.dataset.legal);
      });
    });
  }

  function showChangePasswordModal() {
    openModal(`
      <div class="auth-title" style="margin-bottom:20px">Смена пароля</div>
      <div class="form-group">
        <label class="form-label">Текущий пароль</label>
        <input type="password" id="pwd-current" placeholder="••••••••" />
      </div>
      <div class="form-group">
        <label class="form-label">Новый пароль</label>
        <input type="password" id="pwd-new" placeholder="Минимум 6 символов" />
      </div>
      <div class="form-group">
        <label class="form-label">Повтор нового пароля</label>
        <input type="password" id="pwd-confirm" placeholder="••••••••" />
      </div>
      <div class="form-error" id="pwd-error"></div>
      <button class="btn btn-primary btn-full" id="pwd-save-btn" style="margin-top:8px">Сохранить</button>
    `);

    document.getElementById('pwd-save-btn').addEventListener('click', async () => {
      const current = document.getElementById('pwd-current').value;
      const newPwd = document.getElementById('pwd-new').value;
      const confirm = document.getElementById('pwd-confirm').value;
      const errEl = document.getElementById('pwd-error');
      errEl.classList.remove('show');

      if (newPwd.length < 6) {
        errEl.textContent = 'Новый пароль минимум 6 символов';
        errEl.classList.add('show'); return;
      }
      if (newPwd !== confirm) {
        errEl.textContent = 'Пароли не совпадают';
        errEl.classList.add('show'); return;
      }

      try {
        await API.post('/auth/change-password', { currentPassword: current, newPassword: newPwd });
        closeModal();
        toast('Пароль изменён', 'success');
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.add('show');
      }
    });
  }

  function showLegal(type) {
    const content = {
      privacy: `
        <h2>Политика конфиденциальности</h2>
        <p>ИТСМИ уважает вашу конфиденциальность и обязуется защищать ваши персональные данные.</p>
        <h2>Какие данные мы собираем</h2>
        <p>Мы собираем данные, которые вы предоставляете при регистрации: никнейм, имя, пароль (в зашифрованном виде). Также мы храним контент, который вы публикуете: посты, комментарии, изображения.</p>
        <h2>Как мы используем данные</h2>
        <p>Данные используются исключительно для работы платформы. Мы не передаём ваши данные третьим лицам.</p>
        <h2>Хранение данных</h2>
        <p>Данные хранятся на защищённых серверах. Вы можете запросить удаление своего аккаунта в любое время.</p>
        <h2>Контакт</h2>
        <p>По вопросам конфиденциальности: @Egor в ИТСМИ.</p>
      `,
      cookies: `
        <h2>Политика использования cookies</h2>
        <p>ИТСМИ использует минимальный набор данных в localStorage для поддержания сессии пользователя.</p>
        <h2>Что мы храним</h2>
        <p>JWT-токены для авторизации и тему оформления. Никаких рекламных трекеров или аналитики третьих сторон.</p>
        <h2>Управление</h2>
        <p>Вы можете очистить данные браузера в любое время — это равнозначно выходу из аккаунта.</p>
      `,
      terms: `
        <h2>Пользовательское соглашение</h2>
        <p>Используя ИТСМИ, вы соглашаетесь с настоящими условиями.</p>
        <h2>Правила использования</h2>
        <p>Запрещено публиковать незаконный контент, спам, контент, нарушающий права третьих лиц. Администрация вправе удалять контент и блокировать аккаунты, нарушающие правила.</p>
        <h2>Ответственность</h2>
        <p>Пользователь несёт ответственность за публикуемый им контент. ИТСМИ предоставляется "как есть".</p>
        <h2>Возраст</h2>
        <p>Платформа предназначена для пользователей от 13 лет.</p>
      `
    };

    openModal(`<div class="legal-content">${content[type] || ''}</div>`);
  }

  return { render, showLegal };
})();
