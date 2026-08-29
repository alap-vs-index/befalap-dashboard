# Befalap Radar – dashboard v2

Statikus GitHub Pages frontend a Befalap Supabase production adatmodellhez.

## Production adatmodell

A frontend kizárólag a jelenlegi compact táblákat/view-kat használja:

- `v_screener_base`
- `benchmarks`
- `relative_summary`
- `relative_path_summary`
- `fund_metrics`
- `fund_screen_status`
- `fund_rolling_series`
- `relative_rolling_series`
- `fund_daily`
- `benchmark_daily`
- `fx_daily`

Nincs hivatkozás a régi `fund_rolling_returns`, `relative_rolling` vagy `wealth_index_huf` mezőkre.

## GitHub Actions beállítás

Repository variable:
- `SUPABASE_URL`

Repository secret:
- `SUPABASE_PUBLISHABLE_KEY` (ajánlott; legacy fallbackként a workflow még elfogadja a `SUPABASE_ANON_KEY` nevet is)

A `pages.yml` deploykor készíti el a böngészőben szükséges `config.js` fájlt. Service-role kulcsot soha ne használj a dashboardban.

## Frissítési logika

- raw/current adatok: napi incremental data pipeline;
- rolling/path analytics: havi reconciliation;
- a dashboard a Supabase read-only REST API-ját használja, ezért külön dashboard build nem kell minden adatfrissítés után.
