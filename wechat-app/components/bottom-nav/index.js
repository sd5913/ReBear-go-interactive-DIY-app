Component({
  properties: { active: String, language: { type: String, value: 'zh' } },
  data: {
    labels: { zh: ['首页', '布料库', '设计稿'], en: ['Home', 'Fabrics', 'Designs'] },
    items: [{ id: 'home', icon: '⌂' }, { id: 'fabric', icon: '✂' }, { id: 'designs', icon: '▤' }]
  },
  methods: {
    navigate(event) {
      const destination = event.currentTarget.dataset.id
      if (destination === this.data.active) return
      const routes = { home: '/pages/index/index', fabric: '/pages/fabric/fabric', designs: '/pages/designs/index' }
      wx.reLaunch({ url: routes[destination] })
    }
  }
})
