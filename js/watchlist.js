import { loadSetups, deleteSetup, updateSetup } from './storage.js';

const $ = (id) => document.getElementById(id);

let lastPrice = null;
let lastTime = null;

async function loadLatest() {
  try {
    const res = await fetch(`data/platinum.json?t=${Date.now()}`);
    const data = await res.json();
    const last = data.candles[data.candles.length - 1];
    lastPrice = last.close;
    lastTime = last.time;
    const d = new Date(last.time * 1000).toISOString().slice(0, 10);
    $('lastPrice').textContent = `Platinum last close: $${lastPrice.toFixed(2)} (${d})`;
  } catch (e) {
    $('lastPrice').textContent = 'Could not load latest price.';
  }
}

function evalStatus(setup, price) {
  if (price == null) return setup.status || 'armed';
  const { direction, action, safety } = setup;
  if (direction === 'long') {
    if (price <= safety) return 'stopped';
    if (price >= action) return 'triggered';
  } else {
    if (price >= safety) return 'stopped';
    if (price <= action) return 'triggered';
  }
  return 'armed';
}

function render() {
  const list = $('setupList');
  const setups = loadSetups();
  if (setups.length === 0) {
    list.innerHTML = `<div class="empty">No setups yet. Go to the <a href="chart.html">Chart page</a> to draw a trendline and save your first setup.</div>`;
    return;
  }
  list.innerHTML = '';
  for (const s of setups) {
    const status = evalStatus(s, lastPrice);
    if (status !== s.status) updateSetup(s.id, { status });
    const card = document.createElement('div');
    card.className = 'setup-card';
    card.innerHTML = `
      <div class="head">
        <h3>${escapeHtml(s.name)} <span style="color:var(--muted);font-weight:400;font-size:0.85rem">· ${s.symbol} · ${s.direction}</span></h3>
        <span class="badge ${status}">${status}</span>
      </div>
      <div class="levels">
        <div class="lvl"><span class="k">Action</span><span class="v">$${s.action.toFixed(2)}</span></div>
        <div class="lvl"><span class="k">Safety</span><span class="v">$${s.safety.toFixed(2)}</span></div>
        <div class="lvl"><span class="k">Target</span><span class="v">${s.target != null ? '$' + s.target.toFixed(2) : '—'}</span></div>
        <div class="lvl"><span class="k">Last price</span><span class="v">${lastPrice != null ? '$' + lastPrice.toFixed(2) : '—'}</span></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn small danger" data-del="${s.id}">Delete</button>
      </div>
    `;
    list.appendChild(card);
  }
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this setup?')) { deleteSetup(btn.dataset.del); render(); }
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

$('exportBtn').addEventListener('click', () => {
  const setups = loadSetups();
  const exported = {
    setups: setups.map(s => ({
      id: s.id, name: s.name, symbol: s.symbol, direction: s.direction,
      action: s.action, safety: s.safety, target: s.target,
      notify_on: ['triggered', 'stopped'],
    })),
  };
  $('exportText').value = JSON.stringify(exported, null, 2);
  $('exportDialog').showModal();
});
$('closeDialog').addEventListener('click', () => $('exportDialog').close());
$('copyBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('exportText').value);
  $('copyBtn').textContent = 'Copied!';
  setTimeout(() => $('copyBtn').textContent = 'Copy', 1500);
});

(async () => {
  await loadLatest();
  render();
})();
