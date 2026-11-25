const Clipper = require('./vendor/clipper')

// Integer clipping units: one unit is 0.01 mm.
const UNITS_PER_CM = 1000
const SEAM_ALLOWANCE_CM = 1
const MASK_UNITS = 96000
const masks = require('./pattern-masks')
const contours = new Map()
const offsets = new Map()

function clip(subject, operation, other = []) {
  const clipper = new Clipper.Clipper()
  clipper.AddPaths(subject, Clipper.PolyType.ptSubject, true)
  if (other.length) clipper.AddPaths(other, Clipper.PolyType.ptClip, true)
  const result = new Clipper.Paths()
  clipper.Execute(operation, result, Clipper.PolyFillType.pftNonZero, Clipper.PolyFillType.pftNonZero)
  return result
}

function maskContours(name) {
  if (!contours.has(name)) {
    const strips = masks[name].map(strip => strip.map(([x, y]) => ({
      X: Math.round((x - .5) * MASK_UNITS),
      Y: Math.round((y - .5) * MASK_UNITS)
    })))
    // Union strips before offsetting so interior grid edges cannot appear in the cut line.
    const silhouette = clip(strips, Clipper.ClipType.ctUnion)
    contours.set(name, silhouette.map(path => path.map(p => ({ x: p.X / MASK_UNITS, y: p.Y / MASK_UNITS }))))
  }
  return contours.get(name)
}

function fabricDimensions(fabric) {
  const dimensions = fabric?.measurement?.boundsCm || fabric
  const width = Number(dimensions?.width)
  const height = Number(dimensions?.height)
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? { width, height } : null
}

function seamPaths(shape, outline, placement, dimensions) {
  const xUnits = dimensions.width * UNITS_PER_CM
  const yUnits = dimensions.height * UNITS_PER_CM
  const x = Math.round(placement.origin[0] * xUnits)
  const y = Math.round(placement.origin[1] * yUnits)
  const axisX = [placement.axisX[0] * xUnits, placement.axisX[1] * yUnits]
  const axisY = [placement.axisY[0] * xUnits, placement.axisY[1] * yUnits]
  const signature = axisX.concat(axisY).join(',')
  let cached = offsets.get(shape)
  if (cached?.signature !== signature) {
    const paths = outline.map(path => path.map(p => ({
      X: Math.round(p.x * axisX[0] + p.y * axisY[0]),
      Y: Math.round(p.x * axisX[1] + p.y * axisY[1])
    })))
    const offset = new Clipper.ClipperOffset(2, 5)
    offset.AddPaths(paths, Clipper.JoinType.jtRound, Clipper.EndType.etClosedPolygon)
    const expanded = new Clipper.Paths()
    offset.Execute(expanded, SEAM_ALLOWANCE_CM * UNITS_PER_CM)
    // Dragging changes only the origin. Cache one outline per shape for the hot path.
    cached = { signature, expanded }
    offsets.set(shape, cached)
  }
  return cached.expanded.map(path => path.map(p => ({ X: p.X + x, Y: p.Y + y })))
}

function normalizeSeams(paths, dimensions) {
  const xUnits = dimensions.width * UNITS_PER_CM
  const yUnits = dimensions.height * UNITS_PER_CM
  return paths.map(path => path.map(p => ({ x: p.X / xUnits, y: p.Y / yUnits })))
}

function seamsOverlap(a, b) {
  return clip(a, Clipper.ClipType.ctIntersection, b)
    .some(path => Math.abs(Clipper.Clipper.Area(path)) > 1)
}

module.exports = { maskContours, fabricDimensions, seamPaths, normalizeSeams, seamsOverlap }
