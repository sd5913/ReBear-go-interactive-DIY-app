const copy={zh:{title:'设计你的小熊',heading:'把裁片摆到布料上',parts:['头部','身体','耳朵','手臂','腿部'],piece:'裁片',placed:'已摆放',hint:'先选布料，再点裁片摆放。拖动裁片可调整位置。',fabric:'布料',add:'添加裁片',rotate:'旋转选中裁片',reset:'重新摆放',confirm:'确认当前部位',done:'查看图纸与清单',need:'请先放入全部裁片',all:'请先确认全部五个部位',select:'请先选择一块裁片',saved:'当前部位已保存',missing:'布料已删除，请重新摆放',back:'返回添加布料',size:'实际布料尺寸',confirmed:'已确认'},en:{title:'Design Your Bear',heading:'Place pieces on your fabric',parts:['Head','Body','Ears','Arms','Legs'],piece:'pieces',placed:'placed',hint:'Choose a fabric, then tap a piece to place it. Drag the piece to position it.',fabric:'Fabric',add:'Add a piece',rotate:'Rotate selected',reset:'Reset this part',confirm:'Confirm This Part',done:'View Pattern & Checklist',need:'Place all pieces first',all:'Confirm all five parts first',select:'Select a piece first',saved:'Part saved',missing:'Fabric was deleted. Place these pieces again.',back:'Back to Fabrics',size:'Measured fabric size',confirmed:'Confirmed'}};
const {faces,armLabels,migrateDesign}=require('../../utils/bear-layout');

