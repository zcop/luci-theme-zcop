# Validation

## Single current-role port labels, 2026-11-13

Overview app: 0.8.2-r1. Theme stays 0.1.14-r1.

- Dashboard ports show one current-role label, such as WAN1, WAN2 or LAN1.
  Physical device IDs remain backing keys/tooltip details. Existing LAN numbers
  remain stable; the fourth socket shows LAN4 when it joins LAN, matching WAN
  Mode's socket convention. Changing a role never renames a network device.
- Role mapping, carrier state, refresh cadence and settings links stay intact.
  Unit/browser checks cover single/dual WAN, all-LAN, shared/conflicting roles,
  optional status failures and recovery. Alternate assignments use fixtures;
  live network configuration is preserved.
- Package build and installed-browser checks pass. The live labels are WAN1,
  LAN1, LAN2 and LAN3, with one heading per port. Three palettes and desktop,
  tablet and phone containment pass; WAN Mode navigation still works. Installed
  assets match the 35732-byte package. Boot ID, configuration, ACL and other
  apps are unchanged; no network or service restart is needed.

## Dashboard port assignments, 2026-11-13

Overview app: 0.8.1-r1. Theme stays 0.1.14-r1.

- Physical socket names remain fixed. Role labels use WAN Mode status together
  with the current LAN bridge membership in the existing device snapshot.
  Carrier/speed remains independent. Permitted port links open WAN Mode without
  applying changes; denied settings links are omitted.
- Pure and browser checks cover all-LAN, a LAN-labelled socket assigned WAN1,
  dual-WAN, explicit VLAN sharing, direct assignment conflicts, unknown/unresolved
  devices, failed optional status and recovery without a page reload. Role
  collection shares the15-second device cadence; hidden/pause behavior remains
  covered. Read permission adds only WAN Mode's status method.
- Read-only router preview matches WAN1 on the WAN socket and LAN roles on
  LAN1–3, including current carrier/speed. The existing WAN Mode page opens from
  a port link. Three palettes and desktop/tablet/phone containment pass. No live
  port assignments are changed: alternative modes are tested with fixtures.
- The app-only package builds successfully (35638 compressed bytes). Installed
  asset hashes match the package; post-install browser checks pass with no
  exceptions. Boot ID, network/device configuration and WAN Mode/QoS helpers
  remain unchanged. Only the read-only ACL and generated LuCI cache are reloaded;
  package scripts/hooks are suppressed and networking is not restarted.

## MAC visibility and vendor lookup, 2026-11-13

Overview app: 0.8.0-r1. Theme stays 0.1.14-r1.

- MAC addresses are emphasized in monospace with a copy icon. Manufacturer
  names sit below them. Manual lookup is the default; per-row and visible-page
  actions are available. Automatic mode is browser-local and processes newly
  displayed global MACs. Private/local addresses are labelled without a guess.
- Pure checks cover longest-prefix matching for 24/28/36-bit assignments,
  invalid/private/unknown addresses, bounded data, a shared in-flight download,
  seven-day IndexedDB reuse, offline stale fallback and page-exit cancellation.
- Synthetic Devices browser checks retain existing friendly-name/static-lease
  staging, conflicts, read-only/hidden behavior and responsive layouts. They
  also cover manual/automatic modes, concurrent lookups, vendor search, failure
  and explicit retry, and downloaded names containing HTML-looking text.
- Live preview resolves both connected devices using the public database,
  validates CORS download without credentials/referrer/device query parameters,
  and reloads Automatic mode from browser storage without another download.
  Layout checks reuse the same public bytes to avoid repetitive downloads.
  Desktop/tablet/phone and three palettes preserve the search/dropdown height
  fix. All configuration writes are blocked during live acceptance.

## Devices search-field sizing, 2026-11-13

Theme version: 0.1.14-r1. Overview app stays 0.7.0-r4.

- Bootstrap's search-input content-box rule made the 34px field render at
  48px including padding/borders. The Devices toolbar now explicitly uses
  border-box sizing and 4px vertical / 8px horizontal padding, matching the
  source selector's 34px outer height. Desktop width allows the complete
  existing search hint; mobile retains a full-width field.
