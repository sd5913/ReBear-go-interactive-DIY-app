const partNames = ['Head', 'Body', 'Ears', 'Arms', 'Legs']

function currentAssignment(fabrics, design) {
  const fabricsById = new Map(fabrics.map(fabric => [fabric.id, fabric]))
  const swatches = new Map()
  const rows = partNames.map((part, index) => {
    const pieces = design[index] && Array.isArray(design[index].pieces)
      ? design[index].pieces : []
    const groups = new Map()
    pieces.forEach(piece => {
      const fabric = fabricsById.get(piece.fabricId)
      if (!fabric || !fabric.image) return
      if (!swatches.has(fabric.id)) {
        swatches.set(fabric.id, { id: fabric.id, image: fabric.image, name: fabric.name || '', ref: 'F' + (swatches.size + 1) })
      }
      if (!groups.has(fabric.id)) {
        groups.set(fabric.id, Object.assign({}, swatches.get(fabric.id), { pieces: [] }))
      }
      groups.get(fabric.id).pieces.push(piece.label)
    })
    return { part, fabrics: Array.from(groups.values()) }
  })
  return { rows, swatches: Array.from(swatches.values()), complete: rows.every(row => row.fabrics.length > 0) }
}

function photoPrompt(rows) {
  const lines = rows.map(row => {
    const materials = row.fabrics.map(fabric => fabric.ref + ' (pattern pieces ' + fabric.pieces.join(', ') + ')')
    return row.part + ': ' + materials.join('; ')
  })
  return [
    'Create one photorealistic product photo of a handmade patchwork stuffed teddy bear. Use the attached numbered ReBear fabric sheet as the material reference.',
    'Match the visible color, print, spacing and direction of each referenced swatch. Keep fabrics on their assigned parts. If a part has multiple swatches, show each as a separate sewn patch within that part; do not put it on another part.'
  ].concat(lines, 'Single centered full-body shot with both ears, both arms and both feet clearly visible. Use a slight three-quarter angle, soft even lighting, a transparent background, and no props, text, badges, or labels.').join('\n')
}

module.exports = { currentAssignment, photoPrompt }
