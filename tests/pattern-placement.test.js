const test = require('node:test')
const assert = require('node:assert/strict')
const { faces, migrateDesign } = require('../wechat-app/utils/bear-layout')
const { getModel, pieceLayout, fabricLayout } = require('../wechat-app/utils/model-catalog')
const { texturePlacement, validatePlacements } = require('../wechat-app/utils/pattern-placement')
const { saveDesign, isComplete } = require('../wechat-app/utils/design-records')

const layout = { width: 600, height: 600, unit: 1, pieceWidth: 116, pieceHeight: 140, padding: 10 }
const fabrics = [{ id: 'cloth', image: '/fixture.png', width: 60, height: 60 }]
const clone = value => JSON.parse(JSON.stringify(value))
const piece = (index, x, y, fabricId = 'cloth') => ({ index, label: String.fromCharCode(65 + index), fabricId, x, y, angle: 0 })
function completeDraft() {
  let cell = 0
  const design = { __sizeScale: 1 }
  faces.forEach((ids, part) => {
    design[part] = { confirmed: true, pieces: ids.map((_, index) => {
      const i = cell++
      return piece(index, 20 + i % 3 * 190, 20 + Math.floor(i / 3) * 290)
    }) }
  })
  return design
}
function normalize(design, scene = layout) {
  const result = clone(design)
  faces.forEach((_, part) => (result[part]?.pieces || []).forEach(p => {
    p.placement = texturePlacement(p, pieceLayout(fabricLayout(scene, p.fabricId), 'bear', part, design.__sizeScale))
  }))
  return result
}
function page(design = { __sizeScale: 1 }) {
  let spec
  const storage = new Map(), notices = []
  global.Page = value => { spec = value }
  global.wx = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, clone(value)),
    removeStorageSync: key => storage.delete(key),
    showToast: ({ title }) => notices.push(title),
    showModal: options => notices.push(options.content),
    disableAlertBeforeUnload() {},
    reLaunch: options => notices.push(options.url)
  }
  const file = require.resolve('../wechat-app/package-design/pages/design/design.js')
  delete require.cache[file]
  require(file)
  const instance = { ...spec, data: clone(spec.data), design: clone(design), modelId: 'bear',
    faces, draftKey: 'rebear-design', library: fabrics, layout, selectComponent(){return null;},
    setData(value, done) { Object.assign(this.data, value); if (done) done() }
  }
  instance.data.items = fabrics
  instance.loadPart(0)
  return { p: instance, storage, notices }
}
const touch = points => ({ currentTarget: { dataset: { index: 0 } }, touches: points.map(([clientX, clientY]) => ({ clientX, clientY })) })

