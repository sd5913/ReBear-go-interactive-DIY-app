const { faces, migrateDesign } = require('./bear-layout')
const { validatePlacements } = require('./pattern-placement')
const STORAGE_KEY = 'rebear-saved-designs'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function listDesigns() {
  const records = wx.getStorageSync(STORAGE_KEY) || []
  if (!Array.isArray(records)) throw new Error('Invalid design storage')
  return records
}

function findDesign(id) {
  return listDesigns().find(record => record.id === id)
}

function isComplete(design, fabrics) {
  const available = new Set(fabrics.map(fabric => fabric.id))
  const validation = validatePlacements(design, fabrics)
  return validation.ready && faces.every((ids, part) => {
    const record = design[part]
    if (!record || !record.confirmed || !Array.isArray(record.pieces)) return false
    const assigned = new Set(record.pieces.filter(piece => available.has(piece.fabricId)).map(piece => piece.index))
    return validation.parts[part].valid && ids.every((_, index) => assigned.has(index))
  })
}

function saveDesign(name, design, fabrics, id) {
  const records = listDesigns()
  const previous = id && records.find(record => record.id === id)
  if (id && !previous) throw new Error('Design no longer exists')
  const normalized = migrateDesign(clone(design))
  if (!isComplete(normalized, fabrics)) throw new Error('Incomplete design')
  const used = new Set(faces.flatMap((_, part) => normalized[part].pieces.map(piece => piece.fabricId)))
  const now = Date.now()
  const record = {
    id: previous ? previous.id : 'design-' + now + '-' + Math.random().toString(36).slice(2, 8),
    name: name.trim().slice(0, 40),
    createdAt: previous ? previous.createdAt : now,
    updatedAt: now,
    design: normalized,
    // Each saved scheme owns its fabric references, dimensions and measured placement.
    fabrics: clone(fabrics.filter(fabric => used.has(fabric.id)))
  }
  if (!record.name) throw new Error('Name required')
  const updated = previous ? records.map(item => item.id === id ? record : item) : [record, ...records]
  wx.setStorageSync(STORAGE_KEY, updated)
  return record
}

function deleteDesigns(ids) {
  const selected = new Set(ids)
  wx.setStorageSync(STORAGE_KEY, listDesigns().filter(record => !selected.has(record.id)))
}

function designView(design, fabrics, partNames, fabricLabel) {
  const rows = faces.map((ids, part) => {
    const pieces = design[part] && Array.isArray(design[part].pieces) ? design[part].pieces : []
    return {
      name: partNames[part], count: ids.length,
      assignments: pieces.map(piece => {
        const fabric = fabrics.find(item => item.id === piece.fabricId)
        const number = fabrics.findIndex(item => item.id === piece.fabricId) + 1
        return { label: piece.label || String.fromCharCode(65 + piece.index), fabric: number,
          name: fabric ? fabric.name || fabricLabel + ' ' + number : '—' }
      })
    }
  })
  const assignments = {}
  faces.forEach((ids, part) => {
    const pieces = design[part] && design[part].pieces || []
    pieces.forEach(piece => {
      if (ids[piece.index]) assignments[ids[piece.index]] = Object.assign({}, piece.placement, { fabricId: piece.fabricId })
    })
  })
  const thumbnails = faces.map((ids, part) => {
    const assignment = assignments[ids[0]]
    const fabric = assignment && fabrics.find(item => item.id === assignment.fabricId)
    return fabric ? fabric.image : ''
  })
  const materials = fabrics.filter(fabric => Object.values(assignments).some(item => item.fabricId === fabric.id)).map((fabric, index) => ({
    ...fabric,
    displayName: fabric.name || fabricLabel + ' ' + (index + 1),
    parts: partNames.filter((_, part) => (design[part]?.pieces || []).some(piece => piece.fabricId === fabric.id)).join('、')
  }))
  return { rows, assignments, thumbnails, materials }
}

function displayDate(timestamp) {
  const date = new Date(timestamp)
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('.')
}

module.exports = { listDesigns, findDesign, saveDesign, deleteDesigns, isComplete, designView, displayDate }
