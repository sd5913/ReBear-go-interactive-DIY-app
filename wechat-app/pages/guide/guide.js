const copy={zh:{title:'制作指南',heading:'你的小熊已经设计好了！',intro:'先查看图纸与布料对应关系，再开始制作。',list:'裁剪清单 · 数量仅作交互演示',parts:['头部','身体','耳朵','手臂','腿部'],fabric:'布料',open:'缝制指导 ＋ 展开',close:'缝制指导 − 收起',steps:['01  对照布料标记与裁片编号','02  正面相对缝合，预留翻口','03  翻面填充后封口，连接各部位'],note:'示例纸样 · 不可打印 · 缝份以正式纸样为准。',edit:'返回修改设计',finish:'完成查看',done:'本次设计已保存在本机，可随时回来修改。',ok:'知道了',home:'返回首页'},en:{title:'Making Guide',heading:'Your bear design is ready!',intro:'Check the fabric assignments before you begin.',list:'Cutting checklist · Demo quantities',parts:['Head','Body','Ears','Arms','Legs'],fabric:'Fabric',open:'Sewing Guide ＋ Expand',close:'Sewing Guide − Collapse',steps:['01  Match fabric labels to pattern pieces','02  Sew right sides together, leaving a turning opening','03  Turn, stuff, close the opening and attach the parts'],note:'Illustrative pattern only. Not printable or to scale. Use a verified pattern for seam allowances.',edit:'Edit Design',finish:'Finish Review',done:'Your design is saved on this device. You can return to edit it anytime.',ok:'Got it',home:'Back to Home'}};
Object.assign(copy.zh,{stepsLabel:['01 准备布料','02 拼布设计','03 制作指南'],heading:'你的小熊，已经设计好啦！',intro:'先看图纸与布料对应关系，再开始下一段陪伴。',list:'裁剪清单 · 小熊的布料档案',finishTitle:'小熊的下一段故事，交给你啦。',stay:'知道了，继续看指南',finish:'完成查看 ✓'});Object.assign(copy.en,{stepsLabel:['01 Fabric','02 Patchwork','03 Guide'],heading:'Your bear is ready for a new story!',intro:'Check the pattern and fabric assignments before the next chapter.',list:'Cutting Checklist · Your Bear’s Fabrics',finishTitle:'Your bear’s next chapter is yours.',stay:'Got It · Keep Reading',finish:'Finish Review ✓'});
const { getLanguage } = require('../../utils/i18n')
const saveCopy = require('../../utils/design-copy')
const { getModel, draftKey, activeModelId, migrateModelDesign } = require('../../utils/model-catalog')
const { findDesign, designView, saveDesign, isComplete } = require('../../utils/design-records')

