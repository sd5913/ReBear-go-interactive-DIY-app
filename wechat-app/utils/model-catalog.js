const { faces, migrateDesign } = require('./bear-layout')

const models = [
  {
    id: 'bear',
    names: { zh: '小熊', en: 'Bear' },
    asset: '/assets/bear-material/bear.glb',
    thumbnail: '/assets/bear-material/bear-png.png',
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
    squareMaskFit: true,
    pieceMasks: [
      ['/package-design/assets/bear-material/head.png'],
      ['/package-design/assets/bear-material/body.png'],
      ['/package-design/assets/bear-material/left-ears.png', '/package-design/assets/bear-material/right-ears.png'],
      ['/package-design/assets/bear-material/left-arm.png', '/package-design/assets/bear-material/right-arm.png']
    ],
    parts: { zh: ['头部', '身体', '耳朵', '手臂'], en: ['Head', 'Body', 'Ears', 'Arms'] }
  },
  {
    id: 'cushion',
    names: { zh: '坐垫', en: 'Cushion' },
    asset: '/assets/cashion-material/cashion.glb',
    uvAtlas: '/assets/cashion-material/cashion-uv.png',
    uvAtlasSize: [1024, 1024],
    thumbnail: '/assets/cashion-material/cashion-png.png',
    difficulty: 2,
    faces: [['cushion_top'], ['cushion_bottom'], ['cushion_side_a', 'cushion_side_b']],
    parts: { zh: ['上面', '下面', '侧围'], en: ['Top', 'Bottom', 'Sides'] },
    pieceMasks: [
      ['/package-design/assets/cushion-material/top.png'],
      ['/package-design/assets/cushion-material/bottom.png'],
      ['/package-design/assets/cushion-material/side-a.png', '/package-design/assets/cushion-material/side-b.png']
    ],
    pieceSizes: [[140, 140], [140, 140], [360, 56]]
  },
  {
    id: 'rabbit',
    names: { zh: '小兔', en: 'Rabbit' },
    asset: '/assets/rabbit-material/rabit.glb',
    thumbnail: '/assets/rabbit-material/rabbit-png.png',
    difficulty: 3,
    uvAtlas: '/assets/rabbit-material/rabit-uv.png',
    uvAtlasSize: [1024, 1024],
    faces: [
      ['rabbit_head_front', 'rabbit_head_back'],
      ['rabbit_body_front', 'rabbit_body_back'],
      ['rabbit_left_ear_front', 'rabbit_left_ear_back', 'rabbit_right_ear_front', 'rabbit_right_ear_back']
    ],
    parts: { zh: ['头部', '身体', '耳朵'], en: ['Head', 'Body', 'Ears'] },
    pieceNames: {
      zh: [[], [], ['左耳正面', '左耳背面', '右耳正面', '右耳背面']],
      en: [[], [], ['Left ear front', 'Left ear back', 'Right ear front', 'Right ear back']]
    },
    pieceMasks: [
      ['/package-design/assets/rabbit-material/head-front.png', '/package-design/assets/rabbit-material/head-back.png'],
      ['/package-design/assets/rabbit-material/body-front.png', '/package-design/assets/rabbit-material/body-back.png'],
      [
        '/package-design/assets/rabbit-material/left-ear-front.png',
        '/package-design/assets/rabbit-material/left-ear-back.png',
        '/package-design/assets/rabbit-material/right-ear-front.png',
        '/package-design/assets/rabbit-material/right-ear-back.png'
      ]
    ],
    pieceSizes: [
      [[120, 118], [120, 118]],
      [[112, 150], [112, 150]],
      [[140, 58], [64, 126], [64, 126], [140, 58]]
    ]
  },
  {
    id: 'cat',
    names: { zh: '小猫', en: 'Cat' },
    asset: '/assets/cat-material/cat.glb',
    thumbnail: '/assets/cat-material/cat.png',
    difficulty: 3,
    uvAtlas: '/assets/cat-material/cat-uv.png',
    uvAtlasSize: [1024, 1024],
    faces: [
      ['cat_head_front', 'cat_head_back'],
      ['cat_body_front', 'cat_body_back']
    ],
    parts: { zh: ['头部', '身体'], en: ['Head', 'Body'] },
    pieceNames: {
      zh: [['正面', '背面'], ['正面', '背面']],
      en: [['Front', 'Back'], ['Front', 'Back']]
    },
    pieceMasks: [
      ['/package-design/assets/cat-material/head-front.png', '/package-design/assets/cat-material/head-back.png'],
      ['/package-design/assets/cat-material/body-front.png', '/package-design/assets/cat-material/body-back.png']
    ],
    pieceSizes: [
      // Sizes account for the 10rpx inset on each edge, keeping the usable
      // front/back areas close to the normalized UV panels' shared aspect ratio.
      [[116, 134], [116, 134]],
      [[120, 257], [120, 257]]
    ]
  }
]

function getModel(id) {
  return models.find(model => model.id === id) || models[0]
}

function draftKey(id) {
  const modelId = getModel(id).id
  return modelId === 'bear' ? 'rebear-design' : modelId === 'cushion' ? 'rebear-design-cushion' : 'rebear-design-' + modelId
}

function activeModelId() {
  try { return getModel(wx.getStorageSync('rebear-active-model')).id }
  catch (_) { return 'bear' }
}

function migrateModelDesign(design, modelId) {
  return getModel(modelId).id === 'bear' ? migrateDesign(design) : design
}

// Resolve model-specific piece dimensions and masks while keeping one editor UI.
function pieceLayout(layout, modelId, part, sizeScale = 1) {
  const sizes = getModel(modelId).pieceSizes
  if (!layout) return layout
  const model = getModel(modelId)
  let result = { ...layout }
  if (model.pieceScales) {
    result.pieceScales = model.pieceScales[part]
    result.squareMaskFit = Boolean(model.squareMaskFit)
  } else if (sizes) {
    const unit = layout.padding / 10
    const partSizes = sizes[part]
    if (Array.isArray(partSizes[0])) {
      result.pieceSlotSizes = partSizes.map(size => [size[0] * unit, size[1] * unit])
      result.pieceWidth = result.pieceSlotSizes[0][0]
      result.pieceHeight = result.pieceSlotSizes[0][1]
    } else {
      result.pieceWidth = partSizes[0] * unit
      result.pieceHeight = partSizes[1] * unit
    }
  }
  const factor = Number(sizeScale)
  if (Number.isFinite(factor) && factor > 0 && factor !== 1) {
    result.pieceWidth *= factor
    result.pieceHeight *= factor
    if (result.pieceSlotSizes) result.pieceSlotSizes = result.pieceSlotSizes.map(size => size.map(value => value * factor))
    result.padding *= factor
  }
  return result
}

function fabricLayout(layout, fabricId) {
  if (!layout) return layout
  return { ...layout, ...(layout.fabricSizes && layout.fabricSizes[fabricId] || {}) }
}

function pieceMask(modelId, part, index) {
  return getModel(modelId).pieceMasks?.[part]?.[index] || ''
}

function pieceSize(modelId, part, index = 0) {
  const sizes = getModel(modelId).pieceSizes?.[part]
  if (!sizes) return [116, 140]
  return Array.isArray(sizes[0]) ? (sizes[index] || sizes[0]) : sizes
}

module.exports = { fabricLayout, models, getModel, draftKey, activeModelId, migrateModelDesign, pieceLayout, pieceMask, pieceSize }
