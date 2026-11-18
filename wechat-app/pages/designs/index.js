const copy = require('../../utils/design-copy')
const { getLanguage } = require('../../utils/i18n')
const { listDesigns, deleteDesigns, designView, displayDate } = require('../../utils/design-records')

Page({
  data: { t: copy.zh, language: 'zh', records: [], managing: false, selectedIds: [], deleteIds: [], error: '' },
  onShow() {
    const language = getLanguage()
    this.setData({ language, t: copy[language] })
    wx.setNavigationBarTitle({ title: copy[language].title })
    this.refresh()
  },
  refresh() {
    try {
      const records = listDesigns().map(record => ({
        id: record.id, name: record.name, date: displayDate(record.updatedAt),
        thumbnails: designView(record.design, record.fabrics, this.data.t.parts, this.data.t.fabric).thumbnails,
        selected: this.data.selectedIds.includes(record.id)
      }))
      const selectedIds = this.data.selectedIds.filter(id => records.some(record => record.id === id))
      this.setData({ records, selectedIds, error: '', managing: records.length > 0 && this.data.managing })
    } catch (_) {
      this.setData({ error: this.data.t.saveError })
    }
  },
  toggleManage() {
    this.setData({ managing: !this.data.managing, selectedIds: [] })
    this.refresh()
  },
  open(event) {
    const id = event.currentTarget.dataset.id
    if (this.data.managing) {
      const selectedIds = this.data.selectedIds.includes(id)
        ? this.data.selectedIds.filter(value => value !== id) : this.data.selectedIds.concat(id)
      this.setData({ selectedIds })
      this.refresh()
      return
    }
    wx.navigateTo({ url: '/pages/design-detail/index?id=' + encodeURIComponent(id) })
  },
  edit(event) {
    wx.navigateTo({ url: '/pages/design/design?id=' + encodeURIComponent(event.currentTarget.dataset.id) })
  },
  selectAll() {
    const all = this.data.records.length === this.data.selectedIds.length
    this.setData({ selectedIds: all ? [] : this.data.records.map(record => record.id) })
    this.refresh()
  },
  remove(event) { this.setData({ deleteIds: [event.currentTarget.dataset.id] }) },
  removeSelected() { if (this.data.selectedIds.length) this.setData({ deleteIds: this.data.selectedIds.slice() }) },
  closeDelete() { this.setData({ deleteIds: [] }) },
  confirmDelete() {
    try {
      deleteDesigns(this.data.deleteIds)
      this.closeDelete()
      this.refresh()
    } catch (_) {
      wx.showToast({ title: this.data.t.saveError, icon: 'none' })
    }
  },
  upload() { wx.reLaunch({ url: '/pages/fabric/fabric?upload=1' }) },
  stop() {}
})
