const AuthPage = (() => {
  function renderLogin() {
    document.getElementById('page-auth').innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center">
      <div class="auth-card slide-up">
        <div class="auth-logo"><img src="/assets/logo.png" alt="ИТСМИ" style="height:56px;width:auto" /></div>
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
      <div style="display:flex;flex-direction:column;align-items:center">
      <div class="auth-card slide-up">
        <div class="auth-logo"><img src="/assets/logo.png" alt="ИТСМИ" style="height:66px;width:auto" /></div>
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

  return { renderLogin, renderRegister };
})();