Page({
  data:{
    t:copy.zh,language:'zh',items:[],part:0,parts:[],pieces:[],slots:[],selected:-1,
    fabricIndex:0,confirmed:[],allDone:false,previewFabrics:[],assignments:{},drag:null
  },
  onLoad(){
    let language='zh', design={};
    try{
      language=wx.getStorageSync('rebear-language')==='en'?'en':'zh';
      design=wx.getStorageSync('rebear-design')||{};
    }catch(e){}
    this.design=migrateDesign(design);
    this.library=[];
    this.setData({language,t:copy[language]});
    wx.setNavigationBarTitle({title:copy[language].title});
    this.getOpenerEventChannel()?.on('selectedFabrics',({ids})=>{
      this.selectedIds=new Set(ids);
      this.refreshFabrics();
    });
  },
  onShow(){
    try{this.library=wx.getStorageSync('rebear-fabrics')||[];}catch(e){this.library=[];}
    this.refreshFabrics();
  },
  refreshFabrics(){
    const items=this.library.map((f,index)=>({...f,number:index+1})).filter(f=>!this.selectedIds||this.selectedIds.has(f.id));
    const active=this.data.items[this.data.fabricIndex];
    const fabricIndex=Math.max(0,items.findIndex(f=>active&&f.id===active.id));
    this.setData({items,fabricIndex});
    this.loadPart(this.data.part);
  },
  loadPart(part,selected=-1){
    const available=new Set(this.library.map(f=>f.id));
    const assignments={}, used=new Set(this.data.items.map(f=>f.id));
    const confirmed=faces.map((ids,index)=>{
      const record=this.design[index];
      if(!record)return false;
      const pieces=record.pieces.filter(p=>ids[p.index]&&available.has(p.fabricId));
      if(pieces.length!==record.pieces.length){
        record.pieces=pieces;
        record.confirmed=false;
      }
      for(const p of pieces){assignments[ids[p.index]]=p.fabricId;used.add(p.fabricId);}
      return record.confirmed&&pieces.length===ids.length;
    });
    const pieces=this.design[part]?.pieces||[];
    const slots=faces[part].map((_,index)=>({
      index,label:String.fromCharCode(65+index),
      name:part===3?armLabels[this.data.language][index]:'',
      placed:pieces.some(p=>p.index===index)
    }));
    this.setData({
      part,pieces,slots,selected,confirmed,
      parts:this.data.t.parts.map((name,index)=>({name,index,done:confirmed[index]})),
      allDone:confirmed.every(Boolean),assignments,previewFabrics:this.library.filter(f=>used.has(f.id))
    });
  },
  selectPart(e){this.loadPart(Number(e.currentTarget.dataset.index));},
  selectFabric(e){this.setData({fabricIndex:Number(e.currentTarget.dataset.index),selected:-1});},
  addPiece(e){
    const fabric=this.data.items[this.data.fabricIndex];
    if(fabric)this.place(this.data.part,Number(e.currentTarget.dataset.index),fabric.id);
  },
  place(part,index,fabricId){
    const pieces=this.design[part]?.pieces||[];
    const existing=pieces.findIndex(p=>p.index===index);
    if(existing>=0&&pieces[existing].fabricId===fabricId){
      this.loadPart(part,existing);
      return;
    }
    const piece={index,label:String.fromCharCode(65+index),fabricId,x:15+index*38,y:25+index*15,angle:0};
    const next=pieces.slice();
    if(existing<0)next.push(piece);else next[existing]=piece;
    this.updatePieces(next,existing<0?next.length-1:existing,part);
  },
  onAssignFabric(e){
    const {partId,fabricId}=e.detail;
    const part=faces.findIndex(ids=>ids.includes(partId));
    const fabricIndex=this.data.items.findIndex(f=>f.id===fabricId);
    if(part<0||fabricIndex<0)return;
    this.setData({fabricIndex});
    this.place(part,faces[part].indexOf(partId),fabricId);
  },
  fabricStart(e){
    if(e.touches.length!==1)return;
    const touch=e.touches[0];
    this.fabricDrag={id:e.currentTarget.dataset.id,x:touch.clientX,y:touch.clientY,moved:false};
    this.selectComponent('#bear-preview')?.measureDropArea();
  },
  fabricMove(e){
    const drag=this.fabricDrag;
    if(!drag||e.touches.length!==1)return;
    const t=e.touches[0],x=t.clientX,y=t.clientY;
    if(!drag.moved&&Math.hypot(x-drag.x,y-drag.y)<8)return;
    drag.moved=true;
    const fabric=this.data.items.find(f=>f.id===drag.id);
    if(!fabric)return;
    this.setData({drag:{x:x+8,y:y+8,image:fabric.image}});
    this.selectComponent('#bear-preview')?.dragFabric(drag.id,x,y);
  },
  fabricEnd(e){
    const drag=this.fabricDrag;
    this.fabricDrag=null;
    if(!drag?.moved)return;
    this.setData({drag:null});
    const touch=e.changedTouches[0], preview=this.selectComponent('#bear-preview');
    if(touch)preview?.dragFabric(drag.id,touch.clientX,touch.clientY,true);
    else preview?.cancelDrag();
  },
  fabricCancel(){
    this.fabricDrag=null;
    this.setData({drag:null});
    this.selectComponent('#bear-preview')?.cancelDrag();
  },
  pick(e){this.setData({selected:Number(e.currentTarget.dataset.index)});},
  move(e){
    if(e.detail.source!=='touch')return;
    const i=Number(e.currentTarget.dataset.index);
    const pieces=this.data.pieces.map((p,n)=>n===i?{...p,x:e.detail.x,y:e.detail.y}:p);
    this.updatePieces(pieces,i);
  },
  updatePieces(pieces,selected,part=this.data.part){
    this.design[part]={pieces,confirmed:false,...(part===3?{layoutVersion:2}:{})};
    this.store();
    this.loadPart(part,selected);
  },
  rotate(){
    const i=this.data.selected;
    if(i<0){this.toast(this.data.t.select);return;}
    const pieces=this.data.pieces.map((p,n)=>n===i?{...p,angle:(p.angle+45)%360}:p);
    this.updatePieces(pieces,i);
  },
  reset(){this.updatePieces([],-1);},
  confirm(){
    if(this.data.pieces.length!==faces[this.data.part].length){this.toast(this.data.t.need);return;}
    const part=this.data.part;
    this.design[part].confirmed=true;
    if(!this.store()){this.design[part].confirmed=false;return;}
    this.loadPart(part);
    this.toast(this.data.t.saved);
    const next=this.data.confirmed.findIndex(value=>!value);
    if(next>=0)this.loadPart(next);
  },
  store(){
    try{wx.setStorageSync('rebear-design',this.design);return true;}
    catch(e){this.toast(this.data.language==='en'?'Could not save progress':'进度保存失败，请重试');return false;}
  },
  toast(title){wx.showToast({title,icon:'none'});},
  guide(){
    if(!this.data.allDone){this.toast(this.data.t.all);return;}
    wx.navigateTo({url:'/pages/guide/guide'});
  },
  back(){wx.navigateBack();}
});
