const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {createBear}=require('../wechat-app/components/rebear-preview/engine')
function renderer(modelId='bear'){
  const colors=[]
  const gl=new Proxy({drawingBufferWidth:2,drawingBufferHeight:2,NO_ERROR:0,
    createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),createTexture:()=>({}),
    getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:(_,name)=>name,
    getError:()=>0,isContextLost:()=>false,
    uniform3fv:(name,value)=>{if(name==='uHighlight')colors.push(value)},
    readPixels(x,y,w,h,format,type,data){data.set([10,0,0,255,10,0,0,255,20,0,0,255,20,0,0,255])}
  },{get:(target,key)=>key in target?target[key]:(()=>{})})
  const model=require('../wechat-app/utils/model-catalog').getModel(modelId)
  const file=fs.readFileSync(require('node:path').join(__dirname,'../wechat-app'+model.asset))
  return {bear:createBear(gl,file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),{modelId}),colors}
}
test('confirmed selections use green and unconfirmed selections retain orange',()=>{
  const {bear,colors}=renderer()
  bear.selectGroup(0,true)
  assert.deepEqual(colors.at(-1),[.28,.72,.46])
  bear.selectGroup(1,false)
  assert.deepEqual(colors.at(-1),[1,.57,.13])
  bear.dispose()
})
test('thumbnail capture flips WebGL rows and restores selection after export',()=>{
  const {bear,colors}=renderer()
  bear.selectGroup(0,true)
  const image=bear.captureFrontPixels()
  assert.equal(image.data[0],20)
  assert.equal(image.data[8],10)
  assert.deepEqual(colors.at(-1),[.28,.72,.46])
  bear.dispose()
})
let component
global.Component=value=>{component=value}
require('../wechat-app/components/rebear-preview/index')

function pickingComponent(bear){
  const pending=[],events=[]
  const c={...component.methods,alive:true,data:{selectable:true},bear,
    canvasRect:{left:25,top:250,width:350,height:500},
    triggerEvent(name,value){events.push({name,...value})},
    createSelectorQuery(){return{select(){return this},boundingClientRect(callback){pending.push(callback);return this},exec(){}}}}
  return {c,pending,events}
}
test('bear, rabbit and cat body taps remain on the body after scrolling, for viewport and CanvasTouch coordinates',()=>{
  for(const modelId of ['bear','rabbit','cat']){
    const {bear}=renderer(modelId)
    try{
      let point
      for(let v=.55;v<.95&&!point;v+=.025){
        const id=bear.pick(.5,v)
        if(bear.parts.find(part=>part.id===id)?.group===1)point={u:.5,v}
      }
      assert.ok(point,modelId+' has a visible body target')
      const {c,pending,events}=pickingComponent(bear)
      for(const top of [250,80,-120,250]){
        for(const local of [false,true]){
          const rect={left:25,top,width:350,height:500}
          const touch=local?{x:point.u*rect.width,y:point.v*rect.height}
            :{clientX:rect.left+point.u*rect.width,clientY:rect.top+point.v*rect.height}
          c.orbitStart({touches:[touch]})
          c.orbitEnd({changedTouches:[touch]})
          assert.equal(pending.length,1,'measure current bounds on every tap')
          pending.shift()(rect)
          assert.deepEqual(events.at(-1),{name:'partselect',index:1},modelId+' top='+top+' local='+local)
          assert.equal(c.partAnchors[1].y,point.v*100)
        }
      }
      assert.equal(events.length,8)
    }finally{bear.dispose()}
  }
})
test('dragging, cancelled touches and stale measurements do not select a model part',()=>{
  let picks=0
  const {c,pending,events}=pickingComponent({pick(){picks++;return 'body'},parts:[{id:'body',group:1}],rotate(){}})
  const touch={clientX:150,clientY:300},rect={left:25,top:80,width:350,height:500}
  const tap=()=>{c.orbitStart({touches:[touch]});c.orbitEnd({changedTouches:[touch]})}
  c.orbitStart({touches:[touch]})
  c.orbitMove({touches:[{clientX:200,clientY:300}]})
  c.orbitEnd({changedTouches:[{clientX:200,clientY:300}]})
  assert.equal(pending.length,0)
  tap();c.orbitCancel();pending.shift()(rect)
  tap();c.orbitStart({touches:[touch]});pending.shift()(rect)
  tap();c.alive=false;pending.shift()(rect)
  c.alive=true;tap();c.bear={};pending.shift()(rect)
  assert.equal(picks,0)
  assert.equal(events.length,0)
})
test('confirmation celebration retains the selected group as confirmed',()=>{
  let selected
  const c={data:{selectable:true,selectedPart:2},bear:{selectGroup:(...args)=>{selected=args}},showCelebration(){}}
  component.methods.playConfirmation.call(c,2)
  assert.deepEqual(selected,[2,true])
  component.methods.updateSelectedGroup.call({...c,data:{...c.data,confirmed:true}})
  assert.deepEqual(selected,[2,true])
})
test('thumbnail waits for textures, exports through native 2D canvas and persists file',async()=>{
  let finish,reads=0,exported=false,copied=false
  const loaded=new Promise(resolve=>{finish=resolve})
  const node={getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(16)}),putImageData(){}})}
  const c={alive:true,textures:new Map([['cloth',{loaded,failed:false}]]),canvas:{},
    bear:{captureFrontPixels(){reads++;return{width:2,height:2,data:new Uint8ClampedArray(16)}}},
    createSelectorQuery(){return{select(){return this},fields(opts,callback){callback({node});return this},exec(){}}}}
  global.wx={env:{USER_DATA_PATH:'wxfile://usr'},canvasToTempFilePath(options){exported=options.canvas===node;options.success({tempFilePath:'wxfile://tmp.png'})},
    getFileSystemManager:()=>({copyFile(options){copied=options.srcPath==='wxfile://tmp.png';options.success()}})}
  const pending=component.methods.captureThumbnail.call(c)
  await Promise.resolve()
  assert.equal(reads,0)
  finish()
  const path=await pending
  assert.ok(exported&&copied)
  assert.match(path,/^wxfile:\/\/usr\/rebear-preview-.*\.png$/)
})
test('failed fabric loading cannot overwrite a thumbnail with an untextured model',async()=>{
  const c={alive:true,canvas:{},bear:{},textures:new Map([['cloth',{loaded:Promise.resolve(),failed:true}]])}
  await assert.rejects(()=>component.methods.captureThumbnail.call(c),/Fabric image unavailable/)
})
test('thumbnail repair keeps design name, time and placements, and rejects stale updates',()=>{
  const {updateThumbnail}=require('../wechat-app/utils/design-records')
  let records=[{id:'a',name:'Original',updatedAt:12,design:{0:{confirmed:true}},fabrics:[]}]
  global.wx={getStorageSync:()=>records,setStorageSync:(_,value)=>{records=value}}
  assert.equal(updateThumbnail('a','wxfile://usr/new.png',11),false)
  assert.equal(updateThumbnail('a','wxfile://usr/new.png',12),true)
  assert.equal(records[0].name,'Original')
  assert.equal(records[0].updatedAt,12)
  assert.equal(records[0].design[0].confirmed,true)
  assert.equal(records[0].thumbnailVersion,2)
})
