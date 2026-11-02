// WebSocket client — real-time events

const WS = (() => {
  let socket = null;
  const handlers = {};

  function connect() {
    const { access } = API.getTokens();
    if (!access) return;

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}?token=${encodeURIComponent(access)}`;

    if (socket && socket.readyState < 2) socket.close();

    socket = new WebSocket(url);

    socket.onopen = () => console.log('[WS] connected');

    socket.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data);
        (handlers[event] || []).forEach(fn => fn(data));
      } catch {}
    };

    socket.onclose = () => {
      // Reconnect after 3s
      setTimeout(connect, 3000);
    };

    socket.onerror = () => socket.close();
  }

  function on(event, fn) {
    if (!handlers[event]) handlers[event] = [];
    handlers[event].push(fn);
  }

  function off(event, fn) {
    if (!handlers[event]) return;
    handlers[event] = handlers[event].filter(h => h !== fn);
  }

  return { connect, on, off };
})();
