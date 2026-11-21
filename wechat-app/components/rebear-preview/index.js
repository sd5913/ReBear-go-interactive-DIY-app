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
    fabrics:{type:Array,value:[]},
    assignments:{type:Object,value:{}},
    language:{type:String,value:'zh',observer(){this.updateCopy();}}
  },
  data:{t:copy.zh,failed:false,textureError:false},
  observers:{'fabrics, assignments':function(){this.syncFabrics();}},
  lifetimes:{
    ready(){
      this.alive=true;
      this.textures=new Map();
      this.createSelectorQuery().select('#canvas').fields({node:true,size:true},result=>{
        if(!this.alive)return;
        try{
          if(!result||!result.node)throw new Error('Canvas unavailable');
          this.canvas=result.node;
          const gl=this.canvas.getContext('webgl',{antialias:true,alpha:!!this.data.immersive});
          if(!gl)throw new Error('WebGL unavailable');
          const dpr=Math.min(2,(wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync()).pixelRatio||1);
          this.canvas.width=Math.round(result.width*dpr);
          this.canvas.height=Math.round(result.height*dpr);
          this.gl=gl;
          this.loadModel();
        }catch(error){
          console.warn('ReBear preview',error);
          this.setData({failed:true});
        }
      }).exec();
    },
    detached(){
      this.alive=false;
      if(this.bear)this.bear.dispose();
      this.bear=null;
    }
  },
  methods:{
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
        this.bear=createBear(this.gl,wx.getFileSystemManager().readFileSync(model.asset),{modelId:model.id,transparentBackground:this.data.immersive,modelScale:this.data.immersive&&model.id==='bear'?1.25:1});
        this.bear.select(null);
        this.syncFabrics();
      }catch(error){
        console.warn('ReBear model preview',error);
        this.setData({failed:true});
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
        const entry={path,failed:false};
        this.textures.set(id,entry);
        const image=this.canvas.createImage();
        image.onload=()=>{
          if(!this.bear||this.textures.get(id)!==entry)return;
          try{this.bear.addImage(id,image);}
          catch(error){entry.failed=true;console.warn('ReBear fabric',error);}
          this.drawFabrics();
        };
        image.onerror=()=>{
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
    },
    orbitMove(e){
      if(!this.bear||!this.orbit||e.touches.length!==1)return;
      const t=e.touches[0], x=t.clientX??t.x,y=t.clientY??t.y;
      this.bear.rotate(x-this.orbit.x,y-this.orbit.y);
      this.orbit={x,y};
    },
    orbitEnd(){this.orbit=null;},
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
