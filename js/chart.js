import { addSetup } from './storage.js';
import { projectTrendline, computeRiskReward, positionSize, atr } from './indicators.js';

const $ = (id) => document.getElementById(id);
const status = (msg) => { $('status').textContent = msg; };

// ---- Chart setup ----
const chart = LightweightCharts.createChart($('chart'), {
  layout: { background: { color: '#161b22' }, textColor: '#e6edf3' },
  grid: {
    vertLines: { color: '#2a313c' },
    horzLines: { color: '#2a313c' },
  },
  rightPriceScale: { borderColor: '#2a313c' },
  timeScale: { borderColor: '#2a313c', timeVisible: false },
  crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
});

const candleSeries = chart.addCandlestickSeries({
  upColor: '#3fb950', downColor: '#f85149',
  borderUpColor: '#3fb950', borderDownColor: '#f85149',
  wickUpColor: '#3fb950', wickDownColor: '#f85149',
});

let candles = [];
let trendSeries = null;
let trendAnchors = []; // [{time, price}, {time, price}]
let drawing = false;
let actionLine = null, safetyLine = null, targetLine = null;

// ---- Load data ----
async function loadData(symbol = 'platinum') {
  status('Loading data...');
  try {
    const res = await fetch(`data/${symbol}.json?t=${Date.now()}`);
    if (!res.ok) throw new Error('No data file. Run the GitHub Action or fetch script first.');
    const data = await res.json();
    candles = data.candles.map(c => ({
      time: c.time,
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    candleSeries.setData(candles);
    chart.timeScale().fitContent();
    const last = candles[candles.length - 1];
    const a = atr(candles, 14);
    status(`Loaded ${candles.length} bars · last close $${last.close.toFixed(2)} · ATR(14) ${a ? '$' + a.toFixed(2) : 'n/a'}`);
  } catch (e) {
    status('Failed to load data: ' + e.message);
    console.error(e);
  }
}

// ---- Trendline drawing ----
$('drawBtn').addEventListener('click', () => {
  drawing = true;
  trendAnchors = [];
  status('Drawing: click the FIRST anchor point on the chart.');
});

$('clearBtn').addEventListener('click', () => {
  if (trendSeries) { chart.removeSeries(trendSeries); trendSeries = null; }
  trendAnchors = [];
  drawing = false;
  status('Drawing cleared.');
});

chart.subscribeClick((param) => {
  if (!drawing) return;
  if (!param.time || !param.point) return;
  // Convert pixel y to price
  const price = candleSeries.coordinateToPrice(param.point.y);
  if (price == null) return;
  trendAnchors.push({ time: param.time, price });
  if (trendAnchors.length === 1) {
    status('Drawing: click the SECOND anchor point.');
  } else if (trendAnchors.length === 2) {
    drawTrendline();
    drawing = false;
  }
});

function drawTrendline() {
  if (trendSeries) chart.removeSeries(trendSeries);
  trendSeries = chart.addLineSeries({
    color: '#d29922', lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Solid,
    lastValueVisible: false, priceLineVisible: false,
  });
  const [p1, p2] = trendAnchors;
  const fromTime = candles[0].time;
  const toTime = candles[candles.length - 1].time;
  const projected = projectTrendline(p1, p2, fromTime, toTime, 100);
  trendSeries.setData(projected);

  // Compute trendline price at last bar — useful suggested action level
  const lineAtLast = projected[projected.length - 1].value;
  status(`Trendline drawn. Today's trendline price: $${lineAtLast.toFixed(2)}. Suggest setting action line near here.`);
  if (!$('actionPrice').value) $('actionPrice').value = lineAtLast.toFixed(2);
  updateLevels();
  updateRR();
}

// ---- Price level lines ----
function setLine(existing, price, color, title) {
  if (existing) candleSeries.removePriceLine(existing);
  if (price == null || isNaN(price)) return null;
  return candleSeries.createPriceLine({
    price, color, lineWidth: 2,
    lineStyle: LightweightCharts.LineStyle.Dashed,
    axisLabelVisible: true, title,
  });
}

function updateLevels() {
  const a = parseFloat($('actionPrice').value);
  const s = parseFloat($('safetyPrice').value);
  const t = parseFloat($('targetPrice').value);
  actionLine = setLine(actionLine, a, '#58a6ff', 'Action');
  safetyLine = setLine(safetyLine, s, '#f85149', 'Safety');
  targetLine = setLine(targetLine, t, '#3fb950', 'Target');
}

// ---- R:R + position size ----
function updateRR() {
  const entry = parseFloat($('actionPrice').value);
  const safety = parseFloat($('safetyPrice').value);
  const target = parseFloat($('targetPrice').value);
  const account = parseFloat($('accountSize').value);
  const riskPct = parseFloat($('riskPct').value);

  const rr = computeRiskReward(entry, safety, target);
  const ratioEl = $('rrRatio');
  if (rr == null) {
    ratioEl.textContent = '—';
    ratioEl.className = 'ratio neutral';
  } else {
    ratioEl.textContent = `1 : ${rr.toFixed(2)}`;
    ratioEl.className = 'ratio ' + (rr >= 2 ? 'good' : rr >= 1 ? 'neutral' : 'bad');
  }

  const size = positionSize(account, riskPct, entry, safety);
  const info = $('positionInfo');
  if (size != null) {
    const riskDollars = account * (riskPct / 100);
    info.textContent = `Position: ${size.toFixed(2)} units · Risk $${riskDollars.toFixed(0)}`;
  } else {
    info.textContent = '';
  }
}

['actionPrice', 'safetyPrice', 'targetPrice', 'accountSize', 'riskPct'].forEach(id => {
  $(id).addEventListener('input', () => { updateLevels(); updateRR(); });
});
$('direction').addEventListener('change', updateRR);

// ---- Save ----
$('saveBtn').addEventListener('click', () => {
  const name = $('setupName').value.trim();
  const action = parseFloat($('actionPrice').value);
  const safety = parseFloat($('safetyPrice').value);
  const target = parseFloat($('targetPrice').value);
  if (!name) { alert('Give the setup a name.'); return; }
  if (isNaN(action) || isNaN(safety)) { alert('Action and Safety lines are required.'); return; }
  const setup = {
    name,
    symbol: $('symbolSelect').value,
    direction: $('direction').value,
    action, safety,
    target: isNaN(target) ? null : target,
    trendline: trendAnchors.length === 2 ? trendAnchors : null,
  };
  addSetup(setup);
  status(`Saved "${name}" to watchlist.`);
  setTimeout(() => { window.location.href = 'watchlist.html'; }, 600);
});

// ---- Init ----
loadData('platinum');