- The Devices browser regression suite passes. A read-only live preview checks
  equal outer heights, room for line height/placeholder/clear affordance,
  typed accented text and responsive containment for three palettes at 1920,
  768 and 390 pixels. No application logic or router configuration changes.
- Theme version increases so the corrected stylesheet receives a fresh URL.

## Refresh controls with cached Dashboard code, 2026-11-13

Theme version: 0.1.13-r1. Overview app stays 0.7.0-r4.

- The internal page-footer host retains the historic `.zcop-footer` selector.
  External version/theme credits use a distinct `.zcop-branding-footer` selector.
  Cached older Dashboard modules therefore append the refresh interval and
  Refresh/Pause controls to the internal host, while current modules use the
  dedicated `.zcop-page-footer` selector. No relocation observer is needed.
- The theme version increases so LuCI generates a fresh stylesheet URL; a
  package-release-only bump keeps the same URL and can leave old CSS cached.
- The theme browser suite runs with a legacy Dashboard selector and asserts
  that the refresh interval remains under the main frame, with no controls in
  external branding. Existing stationary-footer and responsive checks pass.

## External branding footer, 2026-11-13

Theme version: 0.1.12-r7. Overview app: 0.7.0-r4.

- The firmware/version and theme-credit footer is now a sibling of the main
  frame in a separate viewport-shell row. It stays below the frame while page
  content scrolls and does not overlay content or native form actions.
- Dashboard refresh controls use a dedicated page footer inside the scroll
  frame. Other pages leave that empty host hidden. No requests, services or
  router settings are added by this layout change.
- Browser checks measure footer geometry before/after scrolling a long form
  and focusing its final action at desktop and phone sizes. The footer stays
  outside the frame and within the viewport; menus, stable frame geometry and
  keyboard access to Save remain intact. Three palettes pass. System and
  Wireless retain Full HD fit and responsive containment.
- Installed-package checks cover Dashboard, Wireless, System and QoS at
  1920, 768 and 390 pixels: all twelve footer checks stay outside the main frame,
  remain stationary on scroll and keep final controls reachable. No browser
  exceptions, scan or configuration writes occur. Package hashes match;
  boot/configuration/QoS fingerprints remain unchanged.

## Wireless overview, 2026-11-13

Theme version: 0.1.12-r6. Dashboard/Devices/Wireless: 0.7.0-r3.

- Added an ACL-filtered Overview Wireless page using existing LuCI/iwinfo
  snapshots and explicit scan RPCs. A narrowly scoped, read-only `iw ... channels`
  command supplies kernel channel/width restrictions. No configuration/restart
  API or shell permission is granted. Existing Dashboard/Devices collectors are unchanged.
- Pure checks cover signed dBm, inactive versus configured channels, missing
  station data, survey deltas/resets, BSSID deduplication, wide occupied
  spectrum, complete legal channel blocks and signal-weighted recommendations.
- Synthetic browser checks cover manual/serialized scans, stale/failed/empty
  scans, five-minute expiry without network activity, read-only access,
  hidden/page-exit guards, safe untrusted SSID text, SVG/table output, width
  selection, three palettes, responsive containment and Bootstrap fallback.
  The default two-radio view with a populated graph fits at 1920x960 and above.
- Existing theme/menu and unit checks pass. Wireless remains under Overview;
  denied entries stay hidden and existing registered routes remain intact.
- Live checks on CR881x cover both radios, explicit scans, graph output,
  Full HD and three palettes across desktop/tablet/phone widths. The radio
  configuration is currently up with no network interfaces: the page correctly
  shows configured channels and unavailable signal/noise/airtime instead of
  fabricated operating measurements. AP-client/RSSI and non-empty survey data
  are verified with synthetic fixtures, not new associated hardware clients.
- Device validation exposed stale bits in libiwinfo frequency flags. Kernel
  channel output is used instead. Parser checks cover absent widths, disabled,
  no-IR and radar-unavailable channels; unsafe/missing PHY identity cannot run a
  command. The package does not modify the underlying library or LuCI core.
