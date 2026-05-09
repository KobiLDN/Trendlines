// Bump this on every meaningful commit. See FEATURES.txt for convention.
export const VERSION = 'v1.1';

// Auto-inject a small version footer on any page that imports this module.
function injectFooter() {
  if (document.getElementById('versionFooter')) return;
  const el = document.createElement('div');
  el.id = 'versionFooter';
  el.className = 'version-footer';
  el.innerHTML = `<a href="https://github.com/KobiLDN/Trendlines" target="_blank" rel="noopener">Trendlines ${VERSION}</a> · <a href="https://github.com/KobiLDN/Trendlines/blob/main/FEATURES.txt" target="_blank" rel="noopener">features</a>`;
  document.body.appendChild(el);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectFooter);
} else {
  injectFooter();
}
