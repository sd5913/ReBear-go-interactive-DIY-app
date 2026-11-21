const { faces, migrateDesign } = require('./bear-layout')

const models = [
  {
    id: 'bear',
    names: { zh: '小熊', en: 'Bear' },
    asset: '/assets/bear-material/bear.glb',
    thumbnail: '/assets/bear-model.png',
    difficulty: 4,
    faces,
    // Full-body UV atlas is an equal-scale reference. Its normalized bounds
    // define the relative cut dimensions for every bear piece.
    uvAtlas: '/assets/bear-material/temples.png',
    uvAtlasSize: [1024, 1024],
    // Relative bounds read from temples.png. Head is the reference piece.
    // Ear/arm rows contain left and right pieces with separate dimensions.
    pieceScales: [
      [[1, 1]],
      [[1.12, 1.86]],
      [[0.44, 0.72], [0.44, 0.72]],
      [[0.72, 1.32], [0.72, 1.32]]
    ],
    parts: { zh: ['头部', '身体', '耳朵', '手臂'], en: ['Head', 'Body', 'Ears', 'Arms'] }
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
function pieceLayout(layout, modelId, part, sizeScale = 1) {
  const sizes = getModel(modelId).pieceSizes
  if (!layout) return layout
  const model = getModel(modelId)
  let result = { ...layout }
  if (model.id === 'bear' && model.pieceScales) {
    result.pieceScales = model.pieceScales[part]
  } else if (sizes) {
    const unit = layout.padding / 10
    result.pieceWidth = sizes[part][0] * unit
    result.pieceHeight = sizes[part][1] * unit
  }
  const factor = Number(sizeScale)
  if (Number.isFinite(factor) && factor > 0 && factor !== 1) {
    result.pieceWidth *= factor
    result.pieceHeight *= factor
    result.padding *= factor
  }
  return result
}

module.exports = { models, getModel, draftKey, activeModelId, migrateModelDesign, pieceLayout }
