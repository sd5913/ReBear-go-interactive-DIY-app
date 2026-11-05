const text={
 zh:{welcome:'你好！我是Rebear，让我来教你如何上传布料吧！',hello:'Rebear 的上传小课堂',start:'开始导览',next:'下一步',done:'开始上传',previous:'上一步',skip:'跳过导览',close:'关闭导览',counter:'上传布料指南',steps:[{title:'添加你的旧衣服',body:'点击添加旧衣服，拍照或上传你喜欢的布料！',hint:'拍照或从相册选择，都可以。'},{title:'准备一张 A4 纸',body:'请找出一张A4纸，和衣服一起平铺在一个平面上！随后拍下照片。',hint:'布料单层铺平，A4 纸四个角完整入镜，纸张不要遮住布料。'},{title:'先框出 A4 纸',body:'使用选框选出A4纸的范围！注意长短边对应哦！',hint:'红色短边对应 21 cm，蓝色长边对应 29.7 cm；拖动顶点贴合纸角。'},{title:'再框出可用布料',body:'拖动选框，标出你想使用的布料范围！我们就知道你布料的尺寸啦！',hint:'避开破损、纽扣和厚接缝。保存前可用尺子核对估算尺寸。'}]},
 en:{welcome:'Hi! I’m Rebear. Let me show you how to upload your fabric!',hello:'A little lesson with Rebear',start:'Start the Guide',next:'Next',done:'Start Uploading',previous:'Back',skip:'Skip Guide',close:'Close Guide',counter:'Fabric Upload Guide',steps:[{title:'Add your old clothing',body:'Tap Add Clothing to take a photo or upload fabric you love!',hint:'Use your camera or choose a photo from your album.'},{title:'Prepare an A4 sheet',body:'Find an A4 sheet and lay it flat beside your clothing on the same surface. Then take a photo!',hint:'Lay the fabric in a single layer. Keep all four paper corners visible and do not cover the fabric.'},{title:'Frame the A4 sheet first',body:'Use the frame to select the A4 sheet. Match the short and long edges!',hint:'Red short edges are 21 cm; blue long edges are 29.7 cm. Drag each corner onto the paper.'},{title:'Frame your usable fabric',body:'Move the frame to mark the fabric you want to use. Now we can estimate its dimensions!',hint:'Avoid damage, buttons and thick seams. Check the estimated size with a ruler before saving.'}]}
};
Component({
 properties:{visible:{type:Boolean,value:false},language:{type:String,value:'zh'}},
 data:{step:0,t:text.zh,artRoot:'/assets/upload-guide/'},
 observers:{'visible, language':function(visible,language){this.setData({t:text[language==='en'?'en':'zh']});if(visible)this.setData({step:0})}},
 methods:{
 stop(){},
 next(){if(this.data.step<4){this.setData({step:this.data.step+1});return}this.triggerEvent('complete')},
 previous(){this.setData({step:Math.max(0,this.data.step-1)})},
 skip(){this.triggerEvent('skip')}
 }
});
