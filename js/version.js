// Bump this on every meaningful commit. See FEATURES.txt for convention.
export const VERSION = 'v1.2';

// Inject a version badge into the top nav (visible at top of every page),
// plus a small footer link for completeness.
function injectBadges() {
  const nav = document.querySelector('nav.topnav');
  if (nav && !document.getElementById('versionBadge')) {
    const badge = document.createElement('a');
    badge.id = 'versionBadge';
    badge.className = 'version-badge';
    badge.href = 'https://github.com/KobiLDN/Trendlines/blob/main/FEATURES.txt';
    badge.target = '_blank';
    badge.rel = 'noopener';
    badge.textContent = VERSION;
    badge.title = 'View changelog / features';
    nav.appendChild(badge);
  }
  if (!document.getElementById('versionFooter')) {
    const el = document.createElement('div');
    el.id = 'versionFooter';
    el.className = 'version-footer';
    el.innerHTML = `<a href="https://github.com/KobiLDN/Trendlines" target="_blank" rel="noopener">Trendlines ${VERSION}</a> · <a href="https://github.com/KobiLDN/Trendlines/blob/main/FEATURES.txt" target="_blank" rel="noopener">features</a>`;
    document.body.appendChild(el);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectBadges);
} else {
  injectBadges();
}
