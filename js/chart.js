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
// Each trendline: { series, anchors: [{time,price},{time,price}], color }
let trendlines = [];
let pendingAnchors = [];
let drawing = false;
let drawColor = null; // '#3fb950' green or '#f85149' red
let actionLine = null, safetyLine = null, targetLine = null;

const COLOR_GREEN = '#3fb950';
const COLOR_RED = '#f85149';

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
function startDraw(color, label) {
  drawing = true;
  drawColor = color;
  pendingAnchors = [];
  status(`Drawing ${label}: click the FIRST anchor point on the chart.`);
}

$('drawGreenBtn').addEventListener('click', () => startDraw(COLOR_GREEN, 'green (support)'));
$('drawRedBtn').addEventListener('click', () => startDraw(COLOR_RED, 'red (resistance)'));

$('clearBtn').addEventListener('click', () => {
  trendlines.forEach(t => chart.removeSeries(t.series));
  trendlines = [];
  pendingAnchors = [];
  drawing = false;
  status('All trendlines cleared.');
});

$('undoBtn').addEventListener('click', () => {
  if (drawing && pendingAnchors.length > 0) {
    pendingAnchors = [];
    drawing = false;
    status('Cancelled in-progress drawing.');
    return;
  }
  const last = trendlines.pop();
  if (last) {
    chart.removeSeries(last.series);
    status(`Removed last ${last.color === COLOR_GREEN ? 'green' : 'red'} trendline. ${trendlines.length} remaining.`);
  } else {
    status('Nothing to undo.');
  }
});

chart.subscribeClick((param) => {
  if (!drawing) return;
  if (!param.time || !param.point) return;
  const price = candleSeries.coordinateToPrice(param.point.y);
  if (price == null) return;
  pendingAnchors.push({ time: param.time, price });
  if (pendingAnchors.length === 1) {
    status('Drawing: click the SECOND anchor point.');
  } else if (pendingAnchors.length === 2) {
    drawTrendline(pendingAnchors, drawColor);
    pendingAnchors = [];
    drawing = false;
  }
});

function drawTrendline(anchors, color) {
  const series = chart.addLineSeries({
    color, lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Solid,
    lastValueVisible: false, priceLineVisible: false,
  });
  const [p1, p2] = anchors;
  const fromTime = candles[0].time;
  const toTime = candles[candles.length - 1].time;
  const projected = projectTrendline(p1, p2, fromTime, toTime, 100);
  series.setData(projected);
  trendlines.push({ series, anchors: [...anchors], color });

  const lineAtLast = projected[projected.length - 1].value;
  const colorName = color === COLOR_GREEN ? 'Green' : 'Red';
  const greenCount = trendlines.filter(t => t.color === COLOR_GREEN).length;
  const redCount = trendlines.filter(t => t.color === COLOR_RED).length;
  status(`${colorName} trendline drawn at $${lineAtLast.toFixed(2)}. Total: ${greenCount} green, ${redCount} red.`);
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
    trendline: trendlines.length > 0 ? trendlines[trendlines.length - 1].anchors : null,
    trendlines: trendlines.map(t => ({ anchors: t.anchors, color: t.color })),
  };
  addSetup(setup);
  status(`Saved "${name}" to watchlist.`);
  setTimeout(() => { window.location.href = 'watchlist.html'; }, 600);
});

// ---- Init ----
loadData('platinum');
