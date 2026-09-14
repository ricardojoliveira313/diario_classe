(() => {
  const SOURCE_APP = 'diario-censo';
  const SOURCE_EXT = 'censo-extension';

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data || {};

    if (data.source === SOURCE_APP && data.type === 'ping') {
      window.postMessage({ source: SOURCE_EXT, type: 'ready' }, '*');
      return;
    }

    if (data.source !== SOURCE_APP || data.type !== 'prepare' || !data.payload) return;

    chrome.storage.local.set({
      censoAutofillPayload: data.payload,
      censoAutofillPreparedAt: Date.now(),
    }, () => {
      window.postMessage({ source: SOURCE_EXT, type: 'prepared' }, '*');
    });
  });

  window.postMessage({ source: SOURCE_EXT, type: 'ready' }, '*');
})();
