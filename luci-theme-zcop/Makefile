include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-zcop
# Template asset URLs use PKG_VERSION; bump it for stylesheet changes.
PKG_VERSION:=0.1.14
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=Zcop LuCI theme with connected navigation
LUCI_DEPENDS:=+luci-theme-bootstrap
LUCI_MINIFY_UT:=0
# Preserve modern selector and @supports/picker syntax.
LUCI_MINIFY_CSS:=0

define Package/luci-theme-zcop/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci -q delete luci.themes.Zcop
	if [ "$$(uci -q get luci.main.mediaurlbase)" = /luci-static/zcop ]; then
		uci set luci.main.mediaurlbase=/luci-static/bootstrap
	fi
	uci commit luci
}
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