- Package installation skips scripts/hooks, preserves boot and network/Wi-Fi/
  QoS/theme/device configuration hashes, and verifies installed asset hashes.
  Existing Dashboard, Devices and System adapter assets remain byte-identical.
  Only RPC ACLs and generated LuCI caches are reloaded. No firmware flash,
  radio reconfiguration, service restart of networking or auto channel apply
  is performed.

## Fixed-menu highlight protection, 2026-11-12

Theme version: 0.1.12-r5. Dashboard/devices remains 0.6.0-r3.

- The content viewport's negative top margin extended 4px into the command bar
  on the pages with no heading gap. It covered the selected menu underline on
  System and Dashboard. The viewport now begins below the bar; native-page
  spacing and input focus insets are retained by adjusting the bar's margin.
- Browser regression checks use opaque scroll content and test the underline's
  hit target before/after scrolling. Live checks cover System, Dashboard and
  Interfaces at desktop, tablet and phone widths; the selected underline remains
  visible and stationary. Full HD System fit and Devices behavior still pass.
- The fix changes shared theme CSS only and adds no scripts, requests or services.

## Single-frame System properties, 2026-11-12

Theme version: 0.1.12-r4. Dashboard/devices remains 0.6.0-r3.

- System properties now shows Device, Clock, Interface, Logging, Time service
  and Time sources in a single connected frame. Native property tabs and
  repeated System/System Properties headings are removed from presentation.
  Obvious helper text is suppressed; meaningful interface-binding help remains.
- A theme-only adapter moves the existing native field rows into sections
  within their original tab and form ancestry. It does not clone widgets or
  import RPC/UCI modules. IDs, bindings, values, disabled states and native
  handlers remain. Native reset/re-render is handled by an idempotent browser
  observer, disconnected on page exit. Other pages do not load this adapter.
- Synthetic browser checks cover original node identity and change events,
  original tab ancestry, hidden dependencies, native-style reset/re-render,
  idempotence, unknown future fields, disabled controls and page-exit cleanup.
  The default form fits without scrolling at 1920×1080, 1920×960 (browser
  chrome allowance) and 2560×1440. Narrow
  layouts retain the fixed outer frame and scroll internally.
- Live browser preview checks all 22 native fields before/after decoration,
  invalid hostname feedback, NTP dependencies, empty source-section hiding and
  native Reset. No UCI write requests are sent. Existing theme/dashboard and
  model checks pass. The bounded third-party source-contract review timed out
  without a verdict; acceptance rests on primary source and browser checks.
- The built theme was installed and checked through its normal page loader,
  with no preview overrides. Installed scripts, stylesheet and footer match
  package hashes. Boot and configuration fingerprints are preserved, including
  System settings; live validation/Reset sends no UCI write requests. Full HD
  browser-height fit and all three palettes pass with no browser exceptions.
- Full HD Interface alignment: the short preferences section now stretches
  to the Device/Clock row boundary instead of stopping about 96px early. The
  focused browser check measures matching top/bottom edges and retains Full HD
  one-screen fit; smaller layouts preserve their natural stacked heights.
- Shared vertical dividers: borders now belong to individual sections rather
  than two-column wrappers, avoiding a half-pixel midpoint shift. Both row
  boundaries are measured at Full HD, odd-pixel width and larger viewports;
  Interface/Time sources and Clock/Time service align within 0.05 CSS pixels.

## Shared control spacing, 2026-11-12

Theme version: 0.1.11-r1. Dashboard/devices remains 0.6.0-r3.

- Native table actions had 1-pixel margins on each button, control groups had
  0.2em gaps, and input/add pairs inherited a negative joining margin. Some
  modal and inline actions relied on text-node whitespace that is absent in
  JavaScript-generated LuCI rows. Larger themed controls made this conspicuous.
- The common stylesheet now provides explicit 8-pixel spacing for independent
  actions, modal footers, table rows, field buttons and dynamic-list add pairs.
  Action rows wrap at narrow widths; page and modal actions retain their native
  alignment. Split-dropdown internals remain joined. No LuCI core or page logic
  changes, extra polling or router services are needed.
