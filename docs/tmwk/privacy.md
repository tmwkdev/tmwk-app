# Privacy

tmwk sends a small amount of anonymous usage data to its own PostHog Cloud project (US
region). It never sends anything to Orca's PostHog, and Orca's own events, diagnostics upload
and feedback endpoint stay off. The reasoning is in [telemetry-plan.md](telemetry-plan.md).

## What tmwk sends

Four events. Counts are sent at most once per 24 hours.

| Event                          | Fields                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `tmwk_app_opened`              | `app_version`, `platform`, `arch`                                            |
| `tmwk_errors_counted`          | `kind` (`rollover`, `summary`, `main-session`, `ticket-refresh`), `count`    |
| `tmwk_ticket_outcomes_counted` | `completed`, `failed`, `lost`, `open` (tickets still running at report time) |
| `tmwk_rollovers_counted`       | `stored`, `fallback`, `stale`                                                |

Every event also carries `app_version`, `platform`, `arch`, a per-launch session id, and a
random install id used as the distinct id. The install id is not derived from you or your
machine.

## What tmwk never sends

Message text, file paths, hostnames, emails, repository or ticket names, prompts, or code. GeoIP
is off and no person profiles are created.

## Turning it off

- Settings, Privacy: turn the switch off.
- Or set `DO_NOT_TRACK=1` or `ORCA_TELEMETRY_DISABLED=1` in the environment.

Dev builds send nothing.
