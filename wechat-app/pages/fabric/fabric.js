const texts = {
 zh: {title:'添加布料',editTitle:'编辑可用布料',heading:'准备你的小熊布料',empty:'还没有布料',emptyHint:'先添加一件不再穿的旧衣服。',add:'+ 添加旧衣服',edit:'编辑',remove:'删除',fabric:'布料',preview:'预览小熊',disabled:'预览小熊（先保存至少一块布料）',mark:'标记可以裁剪的区域',hint:'拖动虚线框选择位置，填写实际测量的宽高。',replace:'替换照片',width:'实际宽度 (cm)',height:'实际高度 (cm)',save:'保存布料',cancel:'取消编辑',deleteTitle:'删除布料？',deleteHint:'删除后无法恢复。',confirm:'删除',invalid:'请输入有效的宽高（大于 0）',error:'操作失败，请重试',next:'布料已准备好，下一步接入小熊部位与裁片选择。',ok:'知道了',region:'选区大小',storage:'本地空间不足，未能保存。'},
 en: {title:'Add Fabric',editTitle:'Edit Fabric',heading:'Prepare fabric for your bear',intro:'Add a photo of old clothing and enter its usable dimensions.',empty:'No fabric yet',emptyHint:'Start with a piece of clothing you no longer wear.',add:'+ Add Clothing',edit:'Edit',remove:'Delete',fabric:'Fabric',preview:'Preview Bear',disabled:'Save at least one fabric to continue',mark:'Mark the usable area',hint:'Drag the box to position it, then enter the measured dimensions.',replace:'Replace Photo',width:'Actual width (cm)',height:'Actual height (cm)',save:'Save Fabric',cancel:'Cancel',deleteTitle:'Delete fabric?',deleteHint:'This cannot be undone.',confirm:'Delete',invalid:'Enter a width and height greater than 0',error:'Something went wrong. Please try again.',next:'Your fabric is ready. Bear parts and pattern selection are coming next.',ok:'Got it',region:'Selection size',storage:'Not enough local storage. Fabric was not saved.'}
}
Object.assign(texts.zh,{steps:['01 准备布料','02 拼布设计','03 制作指南'],heading:'上传您的旧衣服',empty:'还没有布料呢~',emptyHint:'添加一件旧衣服，让它继续陪伴你',preview:'布料准备好，去设计小熊 →',disabled:'布料准备好，去设计小熊 →',mark:'留下可以裁剪的这一块。',hint:'拖动选区，再填写这块布实际量出的宽高。',save:'保存这块布料 ✓',sample:'先用示例布料试一试',sampleMore:'再试一块示例格纹布',saved:'已保存',measure:'照片无法代替实际测量。请用尺子量出选区对应的真实宽高。',photoTitle:'把你的旧衣带进来',photoHint:'选择一张清晰的照片，下一步标记能裁剪的区域。',camera:'拍一张衣物照片',album:'从相册中选择',keep:'保留这块布料',deleteHint:'这块布料将从本次设计中移除，分配在它上面的裁片会恢复为未摆放。',cancelSheet:'取消',sampleName:['条纹','格纹'],sizeHint:'可用区域'});
Object.assign(texts.en,{steps:['01 Fabric','02 Patchwork','03 Guide'],heading:'Old fabric. A new story.',intro:'Add a clothing photo, select usable fabric and measure it.',empty:'No fabric yet',emptyHint:'Bring a piece of clothing you no longer wear. Let its familiar pattern stay with you.',preview:'Fabric Ready · Design My Bear →',disabled:'Fabric Ready · Design My Bear →',mark:'Keep the part you can use.',hint:'Move the selection and enter its measured width and height.',save:'Save This Fabric ✓',sample:'Try a sample fabric',sampleMore:'Try a checked sample too',saved:'Saved',libraryNote:'Fabrics are numbered automatically. Edit, replace or delete them anytime. You choose what your bear will wear.',measure:'A photo cannot measure fabric. Use a ruler to measure the selected area.',photoTitle:'Bring your old clothes along',photoHint:'Choose a clear photo, then mark the usable area.',camera:'Take a Clothing Photo',album:'Choose from Album',keep:'Keep This Fabric',deleteHint:'This fabric will be removed. Pieces assigned to it will need to be placed again.',cancelSheet:'Cancel',sampleName:['Stripes','Checks'],sizeHint:'Usable area'});
Object.assign(texts.zh,{a4:'A4 估算',photoHint:'将单层布料和完整 A4 纸平铺在一起拍照，随后点选四角测量。',manual:'用尺子手动测量',a4Edit:'重新标定 A4',rangeHint:'外接范围，实际形状以选区为准'});Object.assign(texts.en,{a4:'A4 estimate',photoHint:'Photograph single-layer fabric beside a complete A4 sheet, then mark the corners to measure.',manual:'Measure Manually',a4Edit:'Recalibrate A4',rangeHint:'Bounding size; actual fabric follows the selected outline'});
Page({
 data:{guideVisible:false,guideLanguage:'zh',t:texts.zh,items:[],editing:false,sheet:'',deleteId:'',image:'',width:'',height:'',selectionSize:60,x:40,y:40},
 onLoad(){let language='zh';try{language=wx.getStorageSync('rebear-language')==='en'?'en':'zh'}catch(e){};this.setData({t:texts[language],guideLanguage:language});wx.setNavigationBarTitle({title:this.data.t.title});try{this.setData({items:wx.getStorageSync('rebear-fabrics')||[]})}catch(e){}},
 onShow(){try{this.setData({items:wx.getStorageSync('rebear-fabrics')||[]})}catch(e){}this.maybeShowUploadGuide()},
 // 每次重新进入上传页，空库就显示导览；相机/相册临时返回不重复弹。
 maybeShowUploadGuide(){
   if(this._uploadGuideShownThisVisit||this.data.guideVisible||this.data.editing||this.data.sheet)return;
   let items;try{items=wx.getStorageSync('rebear-fabrics')||[]}catch(e){return}
   if(!Array.isArray(items)||items.length)return;
   this._uploadGuideShownThisVisit=true;
   this.setData({guideVisible:true});
 },
 onUploadGuideComplete(){this.setData({guideVisible:false},()=>this.add())},
 onUploadGuideSkip(){this.setData({guideVisible:false})},
 choosePhoto(e){const manual=!!(this.data.editing||(e&&e.currentTarget&&e.currentTarget.dataset.mode==='manual'));const source=e&&e.currentTarget&&e.currentTarget.dataset.source;this.setData({sheet:''});wx.chooseMedia({count:1,mediaType:['image'],sourceType:source?[source]:['album','camera'],success:res=>{const photo=res.tempFiles[0].tempFilePath;if(manual){this.setData({image:photo,editing:true});wx.setNavigationBarTitle({title:this.data.t.editTitle});return}this.setData({editing:false,sheet:''});const suffix=this.editId?'?id='+encodeURIComponent(this.editId):'';wx.navigateTo({url:'/pages/measure/measure'+suffix,success:r=>{r.eventChannel.emit('photo',{path:photo})},fail:()=>this.toast(this.data.t.error)})},fail:e=>{if(!/cancel/.test(e.errMsg||''))this.toast(this.data.t.error)}})},
 add(){this.editId=null;this.setData({width:'',height:'',image:'',selectionSize:60,x:40,y:40});this.region=null;this.setData({sheet:'photo'})},
 input(e){const update={};update[e.currentTarget.dataset.field]=e.detail.value;this.setData(update)},
 resize(e){this.region={x:0,y:0};this.setData({selectionSize:Number(e.detail.value),x:0,y:0})},
 move(e){this.region={x:e.detail.x,y:e.detail.y}},
 edit(e){const item=this.data.items.find(i=>i.id===e.currentTarget.dataset.id);if(!item)return;if(item.measurement&&item.measurement.method==='a4-four-corners'){wx.navigateTo({url:'/pages/measure/measure?id='+encodeURIComponent(item.id)});return}this.editId=item.id;this.region=item.region||{x:0,y:0};this.setData({editing:true,image:item.original||item.image,width:item.width,height:item.height,selectionSize:item.selectionSize||60,x:(item.region&&item.region.x)||0,y:(item.region&&item.region.y)||0});wx.setNavigationBarTitle({title:this.data.t.editTitle})},
 cancel(){this.setData({editing:false});wx.setNavigationBarTitle({title:this.data.t.title})},
 toast(title){wx.showToast({title,icon:'none'})},
 persist(items){try{wx.setStorageSync('rebear-fabrics',items);this.setData({items});return true}catch(e){this.toast(this.data.t.storage);return false}},
 save(){
 if(this.saving)return;const w=Number(this.data.width),h=Number(this.data.height);if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0){this.toast(this.data.t.invalid);return}
 this.saving=true;wx.showLoading({title:this.data.t.save.replace(' ✓',''),mask:true});
 const fail=()=>{this.saving=false;wx.hideLoading();this.toast(this.data.t.error)};
 const finish=(image,original)=>{const item={id:this.editId||('fabric-'+Date.now()),image,original,width:w,height:h,selectionSize:this.data.selectionSize,region:this.region||{x:this.data.x,y:this.data.y}};const old=this.data.items.find(i=>i.id===item.id);if(old&&old.name)item.name=old.name;const items=this.data.items.some(i=>i.id===item.id)?this.data.items.map(i=>i.id===item.id?item:i):this.data.items.concat(item);const ok=this.persist(items);this.saving=false;wx.hideLoading();if(ok)this.cancel()};
 const persistCrop=(tmp,original)=>wx.saveFile({tempFilePath:tmp,success:r=>finish(r.savedFilePath,original),fail});
 const old=this.data.items.find(i=>i.id===this.editId);
 const keepOriginal=next=>{if(this.data.image.startsWith('/assets/')||(old&&this.data.image===(old.original||old.image))){next(this.data.image);return}wx.saveFile({tempFilePath:this.data.image,success:r=>next(r.savedFilePath),fail})};
 wx.getImageInfo({src:this.data.image,success:info=>{
 this.createSelectorQuery().select('.photo-area').boundingClientRect(rect=>{if(!rect||!rect.width||!rect.height){fail();return}const region=this.region||{x:this.data.x,y:this.data.y};const scale=this.data.selectionSize/100;const sx=Math.max(0,Math.min(1-scale,region.x/rect.width))*info.width,sy=Math.max(0,Math.min(1-scale,region.y/rect.height))*info.height;const sw=info.width*scale,sh=info.height*scale;const factor=Math.min(1,1000/Math.max(sw,sh));const cw=Math.max(1,Math.round(sw*factor)),ch=Math.max(1,Math.round(sh*factor));this.setData({canvasWidth:cw,canvasHeight:ch},()=>{const ctx=wx.createCanvasContext('cropCanvas',this);ctx.drawImage(info.path,sx,sy,sw,sh,0,0,cw,ch);ctx.draw(false,()=>{wx.canvasToTempFilePath({canvasId:'cropCanvas',width:cw,height:ch,destWidth:cw,destHeight:ch,fileType:'png',success:r=>keepOriginal(original=>persistCrop(r.tempFilePath,original)),fail},this)})})}).exec()
 },fail})
 },
 remove(e){this.setData({sheet:'delete',deleteId:e.currentTarget.dataset.id})},
 closeSheet(){this.setData({sheet:''})},
 stop(){},
 deleteConfirmed(){const id=this.data.deleteId;if(!this.persist(this.data.items.filter(i=>i.id!==id)))return;try{const d=wx.getStorageSync('rebear-design')||{};Object.keys(d).forEach(k=>{if(d[k].pieces.some(p=>p.fabricId===id)){d[k].pieces=d[k].pieces.filter(p=>p.fabricId!==id);d[k].confirmed=false}});wx.setStorageSync('rebear-design',d)}catch(e){}this.closeSheet()},
 sample(){const id='sample-stripes';if(!this.data.items.some(i=>i.id===id)){this.persist(this.data.items.concat({id,image:'/assets/sample-stripes.png',width:38,height:42,name:this.data.t.sampleName[0],selectionSize:100}))}this.closeSheet()},
 preview(){if(this.data.items.length)wx.navigateTo({url:'/pages/design/design'})}
})
