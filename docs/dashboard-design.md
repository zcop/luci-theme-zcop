# Compact overview, revision 05

The overview summarizes the router for a quick glance. It uses its own
presentation over existing authenticated LuCI RPC snapshots; configuration
pages keep their existing LuCI workflows. The theme supplies the fixed menus,
stable main frame and three palettes.

## Content and arrangement

The page uses open sections, not a card grid. Thin horizontal rules establish
alignment, and the network summary has a quiet inset background. Sections have
no rounded corners or enclosing outlines, and no shared minimum height.

At wide content widths the first row uses a 3:2:2 proportion:

- **Device**: model, hostname, reported processor/core count, target platform,
  firmware/build, kernel and uptime. Hardware identity is read once per page;
  core count comes from the already collected CPU-time snapshot.
- **Utilization**: three compact meters for CPU busy time, RAM and writable disk,
  each with its percentage and relevant capacity/free values.
- **Network status**: WAN state/protocol, IPv4/IPv6 addresses, gateway and active
  ECM accelerated-flow counts. This is interface state, not an Internet test.

The second row gives more width to network activity, followed by compact
logical-interface and physical-port sections:

- **Network activity**: WAN download/upload rates and one plot. A disconnected
  or unsampled WAN has a short message instead of an empty chart-sized gap.
- **Interfaces**: logical interface name, status, protocol, device and addresses.
- **Ports & Wi-Fi**: physical Ethernet carrier/speed and radio/network/channel
  summaries. Port information is separate from logical interface information.

DHCP lease counts remain a small footer, labelled as leases rather than online
clients. The number of interfaces/radios and length of values determine section
height; they are not stretched to match another section. Container queries
reflow to two columns and then one as the content frame narrows.

There is no widget editor, drag/resize library, client inventory, live event
stream, network scan or traffic classification. Screenshots in this directory
render the actual application with explicitly marked synthetic RPC fixtures.
`preview/index.html` is the earlier static concept, not a live feature list.

## Data and resource budget

Existing RPC methods, ACLs, collection schedule and scheduler are reused. There
is no added router service, polling source, shell command, flow dump or history
database. One collector runs at a time; numeric history stays in the browser.

| Snapshot | Refresh while visible | Source |
| --- | --- | --- |
| Board identity | Once per page | system.board |
| WAN counters | 5 seconds; selectable 10 seconds or manual | Selected WAN L3 device status |
| CPU, memory, uptime and interface/link state | 15 seconds | /proc/stat, system.info and existing network summaries |
| Radio state, leases and optional accelerated-flow counts | 30 seconds | Existing luci-rpc summaries and two debugfs scalar reads |
| Writable storage | 60 seconds | Existing mount summary |

Collection pauses when hidden, leaving the page or explicitly paused. A request
already in flight can finish. Failures back off. History is limited to60 samples.
CPU busy percentage uses CPU-time deltas, not load average or a shell top command.

## Accuracy

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
