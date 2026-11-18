const copy = require('../../utils/design-copy')
const { getLanguage } = require('../../utils/i18n')
const { findDesign, designView } = require('../../utils/design-records')
Page({
  data: { t: copy.zh, record: null, thumbnails: [] },
  onLoad(options) {
    this.id = options.id
    const t = copy[getLanguage()]
    wx.setNavigationBarTitle({ title: t.savedTitle })
    try {
      const record = findDesign(this.id)
      this.setData({ t, record, thumbnails: record ? designView(record.design, record.fabrics, t.parts, t.fabric).thumbnails : [] })
    } catch (_) { this.setData({ t }) }
  },
  view() { wx.redirectTo({ url: '/pages/design-detail/index?id=' + encodeURIComponent(this.id) }) },
  designs() { wx.reLaunch({ url: '/pages/designs/index' }) },
  home() { wx.reLaunch({ url: '/pages/index/index' }) }
})
