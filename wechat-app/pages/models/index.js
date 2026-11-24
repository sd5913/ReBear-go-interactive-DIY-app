const { getLanguage } = require('../../utils/i18n')
const { models, getModel, activeModelId } = require('../../utils/model-catalog')

const copy = {
  zh: { title: '拼布设计', steps: ['01 准备布料', '02 拼布设计', '03 制作指南'], heading: '选一个来设计', hint: '选择模型，进行下一步设计。', pieces: '个裁片', difficulty: '难度', start: '选模型，开始设计', selected: '已选择', missing: '请先回布料库选择布料', error: '暂时无法打开，请重试' },
  en: { title: 'Patchwork Design', steps: ['01 Fabric', '02 Patchwork', '03 Guide'], heading: 'Choose a model', hint: 'Select a model to start designing.', pieces: ' pieces', difficulty: 'Difficulty ', start: 'Design with This Model', selected: 'Selected', missing: 'Choose a fabric in your library first', error: 'Could not open the design. Try again.' }
}

Page({
  data: { language: 'zh', t: copy.zh, models: [], selectedId: '', opening: false },
  onLoad() {
    const language = getLanguage()
    this.setData({ language, t: copy[language], selectedId: activeModelId(), models: models.map(model => ({
      id: model.id, name: model.names[language], thumbnail: model.thumbnail,
      count: model.faces.reduce((sum, ids) => sum + ids.length, 0), difficulty: model.difficulty
    })) })
    wx.setNavigationBarTitle({ title: copy[language].title })
    const channel = this.getOpenerEventChannel()
    if (channel && typeof channel.on === 'function') {
      channel.on('selectedFabrics', ({ ids }) => { this.selectedIds = ids })
    }
  },
  select(event) {
    if (!this.data.opening) this.setData({ selectedId: event.currentTarget.dataset.id })
  },
  fabrics() { wx.reLaunch({ url: '/pages/fabric/fabric' }) },
  start() {
    if (this.data.opening || !this.data.selectedId) return
    const model = getModel(this.data.selectedId)
    let fabrics = []
    try { fabrics = wx.getStorageSync('rebear-fabrics') || [] } catch (_) {}
    const ids = (this.selectedIds || [])
      .filter(id => fabrics.some(fabric => fabric.id === id))
    if (!ids.length) { wx.showToast({ title: this.data.t.missing, icon: 'none' }); return }
    this.setData({ opening: true })
    wx.navigateTo({
      url: '/package-design/pages/design/design?model=' + model.id,
      success: page => {
        try { wx.setStorageSync('rebear-active-model', model.id) } catch (_) {}
        page.eventChannel.emit('selectedFabrics', { ids })
      },
      fail: () => wx.showToast({ title: this.data.t.error, icon: 'none' }),
      complete: () => this.setData({ opening: false })
    })
  }
})
