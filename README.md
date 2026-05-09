# Trendlines

**Live site: [https://kobildn.github.io/Trendlines/](https://kobildn.github.io/Trendlines/)**

A beginner-friendly swing-trading helper for **platinum** (and any Yahoo ticker), built as a static site that runs on GitHub Pages.

- **Learn page** — plain-English explainers for trendline, action line, safety line, entry, R:R
- **Chart page** — TradingView Lightweight Charts. Draw multiple **green** support trendlines (swing lows) and multiple **red** resistance trendlines (swing highs); auto-computes today's trendline price; visual action / safety / target lines; live R:R and position-size calculator
- **Watchlist** — saved setups (in browser localStorage) with live status (armed / triggered / stopped)
- **Telegram alerts** — a GitHub Action runs every 30 minutes during market hours, checks your saved levels against the latest price, and pings you on Telegram

Current version is shown as a badge at the top-right of every page (currently **v1.2**). See `FEATURES.txt` for the changelog.

## How it works

```
┌──────────────┐  daily 22:30 UTC   ┌────────────────────┐
│ Action: data │ ─────────────────► │ data/platinum.json │ ◄── frontend reads
└──────────────┘                    └────────────────────┘

┌──────────────┐  every 30 min      ┌──────────────┐
│ Action: alert│ ─── checks ───────►│ Telegram bot │
└──────────────┘    alerts.json     └──────────────┘
```

The site itself is static — no backend needed. GitHub Actions handle the two background jobs.

## Local preview

Just open `index.html` in a browser. The chart page reads `data/platinum.json` which is committed to the repo, so it works offline.

If you serve via `python -m http.server` (recommended because ES modules need HTTP, not file://):

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Deploy on GitHub Pages

1. Push to `main` (or whatever your default branch is)
2. Repo Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder: `/ (root)` → Save
3. Wait ~1 min, your site is live at `https://kobildn.github.io/Trendlines/`

## Alerts setup (Telegram)

<a id="alerts"></a>

### One-time: create a Telegram bot

1. Open Telegram, message `@BotFather`, send `/newbot`, follow the prompts. Save the **bot token** it gives you.
2. Message your new bot once (say "hi") so it can DM you.
3. Get your chat ID: visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser, find `"chat":{"id":12345...}` in the response.

### Add secrets to the repo

Repo Settings → Secrets and variables → Actions → New repository secret:

- `TELEGRAM_BOT_TOKEN` = the token from BotFather
- `TELEGRAM_CHAT_ID` = your chat ID

### Activate the Check Alerts action

Repo Settings → Actions → General → Workflow permissions → check **Read and write permissions** → Save.

The action runs automatically every 30 min on weekdays. You can also trigger it manually: Actions tab → Check alerts → Run workflow.

### Add setups

1. On the Watchlist page, click **Export for alerts** and copy the JSON.
2. Edit `alerts.json` in the repo (GitHub web UI is easiest), paste, commit.
3. Next run of the action will start watching those levels.

State is tracked in `.alert_state.json` so you only get pinged once per status change.

## Adding more symbols

Edit `scripts/fetch_data.py`:

```python
SYMBOLS = {
    "platinum": "PL=F",
    "gold":     "GC=F",
    "silver":   "SI=F",
}
```

And add `<option value="gold">Gold (GC=F)</option>` etc. to the `symbolSelect` in `chart.html`. The watchlist + alerts already key off the symbol field so they handle multiple instruments without changes.

## Files

```
index.html            Learn page
chart.html            Drawing + analysis
watchlist.html        Saved setups
css/style.css         Shared styles
js/chart.js           Chart logic, trendline drawing, R:R
js/watchlist.js       Watchlist render + export
js/storage.js         localStorage wrapper
js/indicators.js      Swings, ATR, trendline math, R:R, sizing
data/platinum.json    Auto-updated daily by GitHub Action
alerts.json           Setups the alert action watches (you commit this)
.alert_state.json     Action's record of last-seen status (auto)
scripts/fetch_data.py Daily price fetcher (yfinance)
scripts/check_alerts.py  Alert checker + Telegram sender
.github/workflows/    The two scheduled actions
```

## Disclaimer

Educational tool. Not financial advice. Trade with money you can afford to lose.
