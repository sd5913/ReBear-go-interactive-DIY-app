const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { faces } = require('../wechat-app/utils/bear-layout')
const { texturePlacement, pieceOutline, validatePlacements } = require('../wechat-app/utils/pattern-placement')

const layout = { width: 400, height: 280, pieceWidth: 50, pieceHeight: 60, padding: 5 }
const fabrics = [{ id: 'cloth', image: '/assets/sample-stripes.png', width: 100, height: 100 }]
function piece(index, x, y, fabricId = 'cloth', angle = 0) {
  return { index, label: String.fromCharCode(65 + index), fabricId, x, y, angle }
}
function draft(entries) {
  return Object.fromEntries(entries.map((pieces, part) => [part, { pieces, confirmed: true, layoutVersion: 2 }]))
}
function completeDraft() {
  let cell = 0
  return draft(faces.map(ids => ids.map((_, index) => {
    const position = cell++
    return piece(index, 15 + position % 4 * 90, 5 + Math.floor(position / 4) * 65)
  })))
}

test('detects partial overflow beyond the image and a slanted measured fabric edge', () => {
  let validation = validatePlacements(draft([[piece(0, -12, 20)]]), fabrics, layout)
  assert.equal(validation.parts[0].errors[0].outside, true)
  const slanted = [{ ...fabrics[0], measurement: {
    boundsCm: { width: 100, height: 100 },
    polygonCm: [{x: 0, y: 0}, {x: 80, y: 0}, {x: 100, y: 100}, {x: 40, y: 100}]
  }}]
  validation = validatePlacements(draft([[piece(0, 40, 175)]]), slanted, layout)
  assert.equal(validation.parts[0].errors[0].outside, true)
  validation = validatePlacements(draft([[piece(0, 210, 100)]]), slanted, layout)
  assert.equal(validation.parts[0].valid, true)
})

test('rechecks rotated outlines instead of the unrotated movable wrapper', () => {
  const straight = validatePlacements(draft([[piece(0, 354, 80)]]), fabrics, layout)
  const rotated = validatePlacements(draft([[piece(0, 354, 80, 'cloth', 45)]]), fabrics, layout)
  assert.equal(straight.parts[0].valid, true)
  assert.equal(rotated.parts[0].errors[0].outside, true)
})

test('marks both overlapping pieces and clears errors when they are moved apart', () => {
  const design = draft([[piece(0, 10, 20), piece(1, 25, 30)]])
  let result = validatePlacements(design, fabrics, layout)
  assert.equal(result.parts[0].errors[0].invalid, true)
  assert.deepEqual(result.parts[0].errors[1].overlaps, [{part: 0, index: 0}])
  design[0].pieces[1].x = 160
  result = validatePlacements(design, fabrics, layout)
  assert.equal(result.parts[0].valid, true)
  assert.equal(result.parts[0].errors[0].invalid, false)
})

test('edge contact and padding overlap are allowed when the actual rounded pieces are apart', () => {
  const touching = draft([[piece(0, 10, 20), piece(1, 50, 20)]])
  assert.equal(validatePlacements(touching, fabrics, layout).parts[0].valid, true)
  const padded = draft([[piece(0, 10, 20), piece(1, 48, 68)]])
  assert.equal(validatePlacements(padded, fabrics, layout).parts[0].valid, true)
  touching[0].pieces[1].x = 49.5
  assert.equal(validatePlacements(touching, fabrics, layout).parts[0].valid, false)
})

test('checks other body parts on the same fabric and keeps different fabrics independent', () => {
  const design = draft([[piece(0, 30, 40)], [piece(0, 30, 40)]])
  let result = validatePlacements(design, fabrics, layout)
  assert.equal(result.parts[0].valid, false)
  assert.equal(result.parts[1].valid, false)
  assert.deepEqual(result.parts[0].errors[0].overlaps, [{part: 1, index: 0}])
  design[1].pieces[0].fabricId = 'other'
  result = validatePlacements(design, fabrics.concat({...fabrics[0], id: 'other'}), layout)
  assert.equal(result.parts[0].valid, true)
  assert.equal(result.parts[1].valid, true)
})

