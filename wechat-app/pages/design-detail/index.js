const copy = require('../../utils/design-copy')
const { getLanguage } = require('../../utils/i18n')
const { findDesign, designView, deleteDesigns, displayDate } = require('../../utils/design-records')

Page({
  data: { t: copy.zh, language: 'zh', record: null, rows: [], materials: [], assignments: {}, deleteIds: [], error: '' },
  onLoad(options) { this.id = options.id },
  onShow() {
    const language = getLanguage()
    const t = copy[language]
    wx.setNavigationBarTitle({ title: t.detail })
    try {
      const record = findDesign(this.id)
      if (!record) throw new Error('Missing record')
      this.setData({ t, language, record, date: displayDate(record.updatedAt), ...designView(record.design, record.fabrics, t.parts, t.fabric), error: '' })
    } catch (_) { this.setData({ t, language, record: null, error: t.missing }) }
  },
  edit() { wx.navigateTo({ url: '/pages/design/design?id=' + encodeURIComponent(this.id) }) },
  guide() { wx.navigateTo({ url: '/pages/guide/guide?id=' + encodeURIComponent(this.id) }) },
  remove() { this.setData({ deleteIds: [this.id] }) },
  closeDelete() { this.setData({ deleteIds: [] }) },
  confirmDelete() {
    try { deleteDesigns([this.id]); this.back() }
    catch (_) { wx.showToast({ title: this.data.t.saveError, icon: 'none' }) }
  },
  back() { wx.reLaunch({ url: '/pages/designs/index' }) },
  stop() {}
})
