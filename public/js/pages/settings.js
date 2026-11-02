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
    const date = '1 ноября 2026 г.';
    const contact = '@Egor в ИТСМИ';

    const content = {
      terms: `
        <h2>Пользовательское соглашение ИТСМИ</h2>
        <p>Редакция от ${date}. Настоящее Соглашение регулирует отношения между платформой ИТСМИ (далее — «Платформа», «Мы») и пользователем (далее — «Вы», «Пользователь»).</p>

        <h2>1. Принятие условий</h2>
        <p>Регистрируясь на Платформе или используя её, вы подтверждаете, что прочитали, поняли и согласились с настоящим Соглашением в полном объёме. Если вы не согласны с какими-либо условиями, вы не вправе использовать Платформу.</p>

        <h2>2. Возрастные ограничения</h2>
        <p>Платформа предназначена для лиц, достигших 13 лет. Регистрируясь, вы подтверждаете соответствие данному требованию. Мы вправе заблокировать аккаунт, если выявим нарушение возрастного ограничения.</p>

        <h2>3. Регистрация и аккаунт</h2>
        <p>Вы обязаны предоставить достоверные данные при регистрации. Вы несёте полную ответственность за сохранность своих учётных данных. Один пользователь вправе иметь только один основной аккаунт. Передача аккаунта третьим лицам запрещена.</p>

        <h2>4. Правила публикации контента</h2>
        <p>Публикуя контент на Платформе, вы соглашаетесь не размещать материалы, которые:</p>
        <p>— нарушают законодательство Российской Федерации или международное право;<br>
        — содержат угрозы, оскорбления, разжигание ненависти по любым признакам;<br>
        — являются спамом, мошенничеством или вводят в заблуждение;<br>
        — нарушают авторские права и права интеллектуальной собственности третьих лиц;<br>
        — содержат личные данные других лиц без их согласия;<br>
        — носят непристойный или порнографический характер;<br>
        — пропагандируют насилие, терроризм или экстремизм.</p>

        <h2>5. Права на контент</h2>
        <p>Вы сохраняете все права на публикуемый вами контент. Размещая материалы на Платформе, вы предоставляете нам неисключительную, безвозмездную лицензию на их хранение и отображение в рамках работы Платформы. Мы не претендуем на право собственности на ваш контент.</p>

        <h2>6. Модерация и блокировки</h2>
        <p>Администрация вправе без предварительного уведомления удалять контент, нарушающий настоящее Соглашение, и блокировать аккаунты нарушителей. Решение о блокировке может быть оспорено через обращение к администратору.</p>

        <h2>7. Ограничение ответственности</h2>
        <p>Платформа предоставляется «как есть» (as is). Мы не гарантируем бесперебойную работу сервиса и не несём ответственности за убытки, возникшие вследствие использования или невозможности использования Платформы. Мы не несём ответственности за контент, размещённый пользователями.</p>

        <h2>8. Изменение условий</h2>
        <p>Мы вправе изменять настоящее Соглашение в любое время. Продолжение использования Платформы после публикации изменений означает ваше согласие с новой редакцией.</p>

        <h2>9. Контакт</h2>
        <p>По вопросам, связанным с настоящим Соглашением: ${contact}.</p>
      `,

      privacy: `
        <h2>Политика конфиденциальности ИТСМИ</h2>
        <p>Редакция от ${date}. Настоящая Политика описывает, какие данные мы собираем, как используем и защищаем их.</p>

        <h2>1. Оператор данных</h2>
        <p>Оператором персональных данных является платформа ИТСМИ. Контакт: ${contact}.</p>

        <h2>2. Какие данные мы собираем</h2>
        <p>При регистрации: никнейм, отображаемое имя, пароль (хранится в зашифрованном виде с использованием bcrypt).</p>
        <p>В процессе использования: публикуемые посты, комментарии, загружаемые изображения, информация о подписках и лайках, дата и время последней активности.</p>
        <p>Технические данные: IP-адрес (для защиты от злоупотреблений и rate limiting), тип устройства и браузера (не сохраняется постоянно).</p>

        <h2>3. Цели обработки данных</h2>
        <p>Данные используются исключительно для обеспечения работы Платформы: авторизации, отображения контента, модерации и защиты от злоупотреблений. Мы не используем данные в рекламных целях и не передаём их третьим лицам.</p>

        <h2>4. Хранение данных</h2>
        <p>Данные хранятся на защищённых серверах с использованием PostgreSQL. Соединение защищено SSL/TLS. Пароли хранятся исключительно в виде bcrypt-хешей — мы физически не можем узнать ваш пароль.</p>

        <h2>5. Ваши права</h2>
        <p>Вы вправе в любое время запросить удаление своего аккаунта и всех связанных данных, а также получить информацию о хранимых данных. Для этого обратитесь к администратору: ${contact}.</p>

        <h2>6. Безопасность</h2>
        <p>Мы применяем технические меры защиты: шифрование паролей, JWT-токены с ограниченным временем жизни, HTTPS, rate limiting. Тем не менее, мы не можем гарантировать абсолютную защиту данных от действий третьих сторон.</p>

        <h2>7. Несовершеннолетние</h2>
        <p>Платформа не предназначена для детей до 13 лет. Мы не собираем намеренно данные лиц младше этого возраста.</p>

        <h2>8. Изменения политики</h2>
        <p>О существенных изменениях мы сообщим в ленте новостей Платформы. Дата последнего обновления всегда указана в заголовке документа.</p>
      `,

      cookies: `
        <h2>Политика использования cookies и локального хранилища</h2>
        <p>Редакция от ${date}.</p>

        <h2>1. Что такое cookies и localStorage</h2>
        <p>Cookies — небольшие текстовые файлы, сохраняемые браузером. localStorage — хранилище данных в браузере пользователя. ИТСМИ использует исключительно localStorage, cookies в традиционном смысле не применяются.</p>

        <h2>2. Что мы храним</h2>
        <p>В localStorage сохраняются только два типа данных:</p>
        <p>— <strong>JWT-токены авторизации</strong> (access token и refresh token) — необходимы для поддержания сессии без повторного ввода пароля;<br>
        — <strong>Тема оформления</strong> (светлая/тёмная) — для сохранения вашего выбора интерфейса.</p>

        <h2>3. Чего мы не используем</h2>
        <p>Мы не используем рекламные трекеры, аналитику третьих сторон (Google Analytics и аналоги), межсайтовые идентификаторы, поведенческий профайлинг.</p>

        <h2>4. Управление данными</h2>
        <p>Вы можете в любой момент очистить localStorage через настройки браузера. Это равнозначно выходу из аккаунта — при следующем входе потребуется повторная авторизация. Кнопка «Выйти» в приложении также полностью очищает сохранённые токены.</p>

        <h2>5. Сторонние ресурсы</h2>
        <p>Для загрузки шрифта Inter используется Google Fonts. При загрузке страницы браузер обращается к серверам Google — это стандартное поведение, характерное для большинства сайтов. Google может фиксировать IP-адрес запроса согласно своей политике конфиденциальности.</p>

        <h2>6. Контакт</h2>
        <p>Вопросы по данной политике: ${contact}.</p>
      `
    };

    openModal(`<div class="legal-content">${content[type] || ''}</div>`);
  }

  return { render, showLegal };
})();
