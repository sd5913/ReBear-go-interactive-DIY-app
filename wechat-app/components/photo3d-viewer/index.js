Component({
  properties: {
    src: String
  },
  methods: {
    assetsLoaded() {
      this.triggerEvent('loaded')
    },
    assetFailed() {
      this.triggerEvent('failed')
    }
  }
})
