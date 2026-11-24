const { validQuad } = require('./a4-geometry')
const { getModel, pieceLayout, fabricLayout } = require('./model-catalog')

const masks = require('./pattern-masks')

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

function pieceOutline(part, placement, modelId = 'bear', slot = 0) {
  if (!placement || ![placement.origin, placement.axisX, placement.axisY].every(
    axis => Array.isArray(axis) && axis.length === 2 && axis.every(Number.isFinite)
  )) return null
  const { origin, axisX, axisY } = placement
  if (Math.abs(axisX[0] * axisY[1] - axisX[1] * axisY[0]) < 1e-12) return null
  if (modelId === 'bear') return maskPolygons(part, placement, slot).flat()
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

function maskPolygons(part, placement, slot) {
  const name = part === 0 ? 'head' : part === 1 ? 'body' :
    part === 2 ? (slot === 0 ? 'left-ears' : 'right-ears') : (slot === 0 ? 'left-arm' : 'right-arm')
  return masks[name].map(poly => poly.map(([x,y]) => ({
    x: placement.origin[0] + placement.axisX[0]*(x-.5) + placement.axisY[0]*(y-.5),
    y: placement.origin[1] + placement.axisX[1]*(x-.5) + placement.axisY[1]*(y-.5)
  })))
}
function bounds(poly) {
  return {left:Math.min(...poly.map(p=>p.x)),right:Math.max(...poly.map(p=>p.x)),
    top:Math.min(...poly.map(p=>p.y)),bottom:Math.max(...poly.map(p=>p.y))}
}
function intersects(a,b) {
  return a.left < b.right-1e-9 && b.left < a.right-1e-9 && a.top < b.bottom-1e-9 && b.top < a.bottom-1e-9
}

// Clip convex silhouette strips; tolerate at most one displayed pixel of area.
function cross(a,b,p){return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)}
function signedArea(poly){return poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p.x*q.y-p.y*q.x},0)/2}
function intersectionArea(subject,clip){
  let output=subject;
  const sign=Math.sign(signedArea(clip));
  for(let i=0;i<clip.length&&output.length;i++){
    const a=clip[i],b=clip[(i+1)%clip.length],input=output;
    output=[];
    let previous=input[input.length-1],pd=sign*cross(a,b,previous);
    for(const point of input){
      const d=sign*cross(a,b,point);
      if((d>=0)!==(pd>=0)){
        const t=pd/(pd-d);
        output.push({x:previous.x+(point.x-previous.x)*t,y:previous.y+(point.y-previous.y)*t});
      }
      if(d>=0)output.push(point);
      previous=point;pd=d;
    }
  }
  return output.length>=3?Math.abs(signedArea(output)):0;
}
function withinBoundary(point,boundary,pixel){
  const sign=Math.sign(signedArea(boundary));
  return boundary.every((a,i)=>{
    const b=boundary[(i+1)%boundary.length];
    const tolerance=.5*Math.hypot((b.y-a.y)*pixel[0],(b.x-a.x)*pixel[1]);
    return sign*cross(a,b,point)>=-tolerance-1e-12;
  });
}
function piecesOverlap(a,b){
  if(!intersects(a.bounds,b.bounds))return false;
  const tolerance=Math.min(a.pixel[0]*a.pixel[1],b.pixel[0]*b.pixel[1]);
  let area=0;
  for(const x of a.polygons)for(const y of b.polygons){
    if(!intersects(x.bounds,y.bounds))continue;
    area+=intersectionArea(x.poly,y.poly);
    if(area>tolerance)return true;
  }
  return false;
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
      const placement = layout ? texturePlacement(piece, pieceLayout(fabricLayout(layout, piece.fabricId), modelId, part, design.__sizeScale)) : piece.placement
      const outline = pieceOutline(part, placement, modelId, piece.index)
      const error = { outside: false, overlaps: [], invalid: false }
      parts[part].errors[piece.index] = error
      if (!outline) {
        parts[part].valid = false
        if (placement) error.outside = error.invalid = true
        else ready = false
        return
      }
      const boundary = boundaries.get(piece.fabricId) || []
      const pixel = Array.isArray(placement.pixelSize) && placement.pixelSize.length===2 && placement.pixelSize.every(v=>Number.isFinite(v)&&v>0) ? placement.pixelSize : [1e-6,1e-6]
      error.outside = !boundary.length || outline.some(point => !withinBoundary(point, boundary, pixel)) ||
        outline.some(point => point.x < -pixel[0]/2 || point.y < -pixel[1]/2 || point.x > 1 + pixel[0]/2 || point.y > 1 + pixel[1]/2)
      const polygons = modelId === 'bear' ? maskPolygons(part, placement, piece.index) : [outline]
      entries.push({ part, piece, outline, error, pixel, bounds:bounds(outline), polygons:polygons.map(poly=>({poly,bounds:bounds(poly)})) })
    })
  })
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i]
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j]
      if (a.piece.fabricId !== b.piece.fabricId || !piecesOverlap(a,b)) continue
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
