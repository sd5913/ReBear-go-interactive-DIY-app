const copy = require('./copy')
const demo = require('./demo')
const { currentAssignment, photoPrompt } = require('./assignments')

const SAMPLE_MODEL_LIMIT = 25 * 1024 * 1024

Page({
  data: {
    t: copy.zh, mode: 'sample', stage: 'photo', rows: [], complete: false,
    photoSrc: '', modelSrc: '', showViewer: false, modelStatus: '', modelError: '',
    viewSize: 320, pixelSize: 640, exporting: false
  },

  onLoad() {
    const lang = wx.getStorageSync('rebear-language') === 'en' ? 'en' : 'zh'
    const t = copy[lang]
    const fabrics = wx.getStorageSync('rebear-fabrics')
    const design = wx.getStorageSync('rebear-design') || {}
    this.assignment = currentAssignment(Array.isArray(fabrics) ? fabrics : [], design)
    this.custom = { photo: '', model: '' }
    const screen = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const viewSize = Math.min(420, screen.windowWidth - 40)
    this.setData({ t, viewSize, pixelSize: Math.round(viewSize * Math.min(2, screen.pixelRatio || 1)) })
    wx.setNavigationBarTitle({ title: t.title })
    this.selectMode('sample')
  },

  onUnload() {
    this.closed = true
    clearTimeout(this.modelTimer)
  },

  selectMode(mode) {
    const t = this.data.t
    const isSample = mode === 'sample'
    const rows = isSample ? demo.fabricByPart.map(i => ({
      fabrics: [Object.assign({}, demo.fabrics[i], { ref: 'F' + (i + 1), name: t.sampleFabrics[i], pieces: [] })]
    })) : this.assignment.rows
    const files = isSample ? demo : this.custom
    clearTimeout(this.modelTimer)
    this.setData({
      mode, stage: 'photo', showViewer: false, photoSrc: files.photo, modelSrc: files.model,
      rows: rows.map((row, i) => ({ part: t.parts[i], fabrics: row.fabrics })),
      complete: isSample || this.assignment.complete
    })
  },

  switchMode(event) {
    const mode = event.currentTarget.dataset.mode
    if (mode !== this.data.mode) this.selectMode(mode)
  },

  switchStage(event) {
    const stage = event.currentTarget.dataset.stage
    if (stage === this.data.stage) return
    clearTimeout(this.modelTimer)
    this.setData({ stage, showViewer: false })
    if (stage === 'model' && this.data.modelSrc) this.startViewer()
  },

  startViewer() {
    clearTimeout(this.modelTimer)
    if (typeof wx.getXrFrameSystem !== 'function') {
      this.setData({ showViewer: false, modelStatus: 'error', modelError: this.data.t.noXR })
      return
    }
    this.setData({ showViewer: false, modelStatus: 'loading', modelError: '' }, () => {
      if (this.closed || this.data.stage !== 'model') return
      this.setData({ showViewer: true })
      this.modelTimer = setTimeout(() => this.failViewer(this.data.t.loadTimeout), 18000)
    })
  },

  viewerLoaded() {
    clearTimeout(this.modelTimer)
    if (this.data.stage === 'model' && this.data.showViewer) this.setData({ modelStatus: 'ready' })
  },

  viewerFailed() {
    this.failViewer(this.data.t.loadFail)
  },

  failViewer(message) {
    clearTimeout(this.modelTimer)
    if (!this.closed && this.data.stage === 'model') {
      this.setData({ modelStatus: 'error', showViewer: false, modelError: message })
    }
  },

  openPhoto() {
    const url = this.data.photoSrc
    if (url) wx.previewImage({ current: url, urls: [url] })
  },

  importPhoto() {
    if (this.data.mode !== 'mine' || !this.data.complete) return
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album'],
      success: result => {
        const file = result.tempFiles[0]
        if (!file || this.closed || this.data.mode !== 'mine') return
        this.custom = { photo: file.tempFilePath, model: '' }
        this.setData({ photoSrc: this.custom.photo, modelSrc: '', stage: 'photo', showViewer: false })
      },
      fail: error => {
        if (!this.closed && !/cancel/i.test(error.errMsg || '')) this.toast(this.data.t.tooLarge)
      }
    })
  },

  importModel() {
    if (this.data.mode !== 'mine' || !this.custom.photo) return
    const photo = this.custom.photo
    wx.chooseMessageFile({
      count: 1, type: 'file', extension: ['glb'],
      success: result => {
        const file = result.tempFiles[0]
        if (!file || !/\.glb$/i.test(file.name || '') || file.size < 20 || file.size > SAMPLE_MODEL_LIMIT) {
          this.toast(this.data.t.wrongFile)
          return
        }
        wx.getFileSystemManager().readFile({
          filePath: file.path, position: 0, length: 12,
          success: ({ data }) => {
            const header = new DataView(data)
            if (header.byteLength < 12 || header.getUint32(0, true) !== 0x46546c67 ||
                header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== file.size) {
              this.toast(this.data.t.wrongFile)
              return
            }
            if (this.closed || this.data.mode !== 'mine' || photo !== this.custom.photo) return
            this.custom.model = file.path
            this.setData({ modelSrc: file.path, stage: 'model' })
            this.startViewer()
          },
          fail: () => this.toast(this.data.t.wrongFile)
        })
      },
      fail: error => {
        if (!this.closed && !/cancel/i.test(error.errMsg || '')) this.toast(this.data.t.wrongFile)
      }
    })
  },

  copyPrompt() {
    if (this.data.complete) wx.setClipboardData({ data: photoPrompt(this.assignment.rows) })
  },

  async exportBoard() {
    if (this.data.exporting || !this.data.complete) return
    this.setData({ exporting: true })
    wx.showLoading({ title: this.data.t.creatingBoard, mask: true })
    try {
      const canvas = await new Promise((resolve, reject) => {
        this.createSelectorQuery().select('#fabric-sheet').fields({ node: true }).exec(rows => {
          if (rows && rows[0] && rows[0].node) resolve(rows[0].node)
          else reject(new Error('canvas'))
        })
      })
      const swatches = this.assignment.swatches
      const images = await Promise.all(swatches.map(swatch => new Promise((resolve, reject) => {
        const image = canvas.createImage()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = swatch.image
      })))
      canvas.width = 760
      canvas.height = 88 + Math.ceil(images.length / 3) * 220
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fffbf2'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#4d3429'
      ctx.font = 'bold 32px sans-serif'
      ctx.fillText(this.data.t.boardName, 28, 54)
      images.forEach((image, index) => {
        const x = 28 + (index % 3) * 240
        const y = 76 + Math.floor(index / 3) * 220
        const scale = Math.min(216 / image.width, 172 / image.height)
        const width = image.width * scale
        const height = image.height * scale
        ctx.fillStyle = '#f0e8dc'
        ctx.fillRect(x, y, 216, 172)
        ctx.drawImage(image, x + (216 - width) / 2, y + (172 - height) / 2, width, height)
        ctx.fillStyle = '#4d3429'
        ctx.font = 'bold 24px sans-serif'
        ctx.fillText(swatches[index].ref, x, y + 200)
      })
      const url = await new Promise((resolve, reject) => wx.canvasToTempFilePath({
        canvas, fileType: 'png', success: result => resolve(result.tempFilePath), fail: reject
      }, this))
      if (!this.closed) wx.previewImage({ current: url, urls: [url] })
    } catch (_) {
      this.toast(this.data.t.boardError)
    } finally {
      wx.hideLoading()
      if (!this.closed) this.setData({ exporting: false })
    }
  },

  toast(title) {
    if (!this.closed) wx.showToast({ title, icon: 'none' })
  }
})
