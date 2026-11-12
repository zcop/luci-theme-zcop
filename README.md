# Zcop LuCI theme

An independent OpenWrt/ImmortalWrt feed with a warm light palette, a charcoal
dark palette and a black/gold luxury palette. The selected sidebar item joins
the main frame as one continuous surface. Fonts and icons are local; no CDN,
wallpaper download, extra daemon or framework is required.

The sidebar and section menu stay in place while the main content frame scrolls.
The outer frame keeps the same width and height across pages at a given viewport.
Forms use the available content space; tables wider than that space scroll
horizontally inside the content frame, leaving both menus in place.
Long navigation lists scroll independently only when needed to keep every page
reachable on a short viewport. The page footer and save/apply controls stay
inside the content frame.

![Dashboard design](docs/dashboard-light.png)

Application rendered with synthetic test data; these are not live router values.

## Packages

| Package | Purpose |
| --- | --- |
| `luci-theme-zcop` | Theme, connected sidebar, registered LuCI page menus, three browser-local palettes and mobile navigation. |
| `luci-app-zcop-dashboard` | Compact overview: device specs, CPU/RAM/disk utilization, WAN activity/state, logical interfaces, physical ports and radio status. |

The theme depends on `luci-theme-bootstrap` to preserve LuCI's established form,
authentication, modal, save/apply and rollback contracts. No LuCI core patch or
ImmortalWrt fork is needed. Current templates target modern ucode-based LuCI;
legacy Lua-only LuCI is not supported.

## Add the feed

Add this line once to the firmware tree's `feeds.conf.default` (or its active
`feeds.conf`):

```text
src-git zcoptheme https://github.com/zcop/luci-theme-zcop.git;main
```

Then run from that firmware tree:

```sh
./scripts/feeds update zcoptheme
./scripts/feeds install -p zcoptheme luci-theme-zcop luci-app-zcop-dashboard
make menuconfig
```

Select the theme under **LuCI → Themes** and, optionally, the dashboard under
**LuCI → Applications**. To compile only these packages in an already prepared
build tree:

```sh
make package/feeds/zcoptheme/luci-theme-zcop/compile V=s
make package/feeds/zcoptheme/luci-app-zcop-dashboard/compile V=s
```

There is no prebuilt package repository yet. The Git feed downloads source for
OpenWrt's package builder; it is not an `apk`/`opkg` binary feed. The two package
directories can also be symlinked into another prepared build tree.

## Select the theme

Installing registers **Zcop** under LuCI's language/style settings and selects
it as the default once. The registration script runs after Bootstrap and Argon.
Later upgrades preserve your manual theme choice, using the
`luci.main.zcop_default_applied` marker. To select Zcop manually on the router:

```sh
uci set luci.main.mediaurlbase='/luci-static/zcop'
uci commit luci
```

Reload the browser. Palette selection stays in that browser's local storage;
it does not write router configuration. To return to Bootstrap, select it in
LuCI or set the media path to `/luci-static/bootstrap`. Authentication and
save/apply still use LuCI's own handling.

The optional dashboard appears under **Overview → Dashboard**. Its navigation
entry requires its read ACL. Other installed applications remain in their
registered LuCI sections, with arbitrary deeper subpages retained. The theme
does not rewrite application URLs or replace UCI configuration workflows.

The dashboard uses its own presentation over existing authenticated LuCI RPC
data. It uses connected panes with shared divider lines: device details and disk on
the left, WAN activity and logical interfaces in the wider center, and compact
CPU/RAM trends plus ports/radios on the right. A quiet background separates
the device pane without rounded cards. Panes reflow as the frame narrows.
Detailed configuration stays on the existing pages. Missing data is shown as
unavailable; an interface being up does not claim Internet reachability, and
lease counts do not claim that clients are online.

## Small-router defaults

- Traffic: 5 seconds; system, link and CPU snapshots: 15 seconds; wireless,
  leases and optional NSS counts: 30 seconds; storage: 60 seconds.
- One collector in flight; no sampling sleep and no shell `top` command.
- Polling stops when paused, hidden or leaving the page. An already running
  request can finish. Failures back off; manual refresh is available.
- At most 60 numeric samples per WAN, CPU and RAM history in the browser. No RRD, collectd, database,
  router-side history, packet capture, flow dump, Wi-Fi scan or Internet probe.
- WAN traffic is labelled as reported interface counters. NSS coverage must be
  checked on the target before treating it as complete accelerated accounting.
- Available memory means Linux `MemAvailable`, not physical RAM or `MemFree`.
  Missing counters stay unavailable rather than displaying an invented zero.

See [dashboard design and acceptance](docs/dashboard-design.md).

## Preview and verification

The screenshots above show the current dashboard rendered against synthetic
RPC fixtures. [preview/index.html](preview/index.html) is the earlier standalone
concept and does not represent the current layout. Its sample values are never
used by the live dashboard. Association counts, service health badges and
per-client statistics from that earlier concept are not implemented.

Run `node tests/unit.cjs` for metric and scheduler checks. The browser harness
in `tests/browser.cjs` exercises the actual theme menu and live view with
synthetic RPC fixtures; it accepts `PLAYWRIGHT_MODULE` pointing to an installed
Playwright package. Tests do not contact or modify a router.

The theme has also been installed and checked on a CR881x. Stable-frame checks
cover Dashboard, Interfaces, System, Firewall and QoS at desktop and phone widths.
This does not establish compatibility with every third-party LuCI application,
complete NSS accounting or production resource overhead.

See [validation evidence](docs/validation.md) for completed checks and
the remaining device acceptance boundary.

## License

Apache-2.0. Bootstrap remains a separate upstream dependency under its own
Apache-2.0 license. This repository does not include ERP application code.
