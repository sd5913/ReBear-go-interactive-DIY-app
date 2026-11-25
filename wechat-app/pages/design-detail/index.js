const copy = require('../../utils/design-copy')
const { getLanguage } = require('../../utils/i18n')
const { findDesign, designView, displayDate } = require('../../utils/design-records')
const { getModel } = require('../../utils/model-catalog')

Page({
  data: { t: copy.zh, language: 'zh', record: null, rows: [], materials: [], assignments: {}, error: '' },
  onLoad(options) { this.id = options.id },
  onShow() {
    const language = getLanguage()
    const t = copy[language]
    wx.setNavigationBarTitle({ title: t.detail })
    try {
      const record = findDesign(this.id)
      if (!record) throw new Error('Missing record')
      const model = getModel(record.modelId)
      this.setData({ t, language, record, modelId: model.id, modelName: model.names[language], date: displayDate(record.updatedAt), ...designView(record.design, record.fabrics, model.parts[language], t.fabric, model.id), error: '' })
    } catch (_) { this.setData({ t, language, record: null, error: t.missing }) }
  },
  guide() { wx.navigateTo({ url: '/package-sewing/pages/guide/index?id=' + encodeURIComponent(this.id) }) },
  back() { wx.reLaunch({ url: '/pages/designs/index' }) },
  stop() {}
})
