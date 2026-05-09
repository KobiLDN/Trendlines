"""
Check current price against levels in alerts.json and send Telegram alerts
for setups that just changed status. State persists in .alert_state.json
in the repo so we don't spam on every run.

Required env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
"""
import json
import os
import sys
from pathlib import Path
from urllib import request, parse

import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
ALERTS_FILE = ROOT / "alerts.json"
STATE_FILE = ROOT / ".alert_state.json"

TICKER_MAP = {"platinum": "PL=F"}


def latest_price(ticker: str) -> float:
    df = yf.download(ticker, period="5d", interval="1d", progress=False, auto_adjust=False)
    if df.empty:
        raise RuntimeError(f"No data for {ticker}")
    if hasattr(df.columns, "nlevels") and df.columns.nlevels > 1:
        df.columns = df.columns.get_level_values(0)
    return float(df["Close"].iloc[-1])


def evaluate(setup: dict, price: float) -> str:
    direction = setup["direction"]
    action = setup["action"]
    safety = setup["safety"]
    if direction == "long":
        if price <= safety:
            return "stopped"
        if price >= action:
            return "triggered"
    else:
        if price >= safety:
            return "stopped"
        if price <= action:
            return "triggered"
    return "armed"


def telegram_send(text: str):
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print("Telegram env vars missing; skipping send.", file=sys.stderr)
        print("Would have sent:\n" + text)
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
    }).encode()
    req = request.Request(url, data=data)
    with request.urlopen(req, timeout=10) as r:
        r.read()


def main():
    if not ALERTS_FILE.exists():
        print("No alerts.json; nothing to do.")
        return
    alerts = json.loads(ALERTS_FILE.read_text())
    setups = alerts.get("setups", [])
    if not setups:
        print("alerts.json has no setups.")
        return

    state = {}
    if STATE_FILE.exists():
        try:
            state = json.loads(STATE_FILE.read_text())
        except Exception:
            state = {}

    # Cache prices per symbol
    price_cache: dict[str, float] = {}
    changed_state = False

    for s in setups:
        sym = s.get("symbol", "platinum")
        if sym not in price_cache:
            ticker = TICKER_MAP.get(sym, sym)
            try:
                price_cache[sym] = latest_price(ticker)
            except Exception as e:
                print(f"price fetch failed for {sym}: {e}", file=sys.stderr)
                continue
        price = price_cache[sym]
        new_status = evaluate(s, price)
        prev = state.get(s["id"], "armed")
        notify_on = s.get("notify_on", ["triggered", "stopped"])
        if new_status != prev and new_status in notify_on:
            arrow = "📈" if new_status == "triggered" else "🛑"
            text = (
                f"{arrow} *{s['name']}* — {new_status.upper()}\n"
                f"Symbol: {sym} ({s['direction']})\n"
                f"Price: ${price:.2f}\n"
                f"Action: ${s['action']:.2f} · Safety: ${s['safety']:.2f}"
            )
            print(f"Alert: {s['name']} {prev} -> {new_status} @ ${price:.2f}")
            telegram_send(text)
        if new_status != prev:
            state[s["id"]] = new_status
            changed_state = True

    if changed_state:
        STATE_FILE.write_text(json.dumps(state, indent=2))
        print("State updated.")
    else:
        print("No status changes.")


if __name__ == "__main__":
    main()
