const copy = require('../../utils/design-copy')
const { getLanguage } = require('../../utils/i18n')
const { findDesign, designView } = require('../../utils/design-records')
const { getModel } = require('../../utils/model-catalog')
Page({
  data: { t: copy.en, record: null, thumbnails: [] },
  onLoad(options) {
    this.id = options.id
    const language = getLanguage()
    const t = { ...copy[language] }
    wx.setNavigationBarTitle({ title: t.savedTitle })
    try {
      const record = findDesign(this.id)
      const model = getModel(record && record.modelId)
      if (model.id === 'cushion') t.savedHeading = language === 'en' ? 'Your cushion design is saved.' : '坐垫方案，留下来了。'
      if (model.id === 'rabbit') t.savedHeading = language === 'en' ? 'Your rabbit design is saved.' : '小兔方案，留下来了。'
      if (model.id === 'cat') t.savedHeading = language === 'en' ? 'Your cat design is saved.' : '小猫方案，留下来了。'
      this.setData({ t, record, modelId: model.id, thumbnail: record && (record.thumbnail || model.thumbnail), thumbnails: record ? designView(record.design, record.fabrics, model.parts[language], t.fabric, model.id).thumbnails : [] })
    } catch (_) { this.setData({ t }) }
  },
  view() { wx.redirectTo({ url: '/pages/design-detail/index?id=' + encodeURIComponent(this.id) }) },
  designs() { wx.reLaunch({ url: '/pages/designs/index' }) },
  home() { wx.reLaunch({ url: '/pages/index/index' }) }
})