- Browser fixtures measure gaps, wrapping, fixed-frame containment, left/right
  action alignment and unchanged split-dropdown spacing. Live read-only previews
  cover System, Interfaces, Diagnostics, Firewall and Devices at 390/768/1536px,
  with modal actions in all three palettes. No UCI writes are sent.
- The theme package was built and installed on the CR881x. Installed CSS
  matches the package; boot ID and network, wireless, firewall, DHCP, theme
  and friendly-name configuration hashes remain unchanged. Final live checks
  pass on those pages and widths, with no browser errors or configuration writes.

## Device connection details and row actions, 2026-11-12

Dashboard/app version: 0.6.0-r3. Theme remains 0.1.10-r1.

- Passive FDB entries show learned paths, including multiple possible paths,
  without classifying downstream clients as directly wired or wireless. Static,
  local and multicast FDB entries are excluded; private transport VIDs are not
  presented as client VLANs. Exact local AP associations supply SSID, band,
  signal and Tx/Rx link rates. No scan or remote AP query is added.
- Friendly labels are stored separately in the package-preserved `zcop_devices`
  UCI config, matched by MAC/DUID rather than IP. Native row menus stage label
  creation/edit/removal or simple IPv4 reservation changes for LuCI review.
  Reservation edits retain alternative MACs, DUIDs, tags and other DHCP options.
  Complex DHCP records remain on the native DHCP page. Copy actions need no
  configuration permission.
- Unit and browser fixtures cover AP-only/VLAN association collection, native
  rate units, duplicate FDB paths, stale/empty association snapshots, alias
  identity with reused IPs and IAIDs, Unicode names, source failure/read-only
  behavior, validation, staged label removal and reservation option preservation.
  Hidden-page polling and the one-collector rule remain covered. An open Actions
  menu suspends refresh and redraw; popup placement/stacking keeps row actions
  usable without moving the outer frame.
- Both existing dashboard/theme and Devices browser suites pass. The app package
  builds with the prepared OpenWrt toolchain. Installation preserves boot ID and
  existing network, wireless, firewall, DHCP and theme configuration hashes; the
  second upgrade also verifies retention of the new friendly-name config.
- Live checks identify the two current clients through LAN2/LAN3, exercise the
  actual LuCI dropdown/forms, reject invalid names/addresses and cancel without
  UCI write requests. Desktop/tablet/phone screenshots have no document overflow;
  all three palettes have clickable, unobstructed action menus and no browser
  exceptions.

Acceptance limits: local AP statistics and successful configuration staging are
fixture-tested. The router has no active AP interface, and these checks do not
apply a live name or DHCP reservation. Downstream mesh telemetry, per-client byte
accounting, policy controls and Wake-on-LAN are outside this slice. The bounded
third-party review returned no verdict (provider quota, then scoped-read denial);
acceptance is based on primary source, fixture, build and device checks.

## Native page-action contrast, 2026-11-12

Theme version:0.1.10-r1. Dashboard/devices remains0.5.0-r1.

- The native secondary Save action keeps readable text on its neutral surface,
  overriding Bootstrap's adjacent-Apply-button rules. Split Save & Apply
  previews inherit the button surface instead of adding an inset panel.
- This completes the control-styling pass; values, handlers and configuration
  behavior are unchanged. System action colours are checked explicitly in the
  live browser alongside all-palette inputs, opened pickers and modal actions.

## Consistent form controls, 2026-11-12

Theme version:0.1.9-r1. Dashboard/devices remains0.5.0-r1.

- Text/search/password/numeric fields, textareas, selects and buttons now share
  palette colours, borders, spacing and focus states. Footer controls stay
  compact. Bootstrap dropdown panels/dynamic lists use the same palette;
  selected, disabled, read-only, invalid and spinner styles remain distinct.
- Supported desktop browsers use CSS customizable native select pickers, gated
  by @supports and pointer:fine. Other browsers/devices retain native pickers.
  Existing select values/events, multi-selects and LuCI widget code are intact.
  Theme CSS minification is disabled to preserve modern selector/picker syntax.
