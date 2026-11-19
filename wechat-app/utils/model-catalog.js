const { faces, migrateDesign } = require('./bear-layout')

const models = [
  {
    id: 'bear',
    names: { zh: '小熊', en: 'Bear' },
    asset: '/assets/rebear.glb',
    thumbnail: '/assets/bear-model.png',
    difficulty: 4,
    faces,
    parts: { zh: ['头部', '身体', '耳朵', '手臂', '腿部'], en: ['Head', 'Body', 'Ears', 'Arms', 'Legs'] }
  },
  {
    id: 'cushion',
    names: { zh: '坐垫', en: 'Cushion' },
    asset: '/assets/cashion.glb',
    thumbnail: '/assets/cushion.png',
    difficulty: 2,
    faces: [['cushion_top'], ['cushion_bottom'], ['cushion_side_a', 'cushion_side_b']],
    parts: { zh: ['上面', '下面', '侧围'], en: ['Top', 'Bottom', 'Sides'] },
    pieceSizes: [[140, 140], [140, 140], [180, 80]]
  }
]

function getModel(id) {
  return models.find(model => model.id === id) || models[0]
}

function draftKey(id) {
  return getModel(id).id === 'bear' ? 'rebear-design' : 'rebear-design-cushion'
}

function activeModelId() {
  try { return getModel(wx.getStorageSync('rebear-active-model')).id }
  catch (_) { return 'bear' }
}

function migrateModelDesign(design, modelId) {
  return getModel(modelId).id === 'bear' ? migrateDesign(design) : design
}

// Preserve the bear's existing piece sizes. Cushion pieces use their own display shapes.
function pieceLayout(layout, modelId, part) {
  const sizes = getModel(modelId).pieceSizes
  if (!layout || !sizes) return layout
  const unit = layout.padding / 10
  return { ...layout, pieceWidth: sizes[part][0] * unit, pieceHeight: sizes[part][1] * unit }
}

module.exports = { models, getModel, draftKey, activeModelId, migrateModelDesign, pieceLayout }