Page({
  data: {t: copy.zh, saveText: saveCopy.zh, modelId: 'bear', pattern: '/assets/pattern-demo.png', rows: [], expanded: false, finished: false, name: '', saving: false, error: '', complete: false},
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
      const model = getModel(record ? record.modelId : (options.model || activeModelId()))
      this.setData({name: record ? record.name : model.id === 'cushion' ? (language === 'en' ? 'My Patchwork Cushion' : '我的拼布坐垫') : model.id === 'rabbit' ? (language === 'en' ? 'My Patchwork Rabbit' : '我的拼布小兔') : model.id === 'cat' ? (language === 'en' ? 'My Patchwork Cat' : '我的拼布小猫') : saveText.defaultName})
      this.loadDesign({
        design: record ? record.design : wx.getStorageSync(draftKey(model.id)) || {},
        fabrics: record ? record.fabrics : wx.getStorageSync('rebear-fabrics') || [],
        modelId: model.id
      })
      const channel = this.getOpenerEventChannel()
      if (channel && channel.on) channel.on('design', payload => this.loadDesign(payload))
    } catch (_) {
      this.setData({error: saveText.missing})
    }
  },
  loadDesign(payload) {
    const model = getModel(payload.modelId)
    this.modelId = model.id
    const t = { ...copy[this.language], parts: model.parts[this.language] }
    const saveText = { ...saveCopy[this.language] }
    if (model.id === 'cushion') {
      Object.assign(t, this.language === 'en' ? {
        heading: 'Your cushion design is ready!', list: 'Cutting Checklist · Your Cushion’s Fabrics',
        steps: ['01  Match top, bottom and the two side pieces', '02  Join the side pieces, then sew them to the top and bottom; leave a turning opening', '03  Turn, stuff and close the opening']
      } : { heading: '你的坐垫，已经设计好啦！', list: '裁剪清单 · 坐垫的布料档案',
        steps: ['01  核对上面、下面与两块侧围的布料和编号', '02  拼接侧围，再与上下面缝合，预留翻口', '03  翻面、填充，再封闭翻口'] })
      Object.assign(saveText, this.language === 'en' ? { saveTitle: 'Save Cushion Design', incomplete: 'Confirm all cushion parts first.' } : { saveTitle: '保存坐垫方案', incomplete: '请先确认坐垫的全部部位。' })
    } else if (model.id === 'rabbit') {
      Object.assign(t, this.language === 'en' ? {
        heading: 'Your rabbit design is ready!', list: 'Cutting Checklist · Your Rabbit’s Fabrics',
        steps: ['01  Match the front and back of the head and body, plus all four ear panels', '02  Sew matching panels right sides together and leave a turning opening', '03  Turn, stuff and assemble the rabbit, then close the opening']
      } : { heading: '你的小兔，已经设计好啦！', list: '裁剪清单 · 小兔的布料档案',
        steps: ['01  核对头部、身体正反面和四片耳朵的布料编号', '02  对应裁片正面相对缝合，并预留翻口', '03  翻面填充、组装小兔，再封闭翻口'] })
      Object.assign(saveText, this.language === 'en' ? { saveTitle: 'Save Rabbit Design', incomplete: 'Confirm all rabbit parts first.' } : { saveTitle: '保存小兔方案', incomplete: '请先确认小兔的全部部位。' })
    } else if (model.id === 'cat') {
      Object.assign(t, this.language === 'en' ? {
        heading: 'Your cat design is ready!', list: 'Cutting Checklist · Your Cat’s Fabrics',
        steps: ['01  Match the front and back of the head and body', '02  Sew each pair right sides together, leaving a turning opening', '03  Turn, stuff the head and body, then close and assemble'],
        finishTitle: 'Your cat’s next chapter is yours.', stay: 'Got It · Keep Reading', finish: 'Finish Review ✓'
      } : { heading: '你的小猫，已经设计好啦！', list: '裁剪清单 · 小猫的布料档案',
        steps: ['01  核对头部和身体正反面的布料与编号', '02  正面相对缝合对应裁片，并预留翻口', '03  翻面填充头部和身体，再封口组装'],
        finishTitle: '小猫的下一段故事，交给你啦。', stay: '知道了，继续看指南', finish: '完成查看 ✓' })
      Object.assign(saveText, this.language === 'en' ? { saveTitle: 'Save Cat Design', incomplete: 'Confirm both cat parts first.' } : { saveTitle: '保存小猫方案', incomplete: '请先确认小猫的全部部位。' })
    }
    this.design = migrateModelDesign(JSON.parse(JSON.stringify(payload.design)), model.id)
    this.fabrics = payload.fabrics
    this.setData({
      t, saveText, modelId: model.id,
      pattern: model.id === 'cushion' ? '/assets/cushion-pattern.png' : model.id === 'rabbit' || model.id === 'cat' ? model.uvAtlas : '/assets/pattern-demo.png',
      rows: designView(this.design, this.fabrics, t.parts, saveText.fabric, model.id).rows,
      complete: isComplete(this.design, this.fabrics, model.id), error: ''
    })
  },
  toggle() { this.setData({expanded: !this.data.expanded}) },
  edit() {
    const pages = getCurrentPages()
    const previous = pages[pages.length - 2]
    if (previous && /(?:^|\/)pages\/design\/design$/.test(previous.route || '')) wx.navigateBack()
    else wx.navigateTo({url: '/package-design/pages/design/design?model=' + this.modelId + (this.id ? '&id=' + encodeURIComponent(this.id) : '')})
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
      const record = saveDesign(name, this.design, this.fabrics, this.id, this.modelId)
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
