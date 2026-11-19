const copy = {
  zh: {
    title: '设计你的小熊',
    heading: '把裁片摆到布料上',
    parts: ['头部', '身体', '耳朵', '手臂', '腿部'],
    piece: '裁片',
    placed: '已摆放',
    hint: '先选布料，再点裁片摆放。拖动裁片可调整位置。',
    fabric: '布料',
    add: '添加裁片',
    rotate: '旋转选中裁片',
    reset: '重新摆放',
    confirm: '确认当前部位',
    done: '查看图纸与清单',
    need: '请先放入全部裁片',
    all: '请先确认全部五个部位',
    select: '请先选择一块裁片',
    saved: '当前部位已保存',
    missing: '布料已删除，请重新摆放',
    back: '返回添加布料',
    size: '实际布料尺寸',
    confirmed: '已确认',
    fixPlacement: '请先调整标红裁片，避免重叠或超出布料范围。',
    checking: '正在检查裁片位置…'
  },
  en: {
    title: 'Design Your Bear',
    heading: 'Place pieces on your fabric',
    parts: ['Head', 'Body', 'Ears', 'Arms', 'Legs'],
    piece: 'pieces',
    placed: 'placed',
    hint: 'Choose a fabric, then tap a piece to place it. Drag the piece to position it.',
    fabric: 'Fabric',
    add: 'Add a piece',
    rotate: 'Rotate selected',
    reset: 'Reset this part',
    confirm: 'Confirm This Part',
    done: 'View Pattern & Checklist',
    need: 'Place all pieces first',
    all: 'Confirm all five parts first',
    select: 'Select a piece first',
    saved: 'Part saved',
    missing: 'Fabric was deleted. Place these pieces again.',
    back: 'Back to Fabrics',
    size: 'Measured fabric size',
    confirmed: 'Confirmed',
    fixPlacement: 'Adjust the red pieces to keep them inside the fabric and apart.',
    checking: 'Checking piece positions…'
  }
};

const { texturePlacement, validatePlacements } = require('../../utils/pattern-placement');

const { findDesign } = require('../../utils/design-records');
const { getModel, draftKey, activeModelId, migrateModelDesign, pieceLayout } = require('../../utils/model-catalog');

const {
  armLabels
} = require('../../utils/bear-layout');

