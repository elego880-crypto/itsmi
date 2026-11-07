const AuthPage = (() => {
  const themeSVG = () => {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    return theme === 'dark'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  };

  function renderLogin() {
    document.getElementById('page-auth').innerHTML = `
      <button id="auth-theme-btn" style="position:fixed;top:16px;right:16px;background:var(--bg2);border:none;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2)">${themeSVG()}</button>
      <div style="display:flex;flex-direction:column;align-items:center">
      <div class="auth-card slide-up">
        <div class="auth-logo"><img src="/assets/logo.png" alt="ИТСМИ" id="auth-logo-img" style="height:auto;width:100%;max-width:220px;display:block;margin:0 auto" /></div>
        <div class="auth-title">Войти</div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Никнейм</label>
            <input type="text" id="login-username" placeholder="username" autocomplete="username" />
          </div>
          <div class="form-group">
            <label class="form-label">Пароль</label>
            <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password" />
          </div>
          <div class="form-error" id="login-error"></div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:8px" id="login-btn">Войти</button>
        </form>
        <div class="auth-switch">Нет аккаунта? <a href="#" id="go-register">Зарегистрироваться</a></div>
      </div>
      <div style="margin-top:16px;font-size:12px;color:var(--text3)">powered by @Melnik Egor</div>
      </div>
    `;

    document.getElementById('go-register').addEventListener('click', (e) => {
      e.preventDefault();
      renderRegister();
    });
    updateLogo();
    document.getElementById('auth-theme-btn').addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('itsmi_theme', newTheme);
      renderLogin();
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('login-btn');
      const errEl = document.getElementById('login-error');
      btn.disabled = true;
      btn.textContent = 'Вход...';
      errEl.classList.remove('show');
      try {
        const data = await API.post('/auth/login', {
          username: document.getElementById('login-username').value.trim(),
          password: document.getElementById('login-password').value
        });
        API.setTokens(data.access, data.refresh);
        API.setUser(data.user);
        window.location.reload();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Войти';
      }
    });
  }

  function renderRegister() {
    document.getElementById('page-auth').innerHTML = `
      <button id="auth-theme-btn" style="position:fixed;top:16px;right:16px;background:var(--bg2);border:none;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2)">${themeSVG()}</button>
      <div style="display:flex;flex-direction:column;align-items:center">
      <div class="auth-card slide-up">
        <div class="auth-logo"><img src="/assets/logo.png" alt="ИТСМИ" id="auth-logo-img" style="height:auto;width:100%;max-width:220px;display:block;margin:0 auto" /></div>
        <div class="auth-title">Регистрация</div>
        <form id="register-form">
          <div class="form-group">
            <label class="form-label">Никнейм (мин. 5 символов)</label>
            <input type="text" id="reg-username" placeholder="username" autocomplete="username" maxlength="32" />
          </div>
          <div class="form-group">
            <label class="form-label">Имя</label>
            <input type="text" id="reg-display" placeholder="Как тебя зовут" maxlength="50" />
          </div>
          <div class="form-group">
            <label class="form-label">Пароль (мин. 6 символов)</label>
            <input type="password" id="reg-password" placeholder="••••••••" autocomplete="new-password" />
          </div>
          <div class="form-error" id="reg-error"></div>
          <div style="display:flex;align-items:flex-start;gap:10px;margin:12px 0 4px">
            <input type="checkbox" id="reg-terms" style="width:16px;height:16px;margin-top:2px;flex-shrink:0;accent-color:var(--accent)" />
            <label for="reg-terms" style="font-size:13px;color:var(--text2);line-height:1.5;cursor:pointer">
              Я принимаю <a href="#" id="reg-terms-link" style="color:var(--accent)">Пользовательское соглашение</a> и <a href="#" id="reg-privacy-link" style="color:var(--accent)">Политику конфиденциальности</a>
            </label>
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:8px" id="reg-btn" disabled>Создать аккаунт</button>
        </form>
        <div class="auth-switch">Уже есть аккаунт? <a href="#" id="go-login">Войти</a></div>
      </div>
      <div style="margin-top:16px;font-size:12px;color:var(--text3)">powered by @Melnik Egor</div>
      </div>
    `;

    document.getElementById('go-login').addEventListener('click', (e) => {
      e.preventDefault();
      renderLogin();
    });
    updateLogo();
    document.getElementById('auth-theme-btn').addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('itsmi_theme', newTheme);
      renderRegister();
    });

    document.getElementById('reg-terms-link').addEventListener('click', (e) => {
      e.preventDefault();
      SettingsPage.showLegal('terms');
    });
    document.getElementById('reg-privacy-link').addEventListener('click', (e) => {
      e.preventDefault();
      SettingsPage.showLegal('privacy');
    });

    document.getElementById('reg-terms').addEventListener('change', (e) => {
      document.getElementById('reg-btn').disabled = !e.target.checked;
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('reg-btn');
      const errEl = document.getElementById('reg-error');

      if (!document.getElementById('reg-terms').checked) {
        errEl.textContent = 'Прими пользовательское соглашение';
        errEl.classList.add('show');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Создаём...';
      errEl.classList.remove('show');
      try {
        const data = await API.post('/auth/register', {
          username: document.getElementById('reg-username').value.trim(),
          displayName: document.getElementById('reg-display').value.trim(),
          password: document.getElementById('reg-password').value
        });
        API.setTokens(data.access, data.refresh);
        API.setUser(data.user);
        window.location.reload();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Создать аккаунт';
      }
    });
  }

  function updateLogo() {
    const img = document.getElementById('auth-logo-img');
    if (!img) return;
    const theme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('itsmi_theme') || 'dark';
    img.src = theme === 'light' ? '/assets/logo_light.png' : '/assets/logo.png';
  }

  return { renderLogin, renderRegister, updateLogo };
})();
