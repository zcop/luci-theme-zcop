# Initial acceptance, 2026-11-11

Version: 0.1.0-r1. Target package architecture: aarch64_cortex-a53.

Completed:

- Pure unit checks: CPU-time accounting, guest-time exclusion, counter reset
  and interface change detection, missing-vs-zero NSS counts, bounded history,
  one collector in flight, hidden/paused/manual polling and failure backoff.
- Actual theme menu and dashboard modules exercised in Playwright with synthetic
  RPC fixtures. Verified ACL-hidden entries stay hidden, installed application
  and deeper page links remain reachable, QoS grouping preserves original URLs,
  storage units are bytes, stale data becomes unavailable, and pause/hidden
  states stop requests.
- Three palettes and viewport widths 390, 768, 1366, 1440, 1536 and 1920 pixels.
  Visual review corrected Bootstrap tab sizing; no document overflow or browser
  exceptions remain in the fixture checks.
- ucode templates compiled with the host compiler; shell registration script
  syntax and JSON metadata parsed successfully.
- Both packages discovered through an independent source feed, installed into
  build metadata and built using the prepared ImmortalWrt package toolchain.
  Module selections were passed on the make command line; saved image package
  selection was preserved.

Compressed APK sizes, excluding existing Bootstrap/LuCI dependencies:

| Package | Bytes |
| --- | ---: |
| luci-theme-zcop-0.1.0-r1.apk | 7803 |
| luci-app-zcop-dashboard-0.1.0-r1.apk | 6707 |

These sizes describe the first acceptance build. A later build may differ with
source metadata, minifier or signing changes. They do not measure installed
size or router process memory.

The preliminary third-party menu-contract investigation completed. The final
broader third-party review timed out without a verdict; it is not a review
approval. Acceptance above is based on the primary's source, browser and build
checks.

Not performed: installation on a router, full authentication/apply/rollback
device acceptance, NSS traffic counter accuracy, or CR881x CPU/RAM load
comparison with the dashboard open. No live router configuration changed.