test('ear outlines have no duplicate edges that could hide collisions', () => {
  const design = draft([[], [], [piece(0, 20, 20), piece(1, 20, 20)]])
  const result = validatePlacements(design, fabrics, layout)
  assert.equal(result.parts[2].errors[0].invalid, true)
  const outline = pieceOutline(2, texturePlacement(design[2].pieces[0], layout))
  assert.ok(outline.every((point, i) => Math.hypot(point.x - outline[(i+1)%outline.length].x,
    point.y - outline[(i+1)%outline.length].y) > 1e-12))
})

test('validates saved normalized placement identically and refuses invalid legacy confirmation', () => {
  const design = completeDraft()
  const live = validatePlacements(design, fabrics, layout)
  assert.ok(live.ready && live.parts.every(part => part.valid))
  for (const part of Object.values(design)) for (const p of part.pieces) p.placement = texturePlacement(p, layout)
  assert.deepEqual(validatePlacements(design, fabrics), live)
  const {isComplete, saveDesign} = require('../wechat-app/utils/design-records')
  assert.equal(isComplete(design, fabrics), true)
  design[1].pieces[0].placement = design[0].pieces[0].placement
  assert.equal(isComplete(design, fabrics), false)
  global.wx = { getStorageSync: () => [] }
  assert.throws(() => saveDesign('invalid', design, fabrics), /Incomplete/)
  const unmeasured = validatePlacements(draft([[piece(0, 20, 20)]]), fabrics)
  assert.equal(unmeasured.ready, false)
})

function page(design) {
  let spec
  let toast
  const writes = []
  const modulePath = path.resolve(__dirname, '../wechat-app/pages/design/design.js')
  global.Page = value => { spec = value }
  global.wx = {
    setStorageSync: (key, value) => writes.push(JSON.parse(JSON.stringify(value))),
    showToast: ({title}) => { toast = title }
  }
  delete require.cache[modulePath]
  require(modulePath)
  const instance = { ...spec, data: JSON.parse(JSON.stringify(spec.data)), design,
    library: fabrics, layout, setData(value, done) { Object.assign(this.data, value); if (done) done() } }
  instance.data.items = fabrics
  instance.loadPart(0)
  return {instance, writes, getToast: () => toast}
}

test('normal page handlers reject old overlapping confirmations, then re-enable after correction', () => {
  const state = page(draft([[piece(0, 20, 20), piece(1, 25, 30)]]))
  const p = state.instance
  assert.equal(p.data.canConfirm, false)
  assert.equal(Object.values(p.data.pieceErrors).filter(error => error.invalid).length, 2)
  assert.equal(p.design[0].confirmed, false)
  p.confirm()
  assert.match(state.getToast(), /标红/)
  p.move({detail:{source: 'touch',x:160,y:30},currentTarget:{dataset:{index:1}}})
  assert.equal(p.data.canConfirm, true)
  assert.equal(Object.values(p.data.pieceErrors).filter(error => error.invalid).length, 0)
  p.confirm()
  assert.equal(p.design[0].confirmed, true)
  assert.equal(state.writes.at(-1)[0].confirmed, true)
})

test('page rotation and cross-part edits invalidate affected confirmations and guide access', () => {
  const state = page(completeDraft())
  const p = state.instance
  assert.equal(p.data.allDone, true)
  const target = p.design[1].pieces[0]
  p.updatePieces([p.design[0].pieces[0],piece(1,354,5)],1)
  assert.equal(p.data.canConfirm,true)
  p.rotate()
  assert.equal(p.data.canConfirm,false)
  assert.equal(p.data.pieceErrors[1].outside,true)
  p.updatePieces([piece(0,target.x,target.y),piece(1,354,5)],0)
  assert.ok(p.data.pieceErrors[0].overlaps.length)
  assert.equal(p.design[1].confirmed,false)
  p.guide()
  assert.equal(p.data.allDone,false)
  assert.match(state.getToast(), /五个部位/)
})
