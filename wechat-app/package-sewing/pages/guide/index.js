const { getLanguage } = require('../../../utils/i18n')
const { findDesign, designView } = require('../../../utils/design-records')
const { getModel, pieceMask } = require('../../../utils/model-catalog')
const { fabricDimensions } = require('../../../utils/seam-allowance')
const { pieceSeams } = require('../../../utils/pattern-placement')

const copy = {
  zh: {
    title: '缝纫指导', heading: '跟着步骤，把小熊缝起来', subtitle: '慢慢来，每一步都很简单。',
    stages: ['预览', '裁剪', '缝合', '填充', '收口'],
    titles: ['预览图纸与布料', '确认并裁剪布片', '缝合耳朵、身体与头部', '各部件填充珍珠棉', '最终组装'],
    descriptions: ['查看确认图纸与布料的对应关系。', '先按照纸样检查各个部位，正反面不要放错，进行裁剪。',
      '两片布料正面相对，沿边缘缝合，记得留翻口。', '翻口用藏针法缝合', '胳膊和腿分别用纽扣贯穿缝固定'],
    next: ['下一步：裁剪布片  ›', '下一步：部件缝合  ›', '下一步：填充棉花  ›', '下一步：收口组装  ›', '完成！'],
    previous: '上一步', view: '查看', modalTitle: '按照对应位置裁剪', fabric: '布料', close: '关闭',
    missing: '找不到此设计，请返回设计库。', back: '返回设计库', finishTitle: '制作指南已完成',
    finishText: '可以随时从设计详情重新打开指南。', confirm: '完成'
  },
  en: {
    title: 'Sewing Guide', heading: 'Let’s sew your bear together', subtitle: 'Take your time, one step at a time.',
    stages: ['Preview', 'Cut', 'Sew', 'Stuff', 'Close'],
    titles: ['Review patterns and fabrics', 'Check and cut the pieces', 'Sew ears, body and head', 'Stuff each part', 'Final assembly'],
    descriptions: ['Check how each pattern matches your fabrics.', 'Check each piece and its right and wrong sides before cutting.',
      'Place right sides together and sew, leaving a turning opening.', 'Close the openings with a ladder stitch.', 'Secure the arms and legs with button joints.'],
    next: ['Next: cut the pieces  ›', 'Next: sew the parts  ›', 'Next: add stuffing  ›', 'Next: close and assemble  ›', 'Finish!'],
    previous: 'Previous', view: 'View', modalTitle: 'Cut at the assigned positions', fabric: 'Fabric', close: 'Close',
    missing: 'This design is unavailable. Return to your designs.', back: 'Back to Designs', finishTitle: 'Guide complete',
    finishText: 'You can reopen this guide from the design details at any time.', confirm: 'Done'
  }
}
const images = ['pattern', 'cut', 'sew', 'stuff', 'assemble']
const progressWidths = [52, 86, 124, 223, 286].map(width => width / 346 * 100)

