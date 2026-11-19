const { inside, overlap, validQuad } = require('./a4-geometry')
const { getModel, pieceLayout } = require('./model-catalog')

// Coordinates match the outer edge of .piece, excluding .piece-wrap padding.
function texturePlacement(piece, layout) {
  if (!layout) return null
  const angle = (Number(piece.angle) || 0) * Math.PI / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const width = layout.pieceWidth - 2 * layout.padding
  const height = layout.pieceHeight - 2 * layout.padding
  return {
    fabricId: piece.fabricId,
    origin: [((Number(piece.x) || 0) + layout.pieceWidth / 2) / layout.width,
      ((Number(piece.y) || 0) + layout.pieceHeight / 2) / layout.height],
    axisX: [width * cos / layout.width, width * sin / layout.height],
    axisY: [-height * sin / layout.width, height * cos / layout.height]
  }
}

function pieceOutline(part, placement, modelId = 'bear') {
  if (!placement || ![placement.origin, placement.axisX, placement.axisY].every(
    axis => Array.isArray(axis) && axis.length === 2 && axis.every(Number.isFinite)
  )) return null
  const { origin, axisX, axisY } = placement
  if (Math.abs(axisX[0] * axisY[1] - axisX[1] * axisY[0]) < 1e-12) return null
  const points = []
  // Match border-radius:42%, and the ears' 50% 50% 35% 35% corners.
  for (let corner = 0; corner < 4; corner++) {
    const radius = modelId === 'cushion' ? (part === 2 ? 0 : 0.5) :
      (part === 2 ? (corner < 2 ? 0.35 : 0.5) : 0.42)
    const cx = (corner === 0 || corner === 3 ? 1 : -1) * (0.5 - radius)
    const cy = (corner < 2 ? 1 : -1) * (0.5 - radius)
    for (let step = 0; step <= 16; step++) {
      const angle = (corner + step / 16) * Math.PI / 2
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)
      const point = {x: origin[0] + axisX[0] * x + axisY[0] * y,
        y: origin[1] + axisX[1] * x + axisY[1] * y}
      const previous = points[points.length - 1]
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 1e-12) points.push(point)
    }
  }
  const first = points[0], last = points[points.length - 1]
  if (points.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) <= 1e-12) points.pop()
  return points
}

function fabricBoundary(fabric) {
  if (!fabric) return []
  const measurement = fabric.measurement
  if (!measurement || !measurement.polygonCm) {
    return [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}, {x: 0, y: 1}]
  }
  const bounds = measurement.boundsCm || fabric
  const polygon = measurement.polygonCm.map(point => ({x: point.x / bounds.width, y: point.y / bounds.height}))
  return validQuad(polygon) ? polygon : []
}

function validatePlacements(design, fabrics, layout, modelId = 'bear') {
  const { faces } = getModel(modelId)
  const boundaries = new Map(fabrics.map(fabric => [fabric.id, fabricBoundary(fabric)]))
  const parts = faces.map(() => ({ valid: true, errors: {} }))
  const entries = []
  let ready = true
  faces.forEach((ids, part) => {
    const pieces = design[part] && design[part].pieces || []
    pieces.forEach(piece => {
      if (!ids[piece.index]) return
      const placement = layout ? texturePlacement(piece, pieceLayout(layout, modelId, part)) : piece.placement
      const outline = pieceOutline(part, placement, modelId)
      const error = { outside: false, overlaps: [], invalid: false }
      parts[part].errors[piece.index] = error
      if (!outline) {
        parts[part].valid = false
        if (placement) error.outside = error.invalid = true
        else ready = false
        return
      }
      const boundary = boundaries.get(piece.fabricId) || []
      error.outside = !boundary.length || outline.some(point => !inside(point, boundary)) ||
        outline.some(point => point.x < -1e-9 || point.y < -1e-9 || point.x > 1 + 1e-9 || point.y > 1 + 1e-9)
      entries.push({ part, piece, outline, error })
    })
  })
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i]
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j]
      if (a.piece.fabricId !== b.piece.fabricId || !overlap(a.outline, b.outline)) continue
      a.error.overlaps.push({ part: b.part, index: b.piece.index })
      b.error.overlaps.push({ part: a.part, index: a.piece.index })
    }
  }
  entries.forEach(({ part, error }) => {
    error.invalid = error.outside || error.overlaps.length > 0
    if (error.invalid) parts[part].valid = false
  })
  return { ready, parts }
}

module.exports = { texturePlacement, pieceOutline, fabricBoundary, validatePlacements }
