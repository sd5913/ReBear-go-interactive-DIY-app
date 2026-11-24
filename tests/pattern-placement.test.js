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
