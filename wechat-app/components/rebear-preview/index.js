const {createBear}=require('./engine');
const {getModel}=require('../../utils/model-catalog');

const copy={
  zh:{viewHint:'拖动小熊查看各个角度。',front:'看正面',back:'看背面',hint:'拖动小熊旋转，也可以把下方布料拖到熊身上。',error:'3D 预览暂时无法开启，仍可继续摆放裁片。',texture:'有布料图片无法加载，请返回布料页检查照片。'},
  en:{viewHint:'Drag the bear to view it from different angles.',front:'Front',back:'Back',hint:'Drag the bear to rotate it, or drag a fabric onto it.',error:'3D preview is unavailable. You can still place pattern pieces.',texture:'A fabric image could not be loaded. Check the photo on the fabric page.'}
};

Component({
  properties:{
    modelId:{type:String,value:'bear',observer(){this.updateCopy();if(this.canvas)this.loadModel();}},
    readOnly:{type:Boolean,value:false},
    immersive:{type:Boolean,value:false},
    selectable:{type:Boolean,value:false},
    suspend:{type:Boolean,value:false},
    selectedPart:{type:Number,value:-1,observer(){this.updateSelectedGroup();}},
    confirmed:{type:Boolean,value:false,observer(){this.updateSelectedGroup();}},
    canConfirm:{type:Boolean,value:false},
    canSave:{type:Boolean,value:false},
    fabrics:{type:Array,value:[]},
    assignments:{type:Object,value:{}},
    language:{type:String,value:'zh',observer(){this.updateCopy();}}
  },
  data:{t:copy.zh,failed:false,textureError:false,canvasHeight:420},
  observers:{'fabrics, assignments':function(){this.syncFabrics();}},
  lifetimes:{
    ready(){
      this.alive=true;
      this.textures=new Map();
      this.updateCanvasHeight(()=>this.initCanvas());
    },
    detached(){
      this.alive=false;
      clearTimeout(this.celebrationTimer);
      if(this.bear)this.bear.dispose();
      this.bear=null;
    }
  },
  pageLifetimes:{
    show(){this.updateCanvasHeight(()=>this.resizeCanvas());},
    resize(){this.updateCanvasHeight(()=>this.resizeCanvas());}
  },
  methods:{
    updateSelectedGroup(){if(this.bear&&this.data.selectable)this.bear.selectGroup(this.data.selectedPart,this.data.confirmed);},
    showCelebration(value){
      if(!value||!Number.isInteger(value.part)||value.part<0)return;
      const positions=[{x:50,y:25},{x:50,y:60},{x:50,y:24},{x:50,y:56}];
      const pos=this.partAnchors?.[value.part]||positions[value.part]||positions[0];
      clearTimeout(this.celebrationTimer);
      this.setData({celebrating:false},()=>{
        this.setData({celebrating:true,celebrationX:pos.x,celebrationY:pos.y});
        this.celebrationTimer=setTimeout(()=>this.setData({celebrating:false}),1100);
      });
    },
    playConfirmation(part){
      if(this.bear&&this.data.selectable&&this.data.selectedPart===part)this.bear.selectGroup(part,true);
      this.showCelebration({part,key:Date.now()});
    },
    async captureThumbnail(){
      if(!this.bear||!this.canvas)throw new Error('3D preview is not ready');
      await Promise.all([...this.textures.values()].map(entry=>entry.loaded));
      if(!this.alive||!this.bear)throw new Error('Preview closed');
      if([...this.textures.values()].some(entry=>entry.failed))throw new Error('Fabric image unavailable');
      const result=await new Promise(resolve=>this.createSelectorQuery().select('#thumbnailCanvas').fields({node:true},resolve).exec());
      if(!result?.node)throw new Error('Thumbnail canvas unavailable');
      const {width,height,data}=this.bear.captureFrontPixels();
      const canvas=result.node;
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d'),image=ctx.createImageData(width,height);
      image.data.set(data);ctx.putImageData(image,0,0);
      const output=await new Promise((resolve,reject)=>wx.canvasToTempFilePath({canvas,fileType:'png',
        destWidth:Math.round(480*width/Math.max(width,height)),destHeight:Math.round(480*height/Math.max(width,height)),
        success:resolve,fail:reject},this));
      const path=wx.env.USER_DATA_PATH+'/rebear-preview-'+Date.now()+'-'+Math.random().toString(36).slice(2,6)+'.png';
      await new Promise((resolve,reject)=>wx.getFileSystemManager().copyFile({srcPath:output.tempFilePath,destPath:path,success:resolve,fail:reject}));
      return path;
    },
    updateCanvasHeight(done){
      const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();
      const unit=info.windowWidth/750;
      const height=this.data.immersive?Math.max(240,Math.min(this.data.selectable ? 1000 : 400,info.windowHeight*(this.data.selectable ? .62 : .3)/unit)):420;
      this.setData({canvasHeight:height},done);
    },
    initCanvas(){
      this.createSelectorQuery().select('#canvas').fields({node:true,size:true},result=>{
        if(!this.alive)return;
        try{
          if(!result||!result.node)throw new Error('Canvas unavailable');
          this.canvas=result.node;
          this.createSelectorQuery().select('#canvas').boundingClientRect(rect=>{this.canvasRect=rect;}).exec();
          const gl=this.canvas.getContext('webgl',{antialias:true,alpha:!!this.data.immersive,preserveDrawingBuffer:true});
          if(!gl)throw new Error('WebGL unavailable');
          const dpr=Math.min(2,(wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync()).pixelRatio||1);
          this.canvas.width=Math.round(result.width*dpr);
          this.canvas.height=Math.round(result.height*dpr);
          this.gl=gl;
          this.loadModel();
        }catch(error){
          console.warn('ReBear preview',error);
          this.setData({failed:true});
          this.triggerEvent('previewerror');
        }
      }).exec();
    },
    resizeCanvas(){
      if(!this.alive||!this.canvas)return;
      this.createSelectorQuery().select('#canvas').fields({size:true},rect=>{
        if(!rect||!rect.width||!rect.height||!this.alive)return;
        const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();
        const dpr=Math.min(2,info.pixelRatio||1);
        this.canvas.width=Math.round(rect.width*dpr);this.canvas.height=Math.round(rect.height*dpr);
        if(this.bear)this.bear.render();
      }).exec();
      this.createSelectorQuery().select('#canvas').boundingClientRect(rect=>{this.canvasRect=rect;}).exec();
    },
    updateCopy(){
      const t={...(copy[this.data.language]||copy.zh)};
      if(this.data.modelId==='cushion')Object.assign(t,this.data.language==='en'?{
        front:'Top',back:'Bottom',viewHint:'Drag the cushion to view it from different angles.',
        hint:'Drag the cushion to rotate it, or drag a fabric onto it.'
      }:{front:'看上面',back:'看下面',viewHint:'拖动坐垫查看各个角度。',hint:'拖动坐垫旋转，也可以把下方布料拖到坐垫上。'});
      this.setData({t});
    },
    loadModel(){
      if(!this.alive||!this.gl)return;
      if(this.bear)this.bear.dispose();
      this.bear=null;
      this.textures=new Map();
      this.orbit=null;
      this.setData({failed:false,textureError:false});
      this.updateCopy();
      try{
        const model=getModel(this.data.modelId);
        this.bear=createBear(this.gl,wx.getFileSystemManager().readFileSync(model.asset),{modelId:model.id,transparentBackground:this.data.immersive});
        this.bear.select(null);
        if(this.data.selectable)this.bear.selectGroup(this.data.selectedPart,this.data.confirmed);
        this.syncFabrics();
        this.triggerEvent('previewready');
      }catch(error){
        console.warn('ReBear model preview',error);
        this.setData({failed:true});
        this.triggerEvent('previewerror');
      }
    },
    syncFabrics(){
      if(!this.bear)return;
      const fabrics=new Map(this.data.fabrics.map(f=>[f.id,f.image]));
      for(const [id,entry] of this.textures){
        if(fabrics.get(id)!==entry.path){
          this.bear.removeImage(id);
          this.textures.delete(id);
        }
      }
      for(const [id,path] of fabrics){
        if(!path||this.textures.has(id))continue;
        let settle;
        const entry={path,failed:false,loaded:new Promise(resolve=>{settle=resolve;})};
        // A failed native image request must not leave saving stuck indefinitely.
        const timer=setTimeout(()=>{entry.failed=true;settle();},8000);
        const complete=()=>{clearTimeout(timer);settle();};
        this.textures.set(id,entry);
        const image=this.canvas.createImage();
        image.onload=()=>{
          complete();
          if(!this.bear||this.textures.get(id)!==entry)return;
          entry.failed=false;
          try{this.bear.addImage(id,image);}
          catch(error){entry.failed=true;console.warn('ReBear fabric',error);}
          this.drawFabrics();
        };
        image.onerror=()=>{
          complete();
          if(!this.bear||this.textures.get(id)!==entry)return;
          entry.failed=true;
          this.drawFabrics();
        };
        image.src=path;
      }
      this.drawFabrics();
    },
    drawFabrics(){
      this.bear.replaceAssignments(this.data.assignments);
      const textureError=[...this.textures.values()].some(entry=>entry.failed);
      if(this.data.textureError!==textureError)this.setData({textureError});
    },
    front(){if(this.bear)this.bear.show('front');},
    back(){if(this.bear)this.bear.show('back');},
    orbitStart(e){
      if(e.touches.length!==1)return;
      const t=e.touches[0];
      this.orbit={x:t.clientX??t.x,y:t.clientY??t.y};
      this.tapStart={x:this.orbit.x,y:this.orbit.y};
    },
    orbitMove(e){
      if(!this.bear||!this.orbit||e.touches.length!==1)return;
      const t=e.touches[0], x=t.clientX??t.x,y=t.clientY??t.y;
      this.bear.rotate(x-this.orbit.x,y-this.orbit.y);
      this.orbit={x,y};
    },
    orbitEnd(e){
      this.orbit=null;
      const start=this.tapStart;this.tapStart=null;
      if(!this.data.selectable||!this.bear||!start||!e||!e.changedTouches||!e.changedTouches.length)return;
      const t=e.changedTouches[0],x=t.clientX??t.x,y=t.clientY??t.y;
      if(Math.hypot(x-start.x,y-start.y)>14)return;
      const rect=this.canvasRect;
      if(!rect||!rect.width||!rect.height)return;
      const part=this.bear.pick((x-rect.left)/rect.width,(y-rect.top)/rect.height);
      if(!part)return;
      const hit=this.bear.parts.find(item=>item.id===part);
      if(hit){
        const point={x:(x-rect.left)/rect.width*100,y:(y-rect.top)/rect.height*100};
        if(!this.partAnchors)this.partAnchors={};
        this.partAnchors[hit.group]=point;
        this.triggerEvent('partselect',{index:hit.group});
      }
    },
    confirmAction(){if(this.data.canConfirm)this.triggerEvent('confirmaction');},
    saveAction(){if(this.data.canSave)this.triggerEvent('saveaction');},
    measureDropArea(){
      this.createSelectorQuery().select('#canvas').boundingClientRect(rect=>{this.dropRect=rect;}).exec();
    },
    dragFabric(id,x,y,commit=false){
      if(!this.bear)return;
      const r=this.dropRect;
      const part=r&&r.width&&r.height?this.bear.pick((x-r.left)/r.width,(y-r.top)/r.height):null;
      if(commit){
        this.bear.preview(null,null);
        if(part)this.triggerEvent('assign',{partId:part,fabricId:id});
      }else this.bear.preview(id,part);
    },
    cancelDrag(){if(this.bear)this.bear.preview(null,null);}
  }
});
