# Validation

## Idle and initial states, 2026-11-12

Dashboard version: 0.2.1-r1. Theme remains 0.1.3-r1.

- On the live CR881x, both radios reported up with empty interface lists. This
  now shows No networks in a neutral style. Radio up remains distinct from
  serving an AP or having associated clients.
- A down, unconfigured or unavailable WAN replaces the empty graph with a
  specific message. Establishing a rate baseline shows Waiting for traffic
  samples; a valid idle connection still shows 0.0 Mbps and its chart.
- CPU usage shows an explicit pending message until a second CPU-time sample
  arrives. Missing data remains separate from this initial state.
- Unit and actual-module browser checks pass, including new fixtures for the
  first CPU/rate samples, disconnected/unconfigured WAN, failed status reads,
  valid zero-rate traffic and radios with no interfaces.

These are display changes using existing snapshots. The collector, RPC sources,
refresh schedule, ACLs and dependencies are unchanged.

## Network overview, 2026-11-12

Dashboard version: 0.2.0-r1. Theme remains 0.1.3-r1.

The dashboard now has a compact connection strip and four panels: WAN traffic,
router health, Ethernet ports and Wi-Fi radios. DHCP lease counts are a footer.
The presentation uses the existing RPC calls, ACLs, collector and scheduler;
there are no added polling sources or router services.

- Unit and actual-module browser checks pass. Existing serialized, hidden,
  paused/manual and failure behavior remains covered. Container-based layouts
  are exercised across the existing desktop/tablet/phone viewport checks.
- Added fixture checks distinguish unknown links/radios and omitted lease
  lists from disconnected/disabled states and known empty lists. Valid zero
  accelerated-flow counts remain zero; unsupported counters remain unavailable.
- The simplified preview screenshots render the actual dashboard module with
  explicitly marked synthetic RPC data.
- The build's CSSTidy 1.3 removes CSS container conditions and applies their
  rules globally. CSS minification is disabled for this application to retain
  its responsive rules; package compression still applies. Theme CSS and
  JavaScript keep their existing build settings.

A bounded third-party source review identified status-label pitfalls. Primary
review implemented and checked the unknown-state changes; a returned review
is not device acceptance. The existing production/accounting limits below
continue to apply.

## Stable frame, 2026-11-12

Theme version: 0.1.3-r1. Optional dashboard remains 0.1.1-r1.

Bootstrap makes the document body a flex column. The shell's horizontal auto
margins and unspecified width caused it to shrink to each page's preferred
width. Giving the shell an explicit full width retains the existing maximum
width and responsive spacing while making its geometry independent of content.

- Unit and actual-module browser checks pass, including narrow pages, fluid
  forms and a 2000-pixel table across 390, 768, 1366 and 1920-pixel viewports.
  Switching menu groups preserves the frame geometry. Keyboard focus reaches
  the last table action by scrolling the content frame; neither the document
  nor the menus move with it. Existing long-form Save control checks still pass.
- Live Dashboard, Interfaces, System, Firewall and QoS pages were compared at
  desktop and phone widths. The main frame remains the same size between pages;
  wide interface/firewall tables scroll inside it. No browser exceptions were
  observed. Router network settings were not edited for these layout checks.

This change adds no script, polling, router service or extra runtime dependency.
The live pages checked do not represent every possible installed LuCI app.
Full authentication-provider and configuration apply/rollback acceptance,
complete accelerated-traffic accounting and production resource comparisons
remain outside this layout validation.

## Initial acceptance, 2026-11-11

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

At initial acceptance, not performed: installation on a router, full authentication/apply/rollback
device acceptance, NSS traffic counter accuracy, or CR881x CPU/RAM load
comparison with the dashboard open. No live router configuration changed.
