const copy={zh:{title:'制作指南',heading:'你的小熊已经设计好了！',intro:'先查看图纸与布料对应关系，再开始制作。',list:'裁剪清单 · 数量仅作交互演示',parts:['头部','身体','耳朵','手臂','腿部'],fabric:'布料',open:'缝制指导 ＋ 展开',close:'缝制指导 − 收起',steps:['01  对照布料标记与裁片编号','02  正面相对缝合，预留翻口','03  翻面填充后封口，连接各部位'],note:'示例纸样 · 不可打印 · 缝份以正式纸样为准。',edit:'返回修改设计',finish:'完成查看',done:'本次设计已保存在本机，可随时回来修改。',ok:'知道了',home:'返回首页'},en:{title:'Making Guide',heading:'Your bear design is ready!',intro:'Check the fabric assignments before you begin.',list:'Cutting checklist · Demo quantities',parts:['Head','Body','Ears','Arms','Legs'],fabric:'Fabric',open:'Sewing Guide ＋ Expand',close:'Sewing Guide − Collapse',steps:['01  Match fabric labels to pattern pieces','02  Sew right sides together, leaving a turning opening','03  Turn, stuff, close the opening and attach the parts'],note:'Illustrative pattern only. Not printable or to scale. Use a verified pattern for seam allowances.',edit:'Edit Design',finish:'Finish Review',done:'Your design is saved on this device. You can return to edit it anytime.',ok:'Got it',home:'Back to Home'}};
Object.assign(copy.zh,{stepsLabel:['01 准备布料','02 拼布设计','03 制作指南'],heading:'你的小熊，已经设计好啦！',intro:'先看图纸与布料对应关系，再开始下一段陪伴。',list:'裁剪清单 · 小熊的布料档案',finishTitle:'小熊的下一段故事，交给你啦。',stay:'知道了，继续看指南',finish:'完成查看 ✓'});Object.assign(copy.en,{stepsLabel:['01 Fabric','02 Patchwork','03 Guide'],heading:'Your bear is ready for a new story!',intro:'Check the pattern and fabric assignments before the next chapter.',list:'Cutting Checklist · Your Bear’s Fabrics',finishTitle:'Your bear’s next chapter is yours.',stay:'Got It · Keep Reading',finish:'Finish Review ✓'});
const { getLanguage } = require('../../utils/i18n')
const saveCopy = require('../../utils/design-copy')
const { migrateDesign } = require('../../utils/bear-layout')
const { findDesign, designView, saveDesign, isComplete } = require('../../utils/design-records')

Page({
  data: {t: copy.zh, saveText: saveCopy.zh, rows: [], expanded: false, finished: false, name: '', saving: false, error: '', complete: false},
  onLoad(options) {
    const language = getLanguage()
    this.language = language
    this.id = options.id || ''
    const t = copy[language]
    const saveText = saveCopy[language]
    this.setData({t, saveText})
    wx.setNavigationBarTitle({title: t.title})
    try {
      const record = this.id ? findDesign(this.id) : null
      if (this.id && !record) throw new Error('Missing design')
      this.setData({name: record ? record.name : saveText.defaultName})
      this.loadDesign({
        design: record ? record.design : wx.getStorageSync('rebear-design') || {},
        fabrics: record ? record.fabrics : wx.getStorageSync('rebear-fabrics') || []
      })
      const channel = this.getOpenerEventChannel()
      if (channel && channel.on) channel.on('design', payload => this.loadDesign(payload))
    } catch (_) {
      this.setData({error: saveText.missing})
    }
  },
  loadDesign(payload) {
    this.design = migrateDesign(JSON.parse(JSON.stringify(payload.design)))
    this.fabrics = payload.fabrics
    this.setData({
      rows: designView(this.design, this.fabrics, this.data.t.parts, this.data.saveText.fabric).rows,
      complete: isComplete(this.design, this.fabrics), error: ''
    })
  },
  toggle() { this.setData({expanded: !this.data.expanded}) },
  edit() {
    const pages = getCurrentPages()
    const previous = pages[pages.length - 2]
    if (previous && previous.route === 'pages/design/design') wx.navigateBack()
    else wx.navigateTo({url: '/pages/design/design' + (this.id ? '?id=' + encodeURIComponent(this.id) : '')})
  },
  finish() {
    if (!this.data.complete) {
      wx.showToast({title: this.data.saveText.incomplete, icon: 'none'})
      return
    }
    this.setData({finished: true, error: ''})
  },
  inputName(event) { this.setData({name: event.detail.value}) },
  closeFinish() { if (!this.data.saving) this.setData({finished: false, error: ''}) },
  save() {
    if (this.data.saving) return
    const name = this.data.name.trim()
    if (!name) { this.setData({error: this.data.saveText.nameRequired}); return }
    this.setData({saving: true, error: ''})
    try {
      const record = saveDesign(name, this.design, this.fabrics, this.id)
      this.id = record.id
      wx.redirectTo({
        url: '/pages/design-saved/index?id=' + encodeURIComponent(record.id),
        fail: () => this.setData({saving: false, error: this.data.saveText.saveError})
      })
    } catch (_) { this.setData({saving: false, error: this.data.saveText.saveError}) }
  },
  stop() {},
  home() { wx.reLaunch({url: '/pages/index/index'}) }
})
