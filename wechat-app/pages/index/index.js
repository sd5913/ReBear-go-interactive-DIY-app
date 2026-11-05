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


Object.assign(i18n.messages.zh,{headline:'把舍不得的旧衣，\n变成抱得住的回忆。',description:'一块旧布，也能有新的陪伴。',start:'开始制作我的小熊 →',note:'无需登录，带一件旧衣就可以开始。',prepare:'先把布料准备好',prepareHint:'上传旧衣 · 标记选区 · 填写尺寸',story:'把故事缝进小熊',storyHint:'一块旧布，也能有新的陪伴',home:'首页',studio:'制作工坊',guide:'制作指南',badge:'小熊营业中 ♡',aboutTitle:'旧衣新生计划',about:'把舍不得的旧衣，做成可以陪伴你的小熊。先准备布料，再设计拼布，最后查看制作指南。',notReady:'先完成小熊的五个部位设计，就能查看对应清单。'});
Object.assign(i18n.messages.en,{headline:'Turn treasured clothes\ninto memories to hold.',description:'Old fabric, a new companion.',start:'Start Creating My Bear →',note:'No sign-in needed. Bring a piece of old clothing.',prepare:'Prepare Your Fabric',prepareHint:'Add a photo · Select · Measure',story:'Sew in Your Story',storyHint:'Old fabric, a new companion',home:'Home',studio:'Workshop',guide:'Making Guide',badge:'Bear workshop is open ♡',aboutTitle:'Give Clothes a New Life',about:'Turn treasured clothing into a bear. Prepare your fabric, design each part, then explore the making guide.',notReady:'Finish designing all five parts to view your checklist.'});
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
  about(){wx.showModal({title:this.data.t.aboutTitle,content:this.data.t.about,showCancel:false,confirmText:this.data.t.confirm})},
  guide(){let d={},f=[];try{d=wx.getStorageSync('rebear-design')||{};f=wx.getStorageSync('rebear-fabrics')||[]}catch(e){};const ready=[2,2,4,2,2].every((n,i)=>d[i]&&d[i].confirmed&&d[i].pieces.length===n&&d[i].pieces.every(p=>f.some(x=>x.id===p.fabricId)));if(ready)wx.navigateTo({url:'/pages/guide/guide'});else wx.showToast({title:this.data.t.notReady,icon:'none'})},
  startMaking() {
    const t = this.data.t
    wx.navigateTo({ url: '/pages/fabric/fabric' })
  }
})