- Existing unit/device-model and both browser suites pass. A browser-only live
  CSS preview checks all three palettes, native picker opening/selection/escape,
  search focus and the native static-lease modal. It also opens the real LuCI
  network dropdown through unsaved System form controls. Desktop/tablet/phone
  checks report no document overflow or page errors and no UCI write requests.
- Reference: [MDN customizable selects](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select).

## Overview Devices, 2026-11-12

Dashboard/app version:0.5.0-r1. Theme version:0.1.8-r1.

- Overview now contains permitted Dashboard and Devices tabs. Existing LuCI
  status/configuration routes and Dashboard read-only ACLs are preserved.
- Devices merges DHCPv4/v6, static host sections and passive neighbour snapshots.
  Unit tests cover MAC/DUID/IAID identity, IP reuse, alternative MACs, missing
  MACs, unobserved static entries, cached/failed neighbours and lease expiry.
- Source/pool/MAC/IP conflict validation is tested. Browser fixtures exercise
  search/filter/pagination, escaped names, read-only users, failed sources,
  hidden-page polling, modal cancel, duplicate rejection and simulated UCI
  staging through the existing native pending-changes flow. No auto-apply.
- Browser-only preview with actual router data and the native LuCI form shows
  three records, merges its dual-stack client, rejects an out-of-subnet IPv4
  reservation, and cancels without any UCI write requests. Desktop/tablet/phone
  layouts were inspected. No live reservation was applied or committed.
- One bounded third-party source review timed out without a verdict. It is
  not review approval; primary source/tests/browser checks provide acceptance.

## Compact collected-sample history, 2026-11-12

Dashboard version: 0.4.4-r1. Theme remains0.1.7-r1.

- CPU/RAM plots omit unavailable readings, including the initial CPU baseline
  and periods when the page was hidden. Actual samples are drawn consecutively
  on the fixed0-100% scale. CPU text and plot tooltips identify collected-sample
  history rather than continuous elapsed time.
- Source arrays retain their original gap markers and bounded length. No zero
  readings are invented, a single sample remains a point, and the hidden-page
  pause policy and collection intervals are unchanged.
- Unit/browser checks cover omitted internal and initial gaps, fixed50% scale,
  empty/single-sample history, stable layout and the existing polling behavior.

## Filled resource history, 2026-11-12

Dashboard version: 0.4.3-r1. Theme remains0.1.7-r1.

- CPU and RAM histories have a subtle accent fill under the line, with fixed
  0/50/100% guides and labels. The existing52px plot slots and panel heights
  are retained. Single samples remain points; missing history leaves gaps in
  both the stroke and fill. Empty history is not drawn as zero usage.
- Unit and actual-module browser checks pass. Browser geometry verifies fill
  on both sides of a missing sample, no fill across that gap, and correct50%
  placement on the fixed scale. Light/dark previews were visually inspected;
  the suite also covers the luxury palette and narrow frames.
- Existing RPCs, polling intervals and browser history limits are unchanged.

## Dashboard heading gap, 2026-11-12

Theme version: 0.1.7-r1. Dashboard remains0.4.2-r1.

- Removed the Dashboard-only 24px desktop / 20px phone gap below the command
  bar and the duplicate top divider. Dashboard panes now meet the existing
  command-bar divider. Other pages keep their normal content spacing.
- Browser-only verification on the router measured zero gap at1536,768,390px.
  Existing unit and browser checks pass; data collection is unchanged.

## Selected tabs after indicator resize, 2026-11-12

Theme version: 0.1.6-r1. Dashboard remains0.4.2-r1.

- LuCI can insert its Refreshing indicator after navigation renders, reducing
  the tab area's width. A browser ResizeObserver keeps each selected tab visible
  after that change or a viewport resize, without scrolling the content frame.
- Unit and actual-module browser checks pass, including a delayed indicator at
  phone width. A browser-only source override also passes on the live router's
  registered pages, including both log pages and native configuration pages.
- This is theme presentation only; original LuCI pages, backend routes, access
  checks and network configuration are unchanged.

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