Page({
  data: { t: copy.zh, language: 'zh', record: null, step: 0, materials: [], selectedMaterial: null, selectedPieces: [], selectedSeams: [], boardWidth: 0, boardHeight: 0, error: '' },
  onLoad(options) {
    const language = getLanguage()
    const t = copy[language]
    this.id = options.id
    wx.setNavigationBarTitle({ title: t.title })
    try {
      const record = findDesign(this.id)
      if (!record) throw new Error('Missing design')
      const model = getModel(record.modelId)
      const view = designView(record.design, record.fabrics, model.parts[language], t.fabric, model.id)
      this.progressKey = 'rebear-sewing-progress-' + record.id
      const saved = wx.getStorageSync(this.progressKey)
      const step = saved?.updatedAt === record.updatedAt && Number.isInteger(saved.step) ? Math.max(0, Math.min(4, saved.step)) : 0
      const window = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const topInset = window.statusBarHeight || 0
      // Leave the WeChat capsule its own top row on custom navigation pages.
      this.setData({
        t, language, record, modelId: model.id, materials: view.materials,
        topInset,
        brandText: language === 'en' ? 'MAKE YOUR ' + model.names.en.toUpperCase() : model.names.zh + '手作',
        ...(model.id === 'cushion' ? { t: { ...t,
          heading: language === 'en' ? 'Let’s sew your cushion together' : '跟着步骤，把坐垫缝起来',
          titles: language === 'en' ? ['Review patterns and fabrics', 'Check and cut the pieces', 'Join the sides, top and bottom', 'Stuff the cushion', 'Close the turning opening']
            : ['预览图纸与布料', '确认并裁剪布片', '拼接侧围与上下面', '填充坐垫', '封闭翻口'],
          descriptions: language === 'en' ? [t.descriptions[0], t.descriptions[1], 'Sew the sides to the top and bottom, leaving a turning opening.', 'Turn right side out and add stuffing.', 'Close the opening with a ladder stitch.']
            : [t.descriptions[0], t.descriptions[1], '拼接侧围，再与上下面缝合，预留翻口。', '翻到正面，填入珍珠棉。', '用藏针法封闭翻口。']
        }} : {}),
        ...(model.id === 'rabbit' ? { t: { ...t,
          heading: language === 'en' ? 'Let’s sew your rabbit together' : '跟着步骤，把小兔缝起来',
          titles: language === 'en' ? ['Review rabbit patterns', 'Check and cut the panels', 'Sew the head, body and ears', 'Stuff each part', 'Assemble and close the opening']
            : ['预览小兔裁片与布料', '确认并裁剪布片', '缝合头部、身体与耳朵', '填充各个部位', '组装并封闭翻口'],
          descriptions: language === 'en' ? [t.descriptions[0], t.descriptions[1], 'Sew the front and back panels together, matching the ear pairs.', 'Turn each piece right side out and add stuffing.', 'Attach the ears and close all openings.']
            : [t.descriptions[0], t.descriptions[1], '头部、身体和耳朵的正反面分别对应缝合。', '翻到正面，分别填入珍珠棉。', '装好耳朵，并用藏针法封闭翻口。']
        }} : {}),
        ...(model.id === 'cat' ? { t: { ...t,
          heading: language === 'en' ? 'Let’s sew your cat together' : '跟着步骤，把小猫缝起来',
          titles: language === 'en' ? ['Review the cat patterns', 'Check and cut the panels', 'Sew the head and body', 'Stuff both pieces', 'Assemble and close the openings']
            : ['预览小猫裁片与布料', '确认并裁剪布片', '缝合头部和身体', '填充头部与身体', '组装并封闭翻口'],
          descriptions: language === 'en' ? [t.descriptions[0], t.descriptions[1], 'Sew the matching front and back panels for the head and body.', 'Turn each piece right side out and add stuffing.', 'Attach the head to the body and close the openings.']
            : [t.descriptions[0], t.descriptions[1], '头部、身体的正反面裁片分别对应缝合。', '翻到正面，分别填入珍珠棉。', '将头部与身体组装，并用藏针法封闭翻口。']
        }} : {})
      })
      this.showStep(step)
    } catch (_) { this.setData({ t, language, error: t.missing }) }
  },
  showStep(step) {
    const number = String(step + 1).padStart(2, '0')
    this.setData({
      step, number, progress: progressWidths[step], selectedMaterial: null,
      stepImage: this.data.modelId === 'cushion' ? '/assets/cushion-pattern.png' : (this.data.modelId === 'rabbit' || this.data.modelId === 'cat') && step === 0 ? getModel(this.data.modelId).uvAtlas : '/package-sewing/assets/' + images[step] + '.png',
      title: this.data.t.titles[step], description: this.data.t.descriptions[step],
      nextText: this.data.t.next[step]
    })
    try { wx.setStorageSync(this.progressKey, { step, updatedAt: this.data.record.updatedAt }) } catch (_) {}
    wx.pageScrollTo({ scrollTop: 0, duration: 0 })
  },
  previous() {
    if (this.data.step === 0) this.back()
    else this.showStep(this.data.step - 1)
  },
  next() {
    if (this.data.step < 4) { this.showStep(this.data.step + 1); return }
    const t = this.data.t
    wx.showModal({
      title: t.finishTitle, content: t.finishText, showCancel: false, confirmText: t.confirm,
      success: result => { if (result.confirm) { this.showStep(0); this.back() } }
    })
  },
  openMaterial(event) {
    const material = this.data.materials[Number(event.currentTarget.dataset.index)]
    if (!material) return
    const model = getModel(this.data.modelId)
    const dimensions = fabricDimensions(material)
    const fallbackRatio = Number(material.width) / Number(material.height)
    const ratio = dimensions ? dimensions.width / dimensions.height : (Number.isFinite(fallbackRatio) && fallbackRatio > 0 ? fallbackRatio : 1)
    const window = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const unit = window.windowWidth / 750
    const maxWidth = window.windowWidth / unit - 2 * 38.46 - 2 * 29 - 4
    const maxHeight = Math.max(220, Math.min(610, window.windowHeight / unit - 430))
    const boardWidth = Math.max(180, Math.min(maxWidth, maxHeight * ratio))
    const boardHeight = boardWidth / ratio
    const selectedPieces = []
    const selectedSeams = []
    model.faces.forEach((ids, part) => {
      const pieces = this.data.record.design[part]?.pieces || []
      pieces.forEach(piece => {
        if (piece.fabricId !== material.id || !ids[piece.index]) return
        const placement = piece.placement
        if (!placement || !Array.isArray(placement.origin) || !Array.isArray(placement.axisX) || !Array.isArray(placement.axisY) ||
          ![...placement.origin, ...placement.axisX, ...placement.axisY].every(Number.isFinite)) return
        const xAxis = [placement.axisX[0] * boardWidth, placement.axisX[1] * boardHeight]
        const yAxis = [placement.axisY[0] * boardWidth, placement.axisY[1] * boardHeight]
        const slotName = model.pieceNames?.[this.data.language]?.[part]?.[piece.index]
        const pieceName = slotName || piece.label || String.fromCharCode(65 + piece.index)
        selectedPieces.push({
          id: part + '-' + piece.index,
          mask: pieceMask(model.id, part, piece.index),
          centerX: placement.origin[0] * boardWidth,
          centerY: placement.origin[1] * boardHeight,
          width: Math.hypot(xAxis[0], xAxis[1]),
          height: Math.hypot(yAxis[0], yAxis[1]),
          angle: Math.atan2(xAxis[1], xAxis[0]) * 180 / Math.PI,
          label: model.parts[this.data.language][part] + ' ' + pieceName
        })
        if (dimensions) pieceSeams(part, placement, dimensions, model.id, piece.index).forEach(path => selectedSeams.push(path))
      })
    })
    this.setData({ selectedMaterial: material, selectedPieces, selectedSeams, boardWidth, boardHeight }, () => this.drawMaterialSeams())
  },
  drawMaterialSeams() {
    if (!this.data.selectedMaterial) return
    this.createSelectorQuery().select('#material-seam-canvas').fields({ node: true, size: true }, result => {
      if (!result?.node || !result.width || !result.height) return
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const dpr = Math.min(info.pixelRatio || 1, 3)
      const canvas = result.node
      const width = Math.max(1, Math.round(result.width * dpr))
      const height = Math.max(1, Math.round(result.height * dpr))
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      context.setTransform(width / result.width, 0, 0, height / result.height, 0, 0)
      context.clearRect(0, 0, result.width, result.height)
      context.setLineDash([4, 3])
      context.lineJoin = 'round'
      context.strokeStyle = '#53605b'
      context.lineWidth = 1.25
      for (const path of this.data.selectedSeams) {
        if (!path.length) continue
        context.beginPath()
        path.forEach((point, index) => {
          const x = point.x * result.width
          const y = point.y * result.height
          if (index === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        })
        context.closePath()
        context.stroke()
      }
    }).exec()
  },
  closeMaterial() { this.setData({ selectedMaterial: null }) },
  previewImage() { wx.previewImage({ current: this.data.stepImage, urls: [this.data.stepImage] }) },
  back() {
    const previous = getCurrentPages().slice(-2)[0]
    if (previous?.route === 'pages/design-detail/index') wx.navigateBack()
    else wx.redirectTo({ url: '/pages/design-detail/index?id=' + encodeURIComponent(this.id), fail: () => this.backToDesigns() })
  },
  backToDesigns() { wx.reLaunch({ url: '/pages/designs/index' }) },
  stop() {}
})
