include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-zcop-dashboard
PKG_VERSION:=0.8.2
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=Lightweight Zcop router dashboard
LUCI_DEPENDS:=+luci-theme-zcop +rpcd-mod-file +rpcd-mod-luci +rpcd-mod-iwinfo +iw
# CSSTidy 1.3 removes @container conditions and leaks their rules globally.
LUCI_MINIFY_CSS:=0

define Package/luci-app-zcop-dashboard/conffiles
/etc/config/zcop_devices
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
