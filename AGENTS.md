# Theme repository instructions

This repository is independent of firmware source. It owns a LuCI theme and
an optional read-only dashboard. Do not patch firmware drivers or LuCI core.

- Preserve ACL-filtered registered menus, nested routes, authentication
  extensions, indicators and LuCI save/apply/rollback behavior.
- No fabricated live data. Keep the static preview clearly separate.
- No extra daemon, scans, probes, flow dumps, history database or background
  router-side polling. Keep numeric history in the browser.
- One request collector at a time; pause when hidden and on page exit.
- Keep missing/stale metrics distinguishable from actual zero values.
- Run unit and browser checks for behavior changes. Build packages in a
  prepared OpenWrt tree; do not flash or alter a router without authorization.
- No credentials, device dumps, local host paths or test artifacts in commits.
