const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pieceLayout, getModel } = require('../wechat-app/utils/model-catalog')
const { texturePlacement, pieceOutline, pieceSeams, validatePlacements } = require('../wechat-app/utils/pattern-placement')

const layout = { width: 600, height: 600, padding: 10 }
const cloth = { id: 'cloth', width: 60, height: 60 }
const patch = (index, angle = 0) => ({ index, fabricId: 'cloth', x: 100, y: 100, angle })

test('cushion side seams follow both curved UV masks at the displayed aspectFit size', () => {
  for (const slot of [0, 1]) {
    const file = fs.readFileSync(path.join(__dirname, '../wechat-app', getModel('cushion').pieceMasks[2][slot]))
    const aspect = file.readUInt32BE(16) / file.readUInt32BE(20)
    const placement = texturePlacement(patch(slot), pieceLayout(layout, 'cushion', 2))
    assert.equal(placement.axisX[0] / placement.axisY[1], aspect)
    const outline = pieceOutline(2, placement, 'cushion', slot)
    assert.ok(outline.length > 4, 'side is a curved UV silhouette, not its rectangular wrapper')
    assert.ok(new Set(outline.map(p => p.y)).size > 10)
    // Displayed image height is 36 px, width 230.4 px, centred in the 360 px wrapper.
    assert.ok(Math.abs(placement.axisX[0] * 600 - 230.4) < 1e-9)
  }
})

test('cushion UV seam stays one physical centimeter outside at every scale and rotation', () => {
  for (const slot of [0, 1]) for (const scale of [.5, 1, 2]) for (const angle of [0, 37, 90]) {
    const placement = texturePlacement(patch(slot, angle), pieceLayout(layout, 'cushion', 2, scale))
    const original = pieceOutline(2, placement, 'cushion', slot)
    const expanded = pieceSeams(2, placement, cloth, 'cushion', slot).flat()
    for (const axis of ['x', 'y']) {
      const min = points => Math.min(...points.map(p => p[axis]))
      const max = points => Math.max(...points.map(p => p[axis]))
      assert.ok(Math.abs((min(original) - min(expanded)) * 60 - 1) < .01)
      assert.ok(Math.abs((max(expanded) - max(original)) * 60 - 1) < .01)
    }
  }
})

test('empty side wrapper margins remain usable while real seam overlap is rejected', () => {
  const side = patch(0)
  side.placement = texturePlacement(side, pieceLayout(layout, 'cushion', 2))
  const top = { ...patch(0), placement: { origin: [43 / 60, 12.8 / 60], axisX: [.01, 0], axisY: [0, .01] } }
  const design = { 0: { pieces: [top] }, 2: { pieces: [side] } }
  const check = () => validatePlacements(design, [cloth], null, 'cushion')
  assert.equal(check().parts[2].valid, true)
  const overlays = []
  validatePlacements(design, [cloth], null, 'cushion', overlays)
  assert.deepEqual(overlays[1].paths, pieceSeams(2, side.placement, cloth, 'cushion', 0))
  top.placement.origin[0] = 39.8 / 60
  assert.equal(check().parts[2].errors[0].overlaps.length, 1)
})
