"""
Fetch daily OHLC data for configured symbols and write to data/<symbol>.json.
Run by .github/workflows/update-data.yml on a daily schedule.
"""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

import yfinance as yf

SYMBOLS = {
    "platinum": "PL=F",
    # add more here later: "gold": "GC=F", "silver": "SI=F", etc.
}

LOOKBACK_DAYS = 365 * 2  # 2 years of daily bars


def fetch(symbol_key: str, ticker: str) -> dict:
    df = yf.download(ticker, period=f"{LOOKBACK_DAYS}d", interval="1d",
                     progress=False, auto_adjust=False)
    if df.empty:
        raise RuntimeError(f"No data returned for {ticker}")
    # yfinance sometimes returns multi-index columns; flatten if so
    if hasattr(df.columns, "nlevels") and df.columns.nlevels > 1:
        df.columns = df.columns.get_level_values(0)
    candles = []
    for ts, row in df.iterrows():
        # Lightweight Charts expects unix seconds for time on intraday,
        # or YYYY-MM-DD strings for daily. We use seconds for consistency.
        epoch = int(ts.replace(tzinfo=timezone.utc).timestamp())
        candles.append({
            "time": epoch,
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
        })
    return {
        "symbol": symbol_key,
        "ticker": ticker,
        "updated": datetime.now(timezone.utc).isoformat(),
        "candles": candles,
    }


def main():
    out_dir = Path(__file__).resolve().parent.parent / "data"
    out_dir.mkdir(exist_ok=True)
    for key, ticker in SYMBOLS.items():
        print(f"Fetching {key} ({ticker})...")
        try:
            data = fetch(key, ticker)
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)
            continue
        path = out_dir / f"{key}.json"
        path.write_text(json.dumps(data))
        print(f"  Wrote {len(data['candles'])} bars to {path}")


if __name__ == "__main__":
    main()
