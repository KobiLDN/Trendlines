// Technical indicators: swing highs/lows, ATR, trendline math

export function findSwings(candles, lookback = 3) {
  const highs = [];
  const lows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true, isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) isLow = false;
    }
    if (isHigh) highs.push({ time: c.time, price: c.high, idx: i });
    if (isLow) lows.push({ time: c.time, price: c.low, idx: i });
  }
  return { highs, lows };
}

export function atr(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  const recent = trs.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / period;
}

// Given two trendline anchor points (time in seconds, price), return the price on
// that line at a given target time. Linear extrapolation in time.
export function trendlinePriceAt(p1, p2, targetTime) {
  if (p2.time === p1.time) return p1.price;
  const slope = (p2.price - p1.price) / (p2.time - p1.time);
  return p1.price + slope * (targetTime - p1.time);
}

// Project trendline points across the visible chart range
export function projectTrendline(p1, p2, fromTime, toTime, steps = 50) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = fromTime + ((toTime - fromTime) * i) / steps;
    pts.push({ time: t, value: trendlinePriceAt(p1, p2, t) });
  }
  return pts;
}

export function computeRiskReward(entry, safety, target) {
  if (entry == null || safety == null || target == null) return null;
  const risk = Math.abs(entry - safety);
  const reward = Math.abs(target - entry);
  if (risk === 0) return null;
  return reward / risk;
}

export function positionSize(accountSize, riskPct, entry, safety) {
  if (!accountSize || !riskPct || entry == null || safety == null) return null;
  const riskDollars = accountSize * (riskPct / 100);
  const perUnitRisk = Math.abs(entry - safety);
  if (perUnitRisk === 0) return null;
  return riskDollars / perUnitRisk;
}
