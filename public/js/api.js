// API client with auto JWT refresh

const API = (() => {
  const BASE = '/api';

  function getTokens() {
    return {
      access: localStorage.getItem('itsmi_access'),
      refresh: localStorage.getItem('itsmi_refresh')
    };
  }

  function setTokens(access, refresh) {
    if (access) localStorage.setItem('itsmi_access', access);
    if (refresh) localStorage.setItem('itsmi_refresh', refresh);
  }

  function clearTokens() {
    localStorage.removeItem('itsmi_access');
    localStorage.removeItem('itsmi_refresh');
    localStorage.removeItem('itsmi_user');
  }

  async function refreshTokens() {
    const { refresh } = getTokens();
    if (!refresh) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: refresh })
      });
      if (!res.ok) { clearTokens(); return false; }
      const data = await res.json();
      setTokens(data.access, data.refresh);
      return true;
    } catch {
      return false;
    }
  }

  async function request(method, path, body, isFormData = false) {
    const { access } = getTokens();
    const headers = {};
    if (access) headers['Authorization'] = 'Bearer ' + access;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    let res = await fetch(BASE + path, opts);

    // Auto-refresh on 401
    if (res.status === 401) {
      const ok = await refreshTokens();
      if (ok) {
        const { access: newAccess } = getTokens();
        headers['Authorization'] = 'Bearer ' + newAccess;
        opts.headers = headers;
        res = await fetch(BASE + path, opts);
      } else {
        clearTokens();
        window.location.reload();
        return;
      }
    }

    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
    return data;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
    upload: (path, formData) => request('POST', path, formData, true),
    patchUpload: (path, formData) => request('PATCH', path, formData, true),
    setTokens,
    clearTokens,
    getTokens,
    setUser(user) { localStorage.setItem('itsmi_user', JSON.stringify(user)); },
    getUser() {
      try { return JSON.parse(localStorage.getItem('itsmi_user')); } catch { return null; }
    }
  };
})();
