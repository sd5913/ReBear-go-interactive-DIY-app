const test = require('node:test')
const assert = require('node:assert/strict')
let spec
global.Page = value => { spec = value }
require('../wechat-app/package-sewing/pages/guide/index')

test('sewing guide navigates five steps, restores progress and returns to the same saved design', () => {
  const writes = new Map()
  const calls = []
  const record = {id:'saved-bear',name:'My Bear',updatedAt:12,modelId:'bear',fabrics:[],design:{}}
  global.wx = {
    getStorageSync(key) { if(key==='rebear-saved-designs')return [record]; return writes.get(key) },
    setStorageSync(key,value) {writes.set(key,value)},
    setNavigationBarTitle() {}, getWindowInfo:()=>({statusBarHeight:44}),
    pageScrollTo() {}, navigateBack(){calls.push('back')},
    showModal(options) { assert.ok(options.confirmText.length<=4); options.success({confirm:true}) }
  }
  global.getCurrentPages=()=>[{route:'pages/design-detail/index'},{route:'package-sewing/pages/guide/index'}]
  const page={...spec,data:{...spec.data},setData(data){Object.assign(this.data,data)}}
  page.onLoad({id:record.id})
  assert.equal(page.data.step,0)
  page.next()
  assert.equal(page.data.number,'02')
  page.onLoad({id:record.id})
  assert.equal(page.data.step,1)
  page.previous()
  assert.equal(page.data.step,0)
  for(let i=0;i<4;i++)page.next()
  assert.equal(page.data.number,'05')
  assert.match(page.data.stepImage,/assemble.png$/)
  page.next()
  assert.equal(page.data.step,0)
  assert.deepEqual(calls,['back'])
  assert.equal(record.name,'My Bear')
  record.updatedAt=13
  page.onLoad({id:record.id})
  assert.equal(page.data.step,0)
})

test('missing saved design is shown as unavailable',()=>{
  global.wx={getStorageSync:()=>[],setNavigationBarTitle(){}}
  const page={...spec,data:{...spec.data},setData(data){Object.assign(this.data,data)}}
  page.onLoad({id:'gone'})
  assert.ok(page.data.error)
})
