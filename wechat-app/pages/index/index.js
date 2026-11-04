const messages = {
  zh: {
    tagline: 'Give old clothes a new life.',
    caption: '小熊示例 / 3D 效果占位',
    headline: '让旧衣服变成\n独一无二的布偶小熊',
    description: '用你自己的布料，创造专属小熊。',
    start: '开始制作',
    note: '无需登录，即可开始',
    dialogTitle: '开始制作',
    dialogContent: '首页已完成，下一步将接入布料列表页面。',
    confirm: '知道了'
  },
  en: {
    tagline: 'Give old clothes a new life.',
    caption: 'Example bears / 3D preview placeholder',
    headline: 'Turn old clothes into\na one-of-a-kind teddy bear',
    description: 'Create your own bear with fabric that tells your story.',
    start: 'Start Creating',
    note: 'No sign-in needed to get started',
    dialogTitle: 'Start Creating',
    dialogContent: 'The home page is ready. The fabric library is coming next.',
    confirm: 'Got it'
  }
}
const storageKey = 'rebear-language'
function getLanguage() {
  try { return wx.getStorageSync(storageKey) === 'en' ? 'en' : 'zh' }
  catch (_) { return 'zh' }
}
function saveLanguage(language) {
  try { wx.setStorageSync(storageKey, language) } catch (_) {}
}
const i18n = { messages, getLanguage, saveLanguage }


Page({
  data: { language: 'zh', t: i18n.messages.zh },
  onLoad() {
    const language = i18n.getLanguage()
    this.setData({ language, t: i18n.messages[language] })
  },
  changeLanguage(event) {
    const language = event.currentTarget.dataset.language
    if (!i18n.messages[language]) return
    this.setData({ language, t: i18n.messages[language] })
    i18n.saveLanguage(language)
  },
  startMaking() {
    const t = this.data.t
    wx.navigateTo({ url: '/pages/fabric/fabric' })
  }
})