// These cases follow the current six-slot bear model, including both UV islands in each mask.
test('current layout migration is idempotent and keeps right slots and confirmations', () => {
  const design = completeDraft(), migrated = migrateDesign(design)
  assert.deepEqual(migrated[2], design[2])
  assert.deepEqual(migrated[3], design[3])
  assert.deepEqual(migrateDesign(migrated), migrated)
  assert.ok(faces.every((_, part) => migrated[part].confirmed))
})
test('legacy ten-slot bear layout migrates once and requires fresh confirmation', () => {
  const old = { 0: {pieces:[piece(0,20,20),piece(1,200,20)],confirmed:true},
    2: {pieces:[0,1,2,3].map(i=>piece(i,20+i*120,300)),confirmed:true}, 4:{pieces:[]} }
  const result = migrateDesign(old)
  assert.equal(result[0].pieces.length, 1)
  assert.deepEqual(result[2].pieces.map(p=>p.index), [0,1])
  assert.equal(result[2].confirmed, false)
  assert.equal(result[4], undefined)
  assert.deepEqual(migrateDesign(result), result)
})
test('actual first slot tap places a piece without undeclared variables', () => {
  const { p } = page()
  p.addPiece({currentTarget:{dataset:{index:0}}})
  assert.equal(p.design[0].pieces.length, 1)
  assert.equal(p.data.canConfirm, true)
  p.confirm()
  assert.equal(p.design[0].confirmed, true)
  assert.equal(p.data.part, 1)
})
test('unconfirmed previous pieces remain visible, selectable and included in collisions', () => {
  const { p } = page()
  p.place(0,0,'cloth')
  p.updatePieces([piece(0,20,20)],0,0)
  p.loadPart(1)
  assert.equal(p.data.placedGhosts.length, 1)
  assert.equal(p.data.placedGhosts[0].part, 0)
  p.place(1,0,'cloth')
  p.updatePieces([piece(0,20,0)],0,1)
  assert.ok(p.data.parts.some(part=>part.invalid))
  p.selectGhost({currentTarget:{dataset:{part:0,slot:0}}})
  assert.equal(p.data.part, 0)
  assert.equal(p.data.selected, 0)
})
test('moving another part clears temporary conflicts without losing prior confirmation', () => {
  const { p } = page(completeDraft())
  const head = p.design[0].pieces[0]
  p.updatePieces([piece(0,head.x,head.y-20)],0,1)
  assert.equal(p.data.allDone,false)
  assert.equal(p.data.confirmed[0],false)
  assert.equal(p.design[0].confirmed,true)
  p.updatePieces([piece(0,210,20)],0,1)
  assert.equal(p.data.confirmed[0],true)
  assert.equal(p.design[1].confirmed,false)
})
test('cross-part overlap and partial overflow clear after correction', () => {
  const design = completeDraft()
  design[1].pieces[0] = piece(0,20,0)
  let result = validatePlacements(design,fabrics,layout)
  assert.ok(result.parts[0].errors[0].overlaps.length)
  assert.ok(result.parts[1].errors[0].overlaps.length)
  design[1].pieces[0] = piece(0,210,20)
  design[0].pieces[0].x = -200
  result = validatePlacements(design,fabrics,layout)
  assert.equal(result.parts[0].errors[0].outside,true)
  design[0].pieces[0].x = 20
  assert.ok(validatePlacements(design,fabrics,layout).parts.every(part=>part.valid))
})
test('pinch validates other parts and shrinking restores unconstrained two-axis drag', () => {
  const { p } = page(completeDraft())
  p.design[0].pieces[0] = piece(0,-18,20)
  p.loadPart(1)
  p.pieceTouchStart(touch([[100,100],[200,100]]))
  p.pieceTouchMove(touch([[100,100],[350,100]]))
  assert.equal(p.design.__sizeScale,2.5)
  assert.equal(p.data.placedGhosts.find(g=>g.part===0).invalid,true)
  p.pieceTouchMove(touch([[100,100],[150,100]]))
  p.pieceTouchEnd(touch([]))
  assert.equal(p.design.__sizeScale,.5)
  assert.equal(p.data.placedGhosts.find(g=>g.part===0).invalid,false)
  const before = clone(p.design[1].pieces[0])
  p.pieceTouchStart(touch([[100,100]]))
  p.pieceTouchMove(touch([[120,130]]))
  p.pieceTouchEnd(touch([]))
  assert.ok(Math.abs(p.design[1].pieces[0].x-before.x-20)<1e-9)
  assert.ok(Math.abs(p.design[1].pieces[0].y-before.y-30)<1e-9)
})
test('different fabric aspect ratios retain equivalent live and saved validation', () => {
  const scene = {...layout,fabricSizes:{cloth:{width:400,height:200}}}
  const design = {__sizeScale:1,0:{pieces:[piece(0,20,20)],confirmed:true}}
  assert.deepEqual(validatePlacements(normalize(design,scene),fabrics),validatePlacements(design,fabrics,scene))
})
test('all six confirmed slots save and reopen without migration resetting them', async () => {
  const { p, storage, notices } = page(completeDraft())
  assert.equal(p.data.allDone,true)
  p.openSave()
  assert.equal(p.data.saveDialog,true)
  p.data.saveName = '回归方案'
  await p.saveToDesigns()
  const [saved] = storage.get('rebear-saved-designs')
  assert.equal(saved.name,'回归方案')
  assert.equal(isComplete(saved.design,saved.fabrics),true)
  assert.equal(saved.design[2].pieces.length,2)
  assert.equal(saved.design[3].pieces.length,2)
  assert.ok(notices.includes('/pages/designs/index'))
  assert.equal(page(migrateDesign(saved.design)).p.data.allDone,true)
})
test('saved invalid placements are refused even if old confirmation flags remain true', () => {
  const design = normalize(completeDraft())
  design[1].pieces[0].placement = clone(design[0].pieces[0].placement)
  assert.equal(isComplete(design,fabrics),false)
  global.wx = {getStorageSync:()=>[]}
  assert.throws(()=>saveDesign('invalid',design,fabrics),/Incomplete/)
})

