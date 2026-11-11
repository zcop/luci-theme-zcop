# Lightweight dashboard design, revision 03

The approved visual prototype is in `preview/index.html`. Its data is
illustrative and its controls never start live collection. The separate
`luci-app-zcop-dashboard` package reads live authenticated LuCI RPC snapshots.
This document records the design target; the README distinguishes the initial
live widgets from the more detailed static preview.

## Default view

- Connection summary: WAN link/protocol, assigned address families, optional
  accelerated-flow count when the required counter source exists.
- One WAN traffic plot, download and upload, with at most 60 samples at the
  default five-second interval. History starts when the page opens.
- CPU time usage, Linux available memory, writable overlay space and uptime.
- Four physical Ethernet sockets, link state and negotiated speed.
- Two radio summaries and associated station counts.
- DHCP lease count and basic DNS/firewall service state.

The selected sidebar area owns the main frame. The command row names the page
once. Configuration and detailed evidence are reached through existing pages,
not duplicated inside every dashboard card. Other LuCI pages remain available.

## Live integration budget

This is an implementation target, not a measured guarantee of router cost.

| Data | Target refresh while visible | Source and limits |
| --- | --- | --- |
| WAN byte counters | 5 seconds, selectable 10 seconds or manual | Read only the selected WAN accounting layer; derive deltas in the browser. |
| System headroom | 15 seconds | Existing system info for memory/uptime; CPU percentage requires CPU-time deltas, not load average. Cache board/version information after initial load. |
| Link/protocol state | 15 seconds | Netifd/device status; reuse existing LuCI RPC sources. |
| NSS summary | 15 seconds, only when supported | Compact accelerated-count/counter read; no ECM connection dump. |
| Radio association and leases | 30 seconds | Existing iwinfo/netifd and lease summaries, bounded responses; no scans or reachability probes. |
| Overlay and service state | 60 seconds | Small status read; no package enumeration or log dump. |

The current feed's `getCPUUsage` implementation launches `top` piped into
`awk` (`feeds/luci/modules/luci-base/root/usr/share/rpcd/ucode/luci`). Do not
reuse that command every refresh. Read a compact `/proc/stat` snapshot via a
bounded authenticated RPC and calculate CPU-time deltas in the browser.
There must be no sampling sleep or long-running process in the RPC handler.

Use a single browser scheduler to batch due calls, one request batch in flight
at a time, with timeout and failure backoff. Pause scheduled reads when hidden,
when leaving the dashboard and when explicitly paused. On return, refresh a
snapshot before calculating rates. Requests already in flight may complete.
Do not fill a long hidden interval with invented samples. Clear the rate
baseline on reboot, interface replacement, counter reset or changed WAN.

Reuse rpcd/uhttpd. No additional daemon, shell polling loop, chart library,
SQLite, RRD, collectd or persistent traffic history. The bounded numeric sample
buffer resides in the viewing browser, not in the router's RAM or flash.

Slow/disabled widgets do not keep polling. Do not run speed tests, pings,
Wi-Fi scans, per-flow conntrack/ECM dumps, packet capture, DPI or top-talker
accounting as a dashboard side effect. Detailed diagnostics remain on demand.

## Accuracy requirements

- WAN ready means link and address configuration; it does not assert that an
  Internet probe passed. No automatic external probe is planned.
- Verify byte counter coverage under NSS acceleration before showing rates as
  total WAN traffic. Do not sum physical/conduit/VLAN/PPP counts for the same
  packets. If coverage is uncertain, show that limitation or no total.
- A loaded NSS module does not establish active acceleration. Show unsupported,
  unknown or stale data honestly; do not replace unavailable values with zero.
- Memory uses MemAvailable against Linux MemTotal, not raw MemFree or physical
  RAM. Physical RAM and firmware reservations are distinct quantities.
- DHCP leases are unexpired leases, not a count of online clients. Wi-Fi
  associations are counted separately. Do not ARP-scan clients to make a badge.
- DNS process state does not prove DNS replies; firewall service state does not
  prove correctness of every rule. Labels must reflect the actual evidence.
- Temperature is omitted where there is no validated sensor. CPU frequency and
  firmware details belong in system details, not frequent dashboard polling.

## Acceptance before live defaults

Measure the built package size and browser assets. On the CR881x, compare idle
without dashboard, one dashboard open, and a dashboard open during routed NSS
traffic. Record CPU, MemAvailable, rpcd/uhttpd memory, refresh latency, error
rate, and traffic counter accuracy. Confirm requests stop when hidden/paused,
resume without spikes, and remain bounded with two viewing browsers. Reduce
refresh cadence or remove a widget if there is a material regression.

Current evidence is browser layout/interaction acceptance only. No router
resource measurements or live dashboard data validation have been performed.
