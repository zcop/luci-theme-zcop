# Lightweight network overview, revision 04

The dashboard is a separate read-only LuCI application with its own presentation
and existing authenticated RPC data. The theme supplies the stable frame,
connected sidebar and palettes. Other administration pages remain LuCI pages.

## Information hierarchy

The design takes the at-a-glance overview from [OPNsense's dashboard](https://docs.opnsense.org/manual/dashboard.html)
and the summary/detail distinction from [Fortinet's dashboard documentation](https://docs.fortinet.com/document/fortigate/latest/administration-guide/345190/dashboards-and-monitors).
For a home router, it uses this fixed arrangement:

1. A compact connection strip: WAN interface state, protocol, assigned addresses
   and optional active ECM accelerated-flow counts.
2. WAN traffic: one download/upload plot with visible values and an automatic
   scale. Recent numeric samples stay in the browser.
3. Router health: CPU busy and Linux MemAvailable, with uptime and writable
   storage as secondary rows. No separate disk, memory or CPU charts.
4. Ethernet ports and Wi-Fi radios: link/speed per socket; radio state, SSID and
   current channel when reported. Lease counts sit in a small footer.

Traffic and health share the first row, and ports and radios share the second.
CSS container queries stack panels when the available content frame is narrow.
The existing sidebar and top menu remain fixed. There is no widget editor,
drag/resize library, live event feed, traffic classification or client inventory.

The screenshots in this directory exercise the actual application against
clearly marked synthetic RPC fixtures. `preview/index.html` remains the original,
more detailed static concept; its illustrative features are not a live feature
list and it never connects to a router.

## Data and router budget

The redesign reuses the existing collector, scheduler, RPC methods and ACLs.
It adds no router daemon, polling source, scan, probe, shell command, flow dump,
history database or runtime dependency. There is one collector in flight.

| Snapshot | Refresh while visible | Source |
| --- | --- | --- |
| WAN byte counters | 5 seconds, selectable 10 seconds or manual | Selected WAN L3 device status |
| Memory, uptime, CPU time and link state | 15 seconds | system.info, /proc/stat, interface/device summaries |
| Radio state and DHCP leases | 30 seconds | Existing luci-rpc summaries; no station dump or scan |
| Optional accelerated-flow counts | 30 seconds | Two bounded debugfs scalar reads |
| Writable storage | 60 seconds | Existing mount summary |

Pause collection when hidden, leaving the page or explicitly paused. A request
already in flight can finish. Failed collection backs off. Numeric traffic
history is limited to 60 samples in the browser; no persistent history is kept.
CPU percentage comes from deltas of /proc/stat, without invoking top or sleeping.

## Status semantics

- **Interface up** means the logical WAN interface reports up. It does not
  establish gateway, DNS or Internet reachability. No probe runs automatically.
- Physical Ethernet carrier is separate: absent carrier information shows
  Unavailable; a reported false carrier shows No link.
- A disabled radio is separate from a down radio or missing status. Band labels
  come from reported band/frequency; names such as radio0 are the fallback.
  An up radio with an explicitly empty interface list shows No networks;
  Radio up describes radio state, not client association or Internet access.
- Available memory uses Linux MemAvailable, alongside Linux MemTotal. Physical
  RAM and reserved firmware memory are different quantities.
- Missing lease lists show unavailable values; known empty lists show zero.
  Leases are not a count of online clients.
- NSS values are active ECM accelerated-flow counts. Zero is valid at idle;
  missing/unsupported counters show Unavailable. There is no guessed enabled
  badge based on module presence or a nonzero flow count.
- Traffic uses reported interface counters. Complete NSS byte-accounting
  coverage is still unverified and is labelled accordingly.
- Disconnected, unavailable and initially unsampled WAN traffic have explicit
  messages. Valid zero-rate samples still show 0.0 Mbps and a chart. CPU usage
  waits for its second time sample instead of presenting a guessed value.
- Failed data becomes unavailable/stale instead of silently keeping a healthy
  status. Reboot, device change, counter reset and long gaps reset rate baselines.

## Validation boundary

Unit checks cover calculation and scheduling. Browser fixtures cover actual
LuCI module exports, labels, unknown-versus-zero states, ACL-filtered navigation,
three palettes, long forms and wide tables, and responsive frame behavior.
Live rendering is checked separately on CR881x. Package/browser validation
is not a completed production load comparison or complete accelerated-traffic
accounting acceptance. See [validation.md](validation.md).
