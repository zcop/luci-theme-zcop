# Validation

## Status-page redistribution, 2026-11-12

Theme version: 0.1.5-r1. Dashboard remains0.4.2-r1.

- System now includes Logs and Processes. Network Diagnostics includes existing
  connectivity tools plus routing, firewall, channel-analysis and WireGuard
  status pages when permitted. Other status plugins use System Diagnostics.
  Legacy Overview and Realtime Graphs are hidden, with their routes retained.
- Active groups/tabs match original backend paths, including nested imported
  pages. Canonical application pages take precedence over aliases to those pages.
- LuCI's real menu helper resolves aliases to target children and caches node
  names. The presentation preserves an alias's own permitted children (including
  System/Kernel logs), or uses the target's canonical child URLs. Source routes,
  actions and ACL flags are not modified by the redistribution.
- Unit and actual-module browser checks cover relocated pages, native/deep apps,
  aliases, unknown plugins, denied entries, status-only users without original
  System/Network configuration groups, Dashboard fallback, and selected-tab
  visibility on mobile. Existing metric/layout/paused-polling checks also pass.
- Browser-only candidate verification against the live router passed for
  Dashboard, System, Logs, Processes, routing, firewall, WireGuard status and
  Connectivity, with correct grouping/selection and no browser exceptions.
  Channel-analysis links were checked without opening their scan view.
- A bounded third-party source review timed out without a verdict and is not
  review approval. Acceptance uses primary source, fixture and device checks.


## Wider interface list and compact activity, 2026-11-12

Dashboard version: 0.4.2-r1. Theme remains0.1.4-r1.

- Interfaces span the device/network columns and use compact rows with separate
  name, state, protocol, device and address columns. A total/up count summarizes
  larger lists. Narrow frames use labeled fields with no horizontal overflow.
- Network status moves below the compact WAN activity summary. Repeated idle
  captions and the long accounting paragraph were removed; accounting limits
  remain in the active chart-caption tooltip. No data source/polling change.
- Unit and actual-module browser suites pass, including16 simulated netifd
  interfaces with VPN/tunnel names and long IPv6 values at1536,1024,768,390px.
  All rows remain present and the final row is reachable; wide rows stay compact.
- This verifies rendering of larger configurations. No actual VPN or tunnel was
  created or traffic-tested by the layout change.


## Footer, stable metrics and processor details, 2026-11-12

Dashboard version: 0.4.1-r1. Theme remains0.1.4-r1.

- Removed the duplicate Overview heading. Refresh controls/status now appear
  in the existing page footer, outside the dashboard data rerender region.
- CPU/RAM chart slots remain present while pending, failed or recovering.
  Their annotations retain a consistent height. Browser checks compare panel
  geometry before the first sample, after updates, on failure and when paused.
- Processor metadata is read once per page through three narrowly allowed file
  paths: /proc/cpuinfo, /sys/devices/system/cpu/present and the policy0
  cpuinfo_max_freq file. The recurring collector is unchanged. The live router
  reports architecture8, present CPUs0-1, maximum1200000kHz; revision4 is not
  treated as architecture8.4.
- Unit checks cover ranges/duplicates, offline-present cores, absent or invalid
  fields, frequency parsing and architecture/revision separation. Browser
  fixtures verify the processor label and that these fields are never polled.
- Existing metric, scheduling, menu, ACL-fallback and responsive checks pass.

## Overview navigation and top-bar notice, 2026-11-12

Theme version: 0.1.4-r1. Dashboard remains0.4.0-r1.

- Overview displays only the permitted Dashboard tab. Its visual menu is a copy;
  the registered menu tree and routes remain intact. When Dashboard is absent
  or denied, existing permitted status pages remain the fallback.
- The existing no-root-password condition now renders a compact notice inside
  the fixed command bar. It preserves the password-configuration destination
  and permission check; login/recovery notices and authentication are unchanged.
- Unit and actual-module browser checks pass, including the one-tab Overview,
  ACL fallback, original tree preservation, notice placement/link/width and
  visibility while content scrolls, with a refresh indicator also present.
- The modified ucode header compiles with the prepared host compiler. The first
  compile caught an invalid template else delimiter; it was corrected before
  packaging or deployment.

## Connected panes, 2026-11-12

Dashboard version: 0.4.0-r1. Theme remains0.1.3-r1.

The supplied visual reference informed connected panes with shared separators,
compact data rows and integrated small charts. Device/disk/network summary,
WAN activity/interfaces and CPU/RAM/ports occupy unequal-width columns, with
independent section heights and no card gutters. The supplied image is not
included in the repository.

- Unit and actual-module browser checks pass, including adjacent unboxed panes,
  unequal widths, long values and desktop/tablet/phone reflow.
- CPU/RAM trends use existing snapshots, with at most60 entries each. Tests
  check bounded histories and ensure unrelated redraws do not duplicate samples.
  Missing/initial data remains unknown; no startup history is fabricated.
- Collector, RPC sources, refresh intervals, ACLs and dependencies are unchanged.
  Source/package screenshots continue to use explicitly marked synthetic data.


## Compact sections, 2026-11-12

Dashboard version: 0.3.0-r1. Theme remains 0.1.3-r1.

Replaced the large rounded panels with six open sections at unequal widths:
device specifications, CPU/RAM/disk utilization, network status, WAN activity,
logical interfaces, and physical ports/radio state. Fine rules and one quiet
square background separate the sections. No minimum section/chart-placeholder
height is imposed on idle content.

- Unit and actual-module browser checks pass. Added assertions cover unboxed
  sections, unequal widths, actual disk utilization and capacity, device specs,
  logical interface addresses, generated IPv6 interfaces and missing resource
  values. Long interface names and IPv6 values fit at390–1920px viewport widths.
- The disk calculation was checked against the existing getMountPoints schema
  and the router's live overlay byte counts. It uses size-free for utilization
  and avail for writable free bytes; filesystem reservations remain distinct.
- Device identity reuses the existing once-per-page board snapshot; core count
  comes from the existing CPU-time snapshot. The collector, scheduler, RPC ACL
  and refresh schedule are unchanged.
- Updated screenshots render the actual application against explicitly marked
  synthetic RPC fixtures; they do not present sample values as router readings.

The bounded third-party source review timed out without a verdict. It is not
review approval; acceptance for this revision uses primary source inspection,
the checks above and separate package/live verification.

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
