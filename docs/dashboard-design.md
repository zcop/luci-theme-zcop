# Compact overview, revision 07

The overview summarizes the router for a quick glance. It uses its own
presentation over existing authenticated LuCI RPC snapshots; configuration
pages keep their existing LuCI workflows. The theme supplies the fixed menus,
stable main frame and three palettes.

## Content and arrangement

The user-supplied dashboard reference establishes a continuous workspace with
shared divider lines, compact label/value rows and small plots next to values.
The router adapts that structure into three adjacent panes of unequal width:

- **Device pane**: model, processor/core count, firmware/build, kernel, uptime
  and writable-disk usage.
- **Network pane**: compact download/upload rates and plot, followed by WAN
  state, assigned addresses, gateway and acceleration summary.
- **Metrics pane**: CPU and RAM percentages with small recent-sample plots,
  followed by physical ports and radio/network/channel summaries.

**Interfaces** span the combined width of the device and network panes below
those summaries. Five columns show name, state, protocol, device and addresses.
A small total/up count makes larger configurations easy to scan. The list is
not capped: new configured VPN/tunnel interfaces use the same rows. On a narrow
frame each row reflows into labeled fields; only the main content frame scrolls.
This uses netifd's logical interface dump, not discovery of unmanaged devices.

Panes have shared vertical rules. Their sections use horizontal rules at natural
content boundaries, without enclosing outlines, corner rounding or gutters.
The device pane has a slightly different background. Section heights follow
content independently rather than forcing a uniform row of boxes. A down WAN
uses a short message in place of an empty chart-height placeholder. Repeated
No current rate / No WAN device lines and a long accounting paragraph are
omitted; the latter remains in the live chart-caption tooltip.

At intermediate widths the metrics move below the first two panes. A phone
uses one vertical stack. Fixed sidebar/section menus and the stable outer main
frame remain supplied by the theme. The DHCP lease footer labels leases rather
than claiming online clients.

The top Dashboard tab is the page title; there is no duplicate Overview heading
inside the view. Refresh status, interval and pause/refresh controls are placed
in the existing page footer. CPU/RAM plots retain their space while loading or
unavailable, and their annotation rows retain two lines of space, so polling
does not move neighboring sections.

CPU/RAM plots use existing15-second snapshots, without any additional request.
Each browser-local array is limited to60 numeric samples/gap markers. CPU/RAM
plots use a fixed0-100% scale with labeled0/50/100% guides and a subtle area
fill. A single sample is a point. Paused or unavailable readings are omitted
from the plotted series, and adjacent collected readings are connected. These
are sample-history plots, not continuous elapsed-time axes. The stored arrays
retain gap markers; missing values are never converted to zero. Plots span
the samples actually collected, without claiming a fixed time duration or
inventing data to fill startup history.

There is no widget editor, drag/resize library, live event
stream, network scan or traffic classification. Documentation screenshots render
the actual application with explicitly marked synthetic RPC fixtures. A separate
Overview Devices tab provides passive lease/reservation/neighbour records and
explicit static-lease staging; it is not part of the Dashboard collector. The
user-supplied reference image is not redistributed in this repository.

## Data and resource budget

Existing RPC methods, ACLs, collection schedule and scheduler are reused. There
is no added router service, polling source, shell command, flow dump or history
database. One collector runs at a time; numeric history stays in the browser.

| Snapshot | Refresh while visible | Source |
| --- | --- | --- |
| Board/processor identity | Once per page | system.board, /proc/cpuinfo, CPU present list and policy0 cpuinfo_max_freq |
| WAN counters | 5 seconds; selectable 10 seconds or manual | Selected WAN L3 device status |
| CPU, memory, uptime and interface/link state | 15 seconds | /proc/stat, system.info and existing network summaries |
| Radio state, leases and optional accelerated-flow counts | 30 seconds | Existing luci-rpc summaries and two debugfs scalar reads |
| Writable storage | 60 seconds | Existing mount summary |

Collection pauses when hidden, leaving the page or explicitly paused. A request
already in flight can finish. Failures back off. Each of the WAN, CPU and RAM histories is limited to60 entries.
CPU busy percentage uses CPU-time deltas, not load average or a shell top command.

## Accuracy

- Processor details use reported architecture, present CPU IDs (including an
  offline present CPU), and the maximum cpufreq value in kHz. The display converts
  that value to GHz; it does not use BogoMIPS, a changing current clock, CPU
  revision as an ISA minor version, or a hardcoded board frequency. Missing
  fields remain unavailable. The CR881x reports ARMv8,2 cores and1200000kHz.
- Interface up does not verify gateway, DNS or Internet connectivity. No probe
  runs. Absent link information differs from a reported disconnected port.
- RAM percentage is (MemTotal - MemAvailable) / MemTotal. Its capacity is the
  Linux pool, not physical RAM including firmware reservations.
- Disk percentage uses (size - free) / size for /overlay. The displayed free
  amount uses available-to-write bytes; filesystem reservations can make it
  lower than total free bytes. Other read-only firmware mounts are not summed.
- Radio up is distinct from disabled/down/unknown. An up radio with an explicitly
  empty interface list shows No networks. No client associations are inferred.
- WAN IPv6 includes the matching dedicated or generated IPv6 interface when
  reported. Logical interfaces remain individually listed.
- Zero accelerated flows is valid at idle; unavailable counters remain unknown.
  Flow counts are active ECM entries, not a guessed acceleration-enabled badge.
- Traffic uses reported WAN interface counters. Complete accelerated byte-count
  coverage remains unverified and is labelled. No LAN/WAN/conduit totals are
  summed, which would count the same packet multiple times.
- Missing or initial samples are not fabricated zeros. CPU needs two time
  samples. Valid idle rates show0.0 Mbps; counter resets and long gaps reset
  rate baselines. Missing lease lists differ from known empty lists.

See [validation.md](validation.md) for source, fixture, package and device checks.
