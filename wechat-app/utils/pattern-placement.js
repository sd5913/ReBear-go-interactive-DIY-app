const { validQuad } = require('./a4-geometry')
const { getModel, pieceLayout, fabricLayout } = require('./model-catalog')

const { maskContours, fabricDimensions, seamPaths, normalizeSeams, seamsOverlap } = require('./seam-allowance')

// Coordinates match the outer edge of .piece, excluding .piece-wrap padding.
function texturePlacement(piece, layout) {
  if (!layout) return null
  const angle = (Number(piece.angle) || 0) * Math.PI / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const scale = layout.pieceScales && layout.pieceScales[piece.index] || [1, 1]
  const pieceWidth = layout.pieceWidth * scale[0]
  const pieceHeight = layout.pieceHeight * scale[1]
  let width = pieceWidth - 2 * layout.padding * scale[0]
  let height = pieceHeight - 2 * layout.padding * scale[1]
  // Bear mask PNGs are square and displayed using aspectFit.
  if (layout.pieceScales) width = height = Math.min(width, height)
  return {
    fabricId: piece.fabricId,
    pixelSize: [1/layout.width, 1/layout.height],
    origin: [((Number(piece.x) || 0) + pieceWidth / 2) / layout.width,
      ((Number(piece.y) || 0) + pieceHeight / 2) / layout.height],
    axisX: [width * cos / layout.width, width * sin / layout.height],
    axisY: [-height * sin / layout.width, height * cos / layout.height]
  }
}

function shapeFor(part, modelId, slot) {
  if (modelId !== 'bear') return part === 2 ? 'rectangle' : 'circle'
  if (part === 0) return 'head'
  if (part === 1) return 'body'
  if (part === 2) return slot === 0 ? 'left-ears' : 'right-ears'
  return slot === 0 ? 'left-arm' : 'right-arm'
}

const rectangle = [{ x: -.5, y: -.5 }, { x: .5, y: -.5 }, { x: .5, y: .5 }, { x: -.5, y: .5 }]
const circle = Array.from({ length: 64 }, (_, index) => {
  const angle = index * Math.PI / 32
  return { x: .5 * Math.cos(angle), y: .5 * Math.sin(angle) }
})

function piecePaths(shape) {
  if (shape === 'rectangle') return [rectangle]
  if (shape === 'circle') return [circle]
  return maskContours(shape)
}

function validPlacement(placement) {
  return placement && [placement.origin, placement.axisX, placement.axisY].every(
    axis => Array.isArray(axis) && axis.length === 2 && axis.every(Number.isFinite)
  ) && Math.abs(placement.axisX[0] * placement.axisY[1] - placement.axisX[1] * placement.axisY[0]) > 1e-12
}

function pieceOutline(part, placement, modelId = 'bear', slot = 0) {
  if (!validPlacement(placement)) return null
  const { origin, axisX, axisY } = placement
  return piecePaths(shapeFor(part, modelId, slot)).flat().map(p => ({
    x: origin[0] + p.x * axisX[0] + p.y * axisY[0],
    y: origin[1] + p.x * axisX[1] + p.y * axisY[1]
  }))
}

function bounds(paths) {
  const result = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }
  for (const path of paths) for (const p of path) {
    result.left = Math.min(result.left, p.X)
    result.right = Math.max(result.right, p.X)
    result.top = Math.min(result.top, p.Y)
    result.bottom = Math.max(result.bottom, p.Y)
  }
  return result
}

function intersects(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

function cross(a, b, p) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
}

function withinBoundary(paths, boundary, dimensions) {
  if (!boundary.length) return false
  const signs = Math.sign(cross(boundary[0], boundary[1], boundary[2]))
  return boundary.every((a, i) => {
    const b = boundary[(i + 1) % boundary.length]
    // Tolerate rounding of integer clipping coordinates near the edge (0.01 mm).
    const tolerance = Math.hypot((b.y-a.y)/dimensions.width, (b.x-a.x)/dimensions.height) * .001
    return paths.every(path => path.every(p => signs * cross(a, b, p) >= -tolerance))
  })
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

function validatePlacements(design, fabrics, layout, modelId = 'bear', seamOverlays) {
  const { faces } = getModel(modelId)
  const fabricGeometry = new Map(fabrics.map(fabric => [fabric.id, {
    boundary: fabricBoundary(fabric), dimensions: fabricDimensions(fabric)
  }]))
  const parts = faces.map(() => ({ valid: true, errors: {} }))
  const entries = []
  let ready = true
  faces.forEach((ids, part) => {
    const pieces = design[part] && design[part].pieces || []
    pieces.forEach(piece => {
      if (!ids[piece.index]) return
      const placement = layout ? texturePlacement(piece, pieceLayout(fabricLayout(layout, piece.fabricId), modelId, part, design.__sizeScale)) : piece.placement
      const error = { outside: false, overlaps: [], invalid: false }
      parts[part].errors[piece.index] = error
      const geometry = fabricGeometry.get(piece.fabricId)
      if (!validPlacement(placement) || !geometry?.dimensions) {
        parts[part].valid = false
        if (placement) error.outside = error.invalid = true
        else ready = false
        return
      }
      const shape = shapeFor(part, modelId, piece.index)
      const paths = seamPaths(shape, piecePaths(shape), placement, geometry.dimensions)
      const normalized = normalizeSeams(paths, geometry.dimensions)
      error.outside = !paths.length || !withinBoundary(normalized, geometry.boundary, geometry.dimensions)
      entries.push({ part, piece, paths, error, bounds: bounds(paths) })
      if (seamOverlays) seamOverlays.push({ fabricId: piece.fabricId, paths: normalized, error })
    })
  })
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i]
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j]
      if (a.piece.fabricId !== b.piece.fabricId || !intersects(a.bounds, b.bounds) || !seamsOverlap(a.paths, b.paths)) continue
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