test('semi-transparent pattern interiors are occupied fabric, not transparent holes', () => {
  const masks = require('../wechat-app/utils/pattern-masks')
  for (const [name, strips] of Object.entries(masks)) {
    const area = strips.reduce((sum, p) => sum + (p[1][0]-p[0][0])*(p[2][1]-p[1][1]), 0)
    assert.ok(area > .4, name + ' must include the translucent interior')
  }
})
test('slightly offset ear interiors collide even when their wireframe strokes miss', () => {
  const design = {__sizeScale:1,2:{confirmed:true,pieces:[piece(0,50,50),piece(1,52,52)]}}
  const result=validatePlacements(design,fabrics,layout)
  assert.equal(result.parts[2].errors[0].invalid,true)
  assert.deepEqual(result.parts[2].errors[1].overlaps,[{part:2,index:0}])
  assert.deepEqual(validatePlacements(normalize(design),fabrics),result)
  design[2].pieces[1].x=200
  assert.equal(validatePlacements(design,fabrics,layout).parts[2].valid,true)
})
test('overlap during drag disables confirm and save, marks ghosts, then clears when moved away', () => {
  const {p,notices}=page(completeDraft())
  p.loadPart(2)
  p.updatePieces([piece(0,50,50),piece(1,52,52)],1,2)
  assert.equal(p.data.canConfirm,false)
  assert.match(p.data.currentIssue,/重叠/)
  assert.equal(p.data.allDone,false)
  p.confirm()
  assert.equal(p.design[2].confirmed,false)
  assert.ok(notices.at(-1).includes('标红'))
  p.openSave()
  assert.equal(p.data.saveDialog,false)
  p.loadPart(3)
  assert.ok(p.data.placedGhosts.filter(g=>g.part===2).every(g=>g.invalid))
  p.updatePieces([piece(0,50,500),piece(1,250,500)],1,2)
  assert.equal(p.data.canConfirm,true)
})

test('transparent wrapper margins and different fabrics do not report false overlaps', () => {
  const design={2:{pieces:[piece(0,50,50),piece(1,50,100)]}}
  assert.equal(validatePlacements(design,fabrics,layout).parts[2].valid,true)
  design[2].pieces[1]=piece(1,52,52,'other')
  assert.equal(validatePlacements(design,[...fabrics,{...fabrics[0],id:'other'}],layout).parts[2].valid,true)
})
test('filled overlap survives rotation, global scale, fabric aspect ratio and normalization', () => {
  for (const scale of [.5,1,2.5]) for (const angle of [0,45,90]) {
    const design={__sizeScale:scale,2:{confirmed:true,pieces:[piece(0,80,80),piece(1,82,82)]}}
    design[2].pieces.forEach(p=>{p.angle=angle})
    for(const size of [{width:400,height:600},{width:600,height:400}]) {
      const scene={...layout,fabricSizes:{cloth:size}}
      const result=validatePlacements(design,fabrics,scene)
      assert.ok(result.parts[2].errors[0].overlaps.length,JSON.stringify({scale,angle,size}))
      assert.deepEqual(validatePlacements(normalize(design,scene),fabrics),result)
    }
  }
})
