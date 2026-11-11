module.exports = {
  zh: {
    title: '小熊预览', sample: '已生成的样例', mine: '我的搭配',
    photo: '拟真照片', model: '3D 模型', parts: ['头部', '身体', '耳朵', '手臂', '腿部'],
    fabric: '布料', unassigned: '未选布料', swatches: '小熊各部位的用布',
    sampleFabrics: ['蓝白条纹', '蓝底方格'], photoHint: '对照照片和下面的布料，检查花纹有没有用错部位。',
    modelHint: '左右拖动看侧面和背面，双指缩放。背面花纹由模型推测。',
    sampleNote: '这张样例照片由两块示例布料生成，3D 模型来自同一张照片。',
    mineNote: '先导出布料参考图和提示词，生成照片后导入核对，再用同一张照片生成 GLB。',
    missingParts: '先返回拼布页，给每个部位至少放一片裁片。',
    noPhoto: '导入按当前布料搭配生成的照片', noModel: '先导入拟真照片，再导入对应的 GLB。',
    noSampleModel: '这个样例暂无 3D 模型。', importPhoto: '导入照片', replacePhoto: '更换照片',
    openPhoto: '查看原图', importModel: '导入 GLB', exportBoard: '预览布料参考图',
    copyPrompt: '复制生图提示词', boardName: 'ReBear · 布料参考', load: '正在加载 3D 模型…',
    loadFail: '无法显示模型。请试用支持 XR-Frame 的微信版本，或换一个 GLB 文件。',
    retry: '重新加载', wrongFile: '请选择有效的 .glb 文件（不超过 25 MB）。',
    tooLarge: '图片处理失败，请换一张较小的照片。', boardError: '读取布料图片失败，请检查布料库。',
    creatingBoard: '正在准备参考图', loadTimeout: '模型加载超时，请重试。', noXR: '当前环境无法加载 3D，可先查看拟真照片。'
  },
  en: {
    title: 'Bear Preview', sample: 'Generated sample', mine: 'My fabrics',
    photo: 'Bear photo', model: '3D model', parts: ['Head', 'Body', 'Ears', 'Arms', 'Legs'],
    fabric: 'Fabric', unassigned: 'Unassigned', swatches: 'Fabric by bear part',
    sampleFabrics: ['Blue and ivory stripes', 'Ivory squares on blue'], photoHint: 'Compare the photo with the fabrics below.',
    modelHint: 'Drag to see the sides and back. Pinch to zoom. Hidden patterns are inferred.',
    sampleNote: 'This photo was generated from two sample fabrics. The 3D model uses the same photo.',
    mineNote: 'Export the references and prompt. Import the resulting photo to check it, then use that same photo to generate a GLB.',
    missingParts: 'Return to Patchwork and place at least one piece on every part.',
    noPhoto: 'Import the bear photo generated for these fabrics', noModel: 'Import the photo first, then its GLB.',
    noSampleModel: 'A 3D model is unavailable for this sample.', importPhoto: 'Import photo', replacePhoto: 'Replace photo',
    openPhoto: 'View full photo', importModel: 'Import GLB', exportBoard: 'View fabric reference sheet',
    copyPrompt: 'Copy photo prompt', boardName: 'ReBear · Fabric reference', load: 'Loading 3D model…',
    loadFail: 'Unable to display the model. Try WeChat with XR-Frame support or choose another GLB.',
    retry: 'Retry', wrongFile: 'Select a valid .glb file under 25 MB.',
    tooLarge: 'Could not read the photo. Try a smaller image.', boardError: 'Could not read the fabric photos.',
    creatingBoard: 'Preparing fabric sheet', loadTimeout: 'Model loading timed out. Try again.', noXR: '3D is unavailable here. The photo is still available.'
  }
}
