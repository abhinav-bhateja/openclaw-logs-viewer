import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

window.onerror = function(msg, src, line, col, err) {
  var root = document.getElementById('root');
  if (root) root.innerHTML = '<div style="padding:24px;color:#f87171;background:#0f172a;min-height:100vh;font-family:monospace;font-size:14px"><h2>JS Error</h2><pre style="white-space:pre-wrap;word-break:break-word">' + String(msg) + '\n\nSource: ' + String(src) + ':' + line + ':' + col + '\n\n' + (err && err.stack ? err.stack : '') + '</pre><button onclick="location.reload()" style="margin-top:16px;padding:8px 16px;background:#3b82f6;color:white;border:none;border-radius:8px">Reload</button></div>';
};
window.onunhandledrejection = function(e) {
  var root = document.getElementById('root');
  var reason = e.reason || {};
  if (root) root.innerHTML = '<div style="padding:24px;color:#f87171;background:#0f172a;min-height:100vh;font-family:monospace;font-size:14px"><h2>Promise Error</h2><pre style="white-space:pre-wrap;word-break:break-word">' + String(reason.message || reason) + '\n\n' + (reason.stack || '') + '</pre><button onclick="location.reload()" style="margin-top:16px;padding:8px 16px;background:#3b82f6;color:white;border:none;border-radius:8px">Reload</button></div>';
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