Page({
  data: {
    t: copy.zh,
    language: 'zh',
    modelId: 'bear',
    pieceWidth: 116,
    pieceHeight: 140,
    items: [],
    part: 0,
    parts: [],
    pieces: [],
    placedGhosts: [],
    slots: [],
    selected: -1,
    fabricIndex: 0,
    confirmed: [],
    allDone: false,
    canConfirm: false,
    placementReady: false,
    pieceErrors: {},
    previewFabrics: [],
    assignments: {},
    drag: null
  },

  onLoad(options) {
    let language = 'zh';
    let design = {};

    try {
      language = wx.getStorageSync('rebear-language') === 'en' ? 'en' : 'zh';
    } catch (e) {}

    this.design = {};
    this.library = [];
    try { this.record = options.id ? findDesign(options.id) : null; }
    catch (_) { this.record = null; }
    if (options.id && !this.record) {
      this.invalidRecord = true;
      wx.reLaunch({url:'/pages/designs/index'});
      return;
    }
    const model = getModel(this.record ? this.record.modelId : (options.model || activeModelId()));
    this.modelId = model.id;
    this.faces = model.faces;
    this.draftKey = draftKey(model.id);
    try { design = wx.getStorageSync(this.draftKey) || {}; } catch (_) {}
    this.design = migrateModelDesign(this.record ? JSON.parse(JSON.stringify(this.record.design)) : design, model.id);
    this.library = [];

    const t = { ...copy[language], parts: model.parts[language] };
    t.back = this.record ? (language === 'en' ? 'Back to Design Details' : '返回设计详情') :
      (language === 'en' ? 'Back to Model Selection' : '返回选择模型');
    if (model.id === 'cushion') Object.assign(t, language === 'en' ? {
      title: 'Design Your Cushion', all: 'Confirm all cushion parts first'
    } : { title: '设计你的坐垫', all: '请先确认坐垫的全部部位' });

    this.setData({
      language,
      modelId: model.id,
      t
    });

    wx.setNavigationBarTitle({
      title: t.title
    });

    const channel = this.getOpenerEventChannel();
    if (channel && typeof channel.on === 'function') {
      channel.on('selectedFabrics', ({ ids }) => {
        this.selectedIds = new Set(ids);
        this.refreshFabrics();
      });
    }
  },

  onShow() {
    if (this.invalidRecord) return;
    try {
      this.library = wx.getStorageSync('rebear-fabrics') || [];
    } catch (e) {
      this.library = [];
    }

    if (this.record) {
      const library = new Map(this.library.map(fabric => [fabric.id, fabric]));
      this.record.fabrics.forEach(fabric => library.set(fabric.id, fabric));
      this.library = Array.from(library.values());
      this.selectedIds = new Set(this.record.fabrics.map(fabric => fabric.id));
    }
    this.refreshFabrics();
  },

  onReady() {
    this.measureLayout();
  },

  onResize() {
    this.measureLayout();
  },

  // movable-view 的 x/y 使用 px。
  // 这里将现有 WXSS 中的 rpx 尺寸转换为同一坐标单位。
  measureLayout() {
    this.createSelectorQuery()
      .select('.cloth-image')
      .boundingClientRect(rect => {
        if (!rect || !rect.width || !rect.height) return;

        const info = wx.getWindowInfo
          ? wx.getWindowInfo()
          : wx.getSystemInfoSync();

        const unit = info.windowWidth / 750;

        // 对应现有 design.wxss：
        // .piece-wrap：116rpx × 140rpx，padding：10rpx。
        this.layout = {
          width: rect.width,
          height: rect.height,
          pieceWidth: 116 * unit,
          pieceHeight: 140 * unit,
          padding: 10 * unit
        };

        this.loadPart(this.data.part, this.data.selected);
      })
      .exec();
  },

  // 将裁片位置和旋转转换成布料图片中的采样坐标。
  // 先在 px 坐标中旋转，再分别除以布料宽高，
  // 避免非正方形布料上的旋转产生比例错误。
  texturePlacement(piece, part = this.data.part) {
    return texturePlacement(piece, pieceLayout(this.layout, this.modelId, part)) || { fabricId: piece.fabricId };
  },

  refreshFabrics() {
    const items = this.library
      .map((f, index) => ({
        ...f,
        number: index + 1
      }))
      .filter(f => !this.selectedIds || this.selectedIds.has(f.id));

    const active = this.data.items[this.data.fabricIndex];

    const fabricIndex = Math.max(
      0,
      items.findIndex(f => active && f.id === active.id)
    );

    this.setData({
      items,
      fabricIndex
    });

    this.loadPart(this.data.part);
  },

  loadPart(part, selected = -1) {
    const available = new Set(this.library.map(f => f.id));
    const assignments = {};
    const used = new Set(this.data.items.map(f => f.id));
    const placedGhosts = [];

    const faces = this.faces;
    faces.forEach((ids, index) => {
      const record = this.design[index];

      if (!record) return;

      const pieces = record.pieces.filter(
        p => ids[p.index] && available.has(p.fabricId)
      );

      if (pieces.length !== record.pieces.length) {
        record.pieces = pieces;
        record.confirmed = false;
      }

      for (const p of pieces) {
        // 每个模型部位都有独立的位置和旋转信息。
        assignments[ids[p.index]] = this.texturePlacement(p, index);
        used.add(p.fabricId);
        if (index !== part) {
          placedGhosts.push({
            ...p,
            id: ids[p.index],
            part: index,
            width: getModel(this.modelId).pieceSizes?.[index][0] || 116,
            height: getModel(this.modelId).pieceSizes?.[index][1] || 140,
            label: p.label || String.fromCharCode(65 + p.index)
          });
        }
      }

    });

    const validation = validatePlacements(this.design, this.library, this.layout, this.modelId);
    const placementReady = Boolean(this.layout) && validation.ready;
    const confirmed = faces.map((ids, index) => {
      const record = this.design[index];
      if (!record) return false;
      if (placementReady && !validation.parts[index].valid) record.confirmed = false;
      return Boolean(record.confirmed && record.pieces.length === ids.length &&
        placementReady && validation.parts[index].valid);
    });
    const pieceErrors = validation.parts[part].errors;


    const pieces = this.design[part]?.pieces || [];

    const slots = faces[part].map((_, index) => ({
      index,
      label: String.fromCharCode(65 + index),
      name: this.modelId === 'bear' && part === 3 ? armLabels[this.data.language][index] : '',
      placed: pieces.some(p => p.index === index),
      invalid: Boolean(pieceErrors[index] && pieceErrors[index].invalid)
    }));

    this.setData({
      part,
      pieceWidth: getModel(this.modelId).pieceSizes?.[part][0] || 116,
      pieceHeight: getModel(this.modelId).pieceSizes?.[part][1] || 140,
      pieces,
      placedGhosts,
      slots,
      selected,
      confirmed,
      pieceErrors,
      placementReady,
      canConfirm: placementReady && validation.parts[part].valid && pieces.length === faces[part].length,

      parts: this.data.t.parts.map((name, index) => ({
        name,
        index,
        done: confirmed[index],
        invalid: Object.values(validation.parts[index].errors).some(error => error.invalid)
      })),

      allDone: confirmed.every(Boolean),
      assignments,

      previewFabrics: this.library.filter(f => used.has(f.id))
    }, () => {
      if (!this.layout && this.data.items.length) {
        this.measureLayout();
      }
    });
  },

  selectPart(e) {
    this.loadPart(Number(e.currentTarget.dataset.index));
  },

  selectFabric(e) {
    this.setData({
      fabricIndex: Number(e.currentTarget.dataset.index),
      selected: -1
    });
  },

  addPiece(e) {
    const fabric = this.data.items[this.data.fabricIndex];

    if (fabric) {
      this.place(
        this.data.part,
        Number(e.currentTarget.dataset.index),
        fabric.id
      );
    }
  },

  place(part, index, fabricId) {
    const pieces = this.design[part]?.pieces || [];
    const existing = pieces.findIndex(p => p.index === index);

    if (existing >= 0 && pieces[existing].fabricId === fabricId) {
      this.loadPart(part, existing);
      return;
    }

    const piece = {
      index,
      label: String.fromCharCode(65 + index),
      fabricId,
      x: 15 + index * 38,
      y: 25 + index * 15,
      angle: 0
    };

    const next = pieces.slice();

    if (existing < 0) {
      next.push(piece);
    } else {
      next[existing] = piece;
    }

    this.updatePieces(
      next,
      existing < 0 ? next.length - 1 : existing,
      part
    );
  },

  onAssignFabric(e) {
    const { partId, fabricId } = e.detail;
    const faces = this.faces;

    const part = faces.findIndex(ids => ids.includes(partId));
    const fabricIndex = this.data.items.findIndex(f => f.id === fabricId);

    if (part < 0 || fabricIndex < 0) return;

    this.setData({
      fabricIndex
    });

    this.place(part, faces[part].indexOf(partId), fabricId);
  },

  fabricStart(e) {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];

    this.fabricDrag = {
      id: e.currentTarget.dataset.id,
      x: touch.clientX,
      y: touch.clientY,
      moved: false
    };

    this.selectComponent('#bear-preview')?.measureDropArea();
  },

  fabricMove(e) {
    const drag = this.fabricDrag;

    if (!drag || e.touches.length !== 1) return;

    const t = e.touches[0];
    const x = t.clientX;
    const y = t.clientY;

    if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) < 8) {
      return;
    }

    drag.moved = true;

    const fabric = this.data.items.find(f => f.id === drag.id);
    if (!fabric) return;

    this.setData({
      drag: {
        x: x + 8,
        y: y + 8,
        image: fabric.image
      }
    });

    this.selectComponent('#bear-preview')?.dragFabric(drag.id, x, y);
  },

  fabricEnd(e) {
    const drag = this.fabricDrag;
    this.fabricDrag = null;

    if (!drag?.moved) return;

    this.setData({
      drag: null
    });

    const touch = e.changedTouches[0];
    const preview = this.selectComponent('#bear-preview');

    if (touch) {
      preview?.dragFabric(
        drag.id,
        touch.clientX,
        touch.clientY,
        true
      );
    } else {
      preview?.cancelDrag();
    }
  },

  fabricCancel() {
    this.fabricDrag = null;

    this.setData({
      drag: null
    });

    this.selectComponent('#bear-preview')?.cancelDrag();
  },

  pick(e) {
    this.setData({
      selected: Number(e.currentTarget.dataset.index)
    });
  },

  move(e) {
    if (!e.detail.source) return;
    if (!Number.isFinite(e.detail.x) || !Number.isFinite(e.detail.y)) return;

    const i = Number(e.currentTarget.dataset.index);
    const current = this.data.pieces[i];
    if (!current || (current.x === e.detail.x && current.y === e.detail.y)) return;

    const pieces = this.data.pieces.map((p, n) => n === i ? {
      ...p,
      x: e.detail.x,
      y: e.detail.y
    } : p);

    this.updatePieces(pieces, i);
  },

  updatePieces(pieces, selected, part = this.data.part) {
    this.design[part] = {
      pieces,
      confirmed: false,
      ...(this.modelId === 'bear' && part === 3 ? { layoutVersion: 2 } : {})
    };

    this.loadPart(part, selected);
    this.store();
  },

  rotate() {
    const i = this.data.selected;

    if (i < 0) {
      this.toast(this.data.t.select);
      return;
    }

    const pieces = this.data.pieces.map((p, n) => n === i ? {
      ...p,
      angle: (p.angle + 45) % 360
    } : p);

    this.updatePieces(pieces, i);
  },

  reset() {
    this.updatePieces([], -1);
  },

  confirm() {
    this.loadPart(this.data.part, this.data.selected);
    if (this.data.pieces.length !== this.faces[this.data.part].length) {
      this.toast(this.data.t.need);
      return;
    }

    if (!this.data.canConfirm) {
      this.toast(this.data.placementReady ? this.data.t.fixPlacement : this.data.t.checking);
      return;
    }

    const part = this.data.part;
    this.design[part].confirmed = true;

    if (!this.store()) {
      this.design[part].confirmed = false;
      return;
    }

    this.loadPart(part);
    this.toast(this.data.t.saved);

    const next = this.data.confirmed.findIndex(value => !value);

    if (next >= 0) {
      this.loadPart(next);
    }
  },

  store() {
    if (this.record) return true;
    try {
      const design = JSON.parse(JSON.stringify(this.design));
      if (this.layout) this.faces.forEach((_, part) => {
        (design[part]?.pieces || []).forEach(piece => { piece.placement = this.texturePlacement(piece, part); });
      });
      wx.setStorageSync(this.draftKey, design);
      return true;
    } catch (e) {
      this.toast(
        this.data.language === 'en'
          ? 'Could not save progress'
          : '进度保存失败，请重试'
      );

      return false;
    }
  },

  toast(title) {
    wx.showToast({
      title,
      icon: 'none'
    });
  },

  guide() {
    this.loadPart(this.data.part, this.data.selected);
    if (!this.data.allDone) {
      this.toast(this.data.t.all);
      return;
    }

    const design = JSON.parse(JSON.stringify(this.design));
    this.faces.forEach((_, part) => design[part].pieces.forEach(piece => {
      piece.placement = this.texturePlacement(piece, part);
    }));
    wx.navigateTo({
      url: '/pages/guide/guide?model=' + this.modelId + (this.record ? '&id=' + encodeURIComponent(this.record.id) : ''),
      success: page => page.eventChannel.emit('design', { design, fabrics: this.library, modelId: this.modelId })
    });
  },

  back() {
    wx.navigateBack();
  }
});
