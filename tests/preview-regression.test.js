const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {createBear}=require('../wechat-app/components/rebear-preview/engine')
function renderer(){
  const colors=[]
  const gl=new Proxy({drawingBufferWidth:2,drawingBufferHeight:2,NO_ERROR:0,
    createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),createTexture:()=>({}),
    getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:(_,name)=>name,
    getError:()=>0,isContextLost:()=>false,
    uniform3fv:(name,value)=>{if(name==='uHighlight')colors.push(value)},
    readPixels(x,y,w,h,format,type,data){data.set([10,0,0,255,10,0,0,255,20,0,0,255,20,0,0,255])}
  },{get:(target,key)=>key in target?target[key]:(()=>{})})
  const file=fs.readFileSync(require('node:path').join(__dirname,'../wechat-app/assets/bear-material/bear.glb'))
  return {bear:createBear(gl,file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength)),colors}
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
