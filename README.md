# Befalap Radar – dashboard repo

Statikus GitHub Pages frontend, közvetlen read-only Supabase REST lekérdezésekkel.

## Nézetek

### Screener
- ACWI IMI / S&P 500 / STOXX Europe 600 / BUX benchmarkváltó;
- 1Y / 3Y / 5Y rolling horizont;
- Beat Rate × Median Excess piac-térkép, AUM buborékmérettel;
- alapkezelő, kategória, deviza, minimum rolling ablak és szöveges szűrés;
- rendezés Beat Rate, Mean/Median Excess, aktuális excess, Longest Relative Underperformance, Max Passive Regret, Max Drawdown, duration, Sharpe, Sortino szerint.

### Alap-adatlap
- 1Y/3Y/5Y/10Y HUF hozam;
- benchmark-relative scorecard;
- fund vs benchmark HUF wealth chart;
- rolling fund-return és excess-return eloszlás;
- rolling excess idővonal;
- napi relatív drawdown / passive regret;
- klasszikus kockázati mutatók;
- 4 benchmark × 3 horizont összefoglaló mátrix;
- BAMOSZ törzsadatok.

## Deploy

GitHub repository secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (Supabase publishable/anon read-only key)

A `pages.yml` deploykor generálja a `config.js` fájlt. Service-role kulcs nem kerül a frontendbe.
