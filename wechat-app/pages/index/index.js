const messages = {
  zh: {
  caption: '小熊示例 / 3D 效果占位',
    
    description: '用你自己的布料，创造专属小熊。',
    start: '开始制作',
    
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
  try { return wx.getStorageSync(storageKey) === 'zh' ? 'zh' : 'en' }
  catch (_) { return 'en' }
}
function saveLanguage(language) {
  try { wx.setStorageSync(storageKey, language) } catch (_) {}
}
const i18n = { messages, getLanguage, saveLanguage }
const { getModel, activeModelId, draftKey } = require('../../utils/model-catalog')
const { isComplete } = require('../../utils/design-records')


Object.assign(i18n.messages.zh,{description:'一块旧布，也能有新的陪伴。',start:'开始制作',prepare:'准备布料',story:'把故事缝进小熊',home:'首页',studio:'制作工坊',guide:'制作指南',badge:'小熊营业中 ♡',aboutTitle:'旧衣新生计划',about:'把舍不得的旧衣，做成可以陪伴你的小熊。先准备布料，再设计拼布，最后查看制作指南。',notReady:'先完成小熊的五个部位设计，就能查看对应清单。'});
Object.assign(i18n.messages.en,{headline:'Turn treasured clothes\ninto memories to hold.',description:'Old fabric, a new companion.',start:'Start Creating My Bear →',note:'No sign-in needed. Bring a piece of old clothing.',prepare:'Prepare Your Fabric',prepareHint:'Add a photo · Select · Measure',story:'Sew in Your Story',storyHint:'Old fabric, a new companion',home:'Home',studio:'Workshop',guide:'Making Guide',badge:'Bear workshop is open ♡',aboutTitle:'Give Clothes a New Life',about:'Turn treasured clothing into a bear. Prepare your fabric, design each part, then explore the making guide.',notReady:'Finish designing all five parts to view your checklist.'});
Object.assign(i18n.messages.zh, {
  headline: '旧衣服，新的陪伴', tagline: '把熟悉的布料，变成自己的小熊。', start: '开启新故事',
  note: '拍摄或选择一张旧衣照片', photoTitle: '上传布料', photoHint: '选择照片，标记布料并测量尺寸。',
  camera: '拍摄照片', album: '从相册选择', sample: '使用示例照片', cancelSheet: '取消', error: '操作失败，请重试'
});
Object.assign(i18n.messages.en, {
  start: 'Start a New Story', note: 'Take or choose a photo of old clothing', photoTitle: 'Upload Fabric',
  photoHint: 'Choose a photo, mark the fabric and measure it.', camera: 'Take a Photo', album: 'Choose from Album',
  sample: 'Use a Sample', cancelSheet: 'Cancel', error: 'Something went wrong. Please try again.'
});
Page({
  data: { language: 'en', t: i18n.messages.en, sheet: false, photoBusy: false },
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
  guide(){const model=getModel(activeModelId());let d={},f=[];try{d=wx.getStorageSync(draftKey(model.id))||{};f=wx.getStorageSync('rebear-fabrics')||[]}catch(e){};if(isComplete(d,f,model.id))wx.navigateTo({url:'/pages/guide/guide?model='+model.id});else wx.showToast({title:this.data.language==='en'?'Confirm all model parts first.':'请先完成并确认模型的全部部位。',icon:'none'})},
  startMaking() {
    if(this.data.photoBusy)return;
    this.setData({sheet:true});
  },
  closeSheet() { this.setData({ sheet: false }) },
  stop() {},
  sample() {
    if(this.data.photoBusy)return;
    this.closeSheet()
    wx.navigateTo({ url: '/pages/fabric/fabric?sample=1' })
  },
  choosePhoto(event) {
    if(this.data.photoBusy)return;
    this.setData({photoBusy:true});
    const finish=()=>this.setData({photoBusy:false});
    const fail=error=>{
      finish();
      if(!/cancel/i.test(error.errMsg||''))wx.showToast({title:this.data.t.error,icon:'none'});
    };
    const selected=path=>{
      this.closeSheet();
      wx.showLoading({title:this.data.language==='en'?'Opening photo':'正在打开照片',mask:true});
      wx.navigateTo({
        url:'/pages/measure/measure?returnTo=fabric',
        success:page=>page.eventChannel.emit('photo',{path}),
        fail:()=>wx.showToast({title:this.data.t.error,icon:'none'}),
        complete:()=>{wx.hideLoading();finish();}
      });
    };
    const sourceType=[event.currentTarget.dataset.source];
    if(wx.chooseMedia)wx.chooseMedia({count:1,mediaType:['image'],sourceType,
      success:result=>result.tempFiles?.[0]?.tempFilePath?selected(result.tempFiles[0].tempFilePath):fail({errMsg:'Empty photo'}),fail});
    else wx.chooseImage({count:1,sourceType,success:result=>result.tempFilePaths?.[0]?selected(result.tempFilePaths[0]):fail({errMsg:'Empty photo'}),fail});
  }
})
