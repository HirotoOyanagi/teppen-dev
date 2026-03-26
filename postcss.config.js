module.exports = {
  // #region agent log
  pluginsLoaded: (() => {
    fetch('http://127.0.0.1:7243/ingest/cc79b691-8d01-4584-b34b-11aee04a0385', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4efb5e' },
      body: JSON.stringify({
        sessionId: '4efb5e',
        runId: 'pre-fix',
        hypothesisId: 'H_cfg',
        location: 'postcss.config.js:3',
        message: 'PostCSS config loaded',
        data: { plugins: ['tailwindcss', 'autoprefixer'] },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    return true
  })(),
  // #endregion agent log
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}





