const copy = {
  zh: {
    title: '设计你的小熊',
    heading: '把裁片摆到布料上',
    parts: ['头部', '身体', '耳朵', '手臂'],
    piece: '裁片',
    placed: '已摆放',
    hint: '点击模型上的部位切换裁片；先选布料，再点裁片摆放。拖动调整位置，双指缩放时全部部位会同步变化。',
    fabric: '布料',
    add: '添加裁片',
    rotate: '旋转选中裁片',
    reset: '重新摆放',
    confirm: '确认当前部位',
    done: '查看图纸与清单',
    need: '请先放入全部裁片',
    all: '请先确认全部四个部位',
    select: '请先选择一块裁片',
    saved: '当前部位已保存',
    missing: '布料已删除，请重新摆放',
    back: '返回添加布料',
    size: '实际布料尺寸',
    confirmed: '已确认',
    fixPlacement: '请先调整标红裁片，避免重叠或超出布料范围。',
    checking: '正在检查裁片位置…',
    interactionHint: '拖动点击不同部位，选择对应布料',
    exitTitle: '您还没有保存，确定退出吗？',
    saveTitle: '保存至设计稿',
    namePlaceholder: '方案名称',
    thinkAgain: '再想想',
    savingText: '保存中…',
    exit: '退出',
    save: '保存',
    saveNameRequired: '请填写方案名称',
    saveFallback: '已保存，但无法打开我的设计，请返回查看',
    saveFailed: '保存失败',
    retry: '请重试',
    incompleteDesign: '请先确认所有部位并检查裁片位置'
  },
  en: {
    title: 'Design Your Bear',
    heading: 'Place pieces on your fabric',
    parts: ['Head', 'Body', 'Ears', 'Arms'],
    piece: 'pieces',
    placed: 'placed',
    hint: 'Tap a model part to switch pieces. Choose a fabric, then tap a piece to place it. Drag to move; pinch to resize all parts together.',
    fabric: 'Fabric',
    add: 'Add a piece',
    rotate: 'Rotate selected',
    reset: 'Reset this part',
    confirm: 'Confirm This Part',
    done: 'View Pattern & Checklist',
    need: 'Place all pieces first',
    all: 'Confirm all four parts first',
    select: 'Select a piece first',
    saved: 'Part saved',
    missing: 'Fabric was deleted. Place these pieces again.',
    back: 'Back to Fabrics',
    size: 'Measured fabric size',
    confirmed: 'Confirmed',
    fixPlacement: 'Adjust the red pieces to keep them inside the fabric and apart.',
    checking: 'Checking piece positions…',
    interactionHint: 'Tap or drag a part to choose its fabric',
    exitTitle: 'You have not saved this design. Exit anyway?',
    saveTitle: 'Save to Designs',
    namePlaceholder: 'Design name',
    thinkAgain: 'Keep Editing',
    savingText: 'Saving…',
    exit: 'Exit',
    save: 'Save',
    saveNameRequired: 'Enter a design name',
    saveFallback: 'Saved, but My Designs could not be opened. Please return to view it.',
    saveFailed: 'Could not save the design',
    retry: 'Please try again.',
    incompleteDesign: 'Confirm every part and check the pattern pieces first.'
  }
};

const { texturePlacement, validatePlacements } = require('../../../utils/pattern-placement');

const { findDesign, saveDesign } = require('../../../utils/design-records');
const { getModel, draftKey, activeModelId, migrateModelDesign, pieceLayout, fabricLayout, pieceMask, pieceSize } = require('../../../utils/model-catalog');

const {
  armLabels
} = require('../../../utils/bear-layout');

Page({
  data: {
    t: copy.en,
    language: 'en',
    modelId: 'bear',
    pieceWidth: 116,
    pieceHeight: 140,
    pieceMask: '',
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
    ,exitDialog:false, saveDialog:false, saveName:'', saving:false
  },

  onLoad(options) {
    let language = 'en';
    let design = {};

    try {
      language = wx.getStorageSync('rebear-language') === 'zh' ? 'zh' : 'en';
    } catch (e) {}

    this.design = {};
    this.hasChanges=false;
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
    // A fresh design session always starts empty; only an explicit saved-design edit loads data.
    try { wx.removeStorageSync(this.draftKey); } catch (_) {}
    this.design = migrateModelDesign(this.record ? JSON.parse(JSON.stringify(this.record.design)) : {}, model.id);
    if (!Number.isFinite(Number(this.design.__sizeScale)) || Number(this.design.__sizeScale) <= 0) this.design.__sizeScale = 1;
    this.library = [];

    const t = { ...copy[language], parts: model.parts[language] };
    t.back = this.record ? (language === 'en' ? 'Back to Design Details' : '返回设计详情') :
      (language === 'en' ? 'Back to Model Selection' : '返回选择模型');
    if (model.id === 'cushion') Object.assign(t, language === 'en' ? {
      title: 'Design Your Cushion', all: 'Confirm all cushion parts first'
    } : { title: '设计你的坐垫', all: '请先确认坐垫的全部部位' });
    if (model.id === 'rabbit') Object.assign(t, language === 'en' ? {
      title: 'Design Your Rabbit', all: 'Confirm all rabbit parts first'
    } : { title: '设计你的小兔', all: '请先确认小兔的全部部位' });
    if (model.id === 'cat') Object.assign(t, language === 'en' ? {
      title: 'Design Your Cat', all: 'Confirm both cat parts first'
    } : { title: '设计你的小猫', all: '请先确认小猫的全部部位' });

    this.setData({
      language,
      modelId: model.id,
      t
    });

    wx.setNavigationBarTitle({
      title: t.title
    });
    if (!this.record && wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({message: t.exitTitle});
    }

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

  onUnload() {
    if(this.piecePositionTimer){clearTimeout(this.piecePositionTimer);this.piecePositionTimer=null;}
    this.pendingPiecePosition=null;
    if (!this.record) { try { wx.removeStorageSync(this.draftKey); } catch (_) {} }
  },

  onReady() {
    this.measureLayout();
  },

  onResize() {
    this.measureLayout();
  },

  // 裁片位置和手势统一使用布料场景中的 px。
  // 这里将现有 WXSS 中的 rpx 尺寸转换为同一坐标单位。
  measureLayout() {
    if (!this.faces || !this.library.length) return;
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const unit = info.windowWidth / 750;
    const contentWidth=info.windowWidth-80*unit;
    const maxWidth = Math.max(180*unit,contentWidth*.7), maxHeight = 600 * unit;
    const fabricSizes = {};
    this.library.forEach(fabric => {
      const bounds = fabric.measurement?.boundsCm || fabric;
      const ratio = Number(bounds.width) / Number(bounds.height) || 1;
      const width = Math.min(maxWidth, maxHeight * ratio);
      fabricSizes[fabric.id] = {width, height:width / ratio};
    });
    const previous = this.layout;
    this.layout = {width:maxWidth,height:maxHeight,unit,pieceWidth:116*unit,pieceHeight:140*unit,padding:10*unit,fabricSizes};
    if (previous && previous.unit !== unit) this.faces.forEach((_,part) => {
      (this.design[part]?.pieces || []).forEach(piece => {
        const old = texturePlacement(piece,pieceLayout(fabricLayout(previous,piece.fabricId),this.modelId,part,this.design.__sizeScale));
        const current = fabricLayout(this.layout,piece.fabricId);
        const [w,h] = this.pieceSizePixels(part,piece.index);
        piece.x = old.origin[0]*current.width - w*this.design.__sizeScale/2;
        piece.y = old.origin[1]*current.height - h*this.design.__sizeScale/2;
      });
    });
    if (!previous && this.record) this.faces.forEach((_,part) => {
      (this.design[part]?.pieces || []).forEach(piece => {
        if (!piece.placement?.origin) return;
        const current=fabricLayout(this.layout,piece.fabricId);
        const [w,h]=this.pieceSizePixels(part,piece.index);
        piece.x=piece.placement.origin[0]*current.width-w*this.design.__sizeScale/2;
        piece.y=piece.placement.origin[1]*current.height-h*this.design.__sizeScale/2;
      });
    });
    this.loadPart(this.data.part,this.data.selected);
  },

  // 将裁片位置和旋转转换成布料图片中的采样坐标。
  // 先在 px 坐标中旋转，再分别除以布料宽高，
  // 避免非正方形布料上的旋转产生比例错误。
  texturePlacement(piece, part = this.data.part) {
    return texturePlacement(piece, pieceLayout(fabricLayout(this.layout, piece.fabricId), this.modelId, part, this.design.__sizeScale)) || { fabricId: piece.fabricId };
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

    this.measureLayout();
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
            width: pieceSize(this.modelId, index, p.index)[0],
            height: pieceSize(this.modelId, index, p.index)[1],
            scaleX: getModel(this.modelId).pieceScales?.[index]?.[p.index]?.[0] || 1,
            scaleY: getModel(this.modelId).pieceScales?.[index]?.[p.index]?.[1] || 1,
            sizeScale: Number(this.design.__sizeScale) || 1,
            mask: pieceMask(this.modelId, index, p.index),
            label: p.label || String.fromCharCode(65 + p.index)
          });
        }
      }

    });

    const seamOverlays = [];
    const validation = validatePlacements(this.design, this.library, this.layout, this.modelId, seamOverlays);
    const placementReady = Boolean(this.layout) && validation.ready;
    const confirmed = faces.map((ids, index) => {
      const record = this.design[index];
      if (!record) return false;
      // Temporary collisions suspend validity without erasing another part’s confirmation.
      return Boolean(record.confirmed && record.pieces.length === ids.length &&
        placementReady && validation.parts[index].valid);
    });
    const pieceErrors = validation.parts[part].errors;
    placedGhosts.forEach(ghost => {
      ghost.invalid = Boolean(validation.parts[ghost.part].errors[ghost.index]?.invalid);
      ghost.status = ghost.invalid ? '!' : confirmed[ghost.part] ? '✓' : '…';
    });
    const fabricId = this.data.items[this.data.fabricIndex]?.id;
    const cloth = fabricLayout(this.layout, fabricId);
    this.visibleSeams = seamOverlays.filter(seam => seam.fabricId === fabricId);



    const pieces = this.design[part]?.pieces || [];
    const invalidSlot=Object.keys(pieceErrors).find(key=>pieceErrors[key].invalid);
    const countComplete=pieces.length===faces[part].length;
    const en=this.data.language==='en';
    const error=invalidSlot!==undefined?pieceErrors[invalidSlot]:null;
    let currentIssue='';
    if(error){
      const label=String.fromCharCode(65+Number(invalidSlot));
      if(error.outside)currentIssue=en?'Piece '+label+' is outside the fabric.':'裁片 '+label+' 超出布料范围。';
      else {
        const other=error.overlaps[0];
        currentIssue=en?'Piece '+label+' overlaps '+this.data.t.parts[other.part]+' '+String.fromCharCode(65+other.index)+'.':
          '裁片 '+label+' 与'+this.data.t.parts[other.part]+' '+String.fromCharCode(65+other.index)+' 重叠。';
      }
    }else if(!countComplete)currentIssue=this.data.t.need;
    else if(!confirmed[part])currentIssue=en?'Position valid. Confirm this part to continue.':'位置正常，请确认当前部位。';


    const model = getModel(this.modelId);
    const slots = faces[part].map((_, index) => ({
      index,
      label: String.fromCharCode(65 + index),
      name: model.pieceNames?.[this.data.language]?.[part]?.[index] || (this.modelId === 'bear' && part === 3 ? armLabels[this.data.language][index] : this.modelId === 'bear' && part === 2 ? (this.data.language === 'en' ? ['Left ear','Right ear'][index] : ['左耳','右耳'][index]) : ''),
      placed: pieces.some(p => p.index === index),
      invalid: Boolean(pieceErrors[index] && pieceErrors[index].invalid)
    }));
    const piecesWithMasks = pieces.map(piece => ({...piece, width: pieceSize(this.modelId, part, piece.index)[0], height: pieceSize(this.modelId, part, piece.index)[1], mask: pieceMask(this.modelId, part, piece.index), scaleX: model.pieceScales?.[part]?.[piece.index]?.[0] || 1, scaleY: model.pieceScales?.[part]?.[piece.index]?.[1] || 1, sizeScale: Number(this.design.__sizeScale) || 1}));

    this.setData({
      part,
      currentIssue,
      confirmedCount:confirmed.filter(Boolean).length, partCount:faces.length,
      clothWidth: cloth ? cloth.width / cloth.unit : 670,
      clothHeight: cloth ? cloth.height / cloth.unit : 350,
      pieceWidth: pieceSize(this.modelId, part, 0)[0],
      pieceHeight: pieceSize(this.modelId, part, 0)[1],
      pieces: piecesWithMasks,
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
    }, () => this.drawSeamLines(cloth));
  },

  drawSeamLines(cloth) {
    if (!cloth || !this.data.items.length) {
      this.seamCanvas = null;
      return;
    }
    if (!this.seamCanvas) {
      if (this.seamCanvasPending || !this.createSelectorQuery) return;
      this.seamCanvasPending = true;
      this.createSelectorQuery().select('#seam-canvas').fields({ node: true }, result => {
        this.seamCanvasPending = false;
        if (!result?.node || !this.data.items.length) return;
        this.seamCanvas = result.node;
        this.drawSeamLines(fabricLayout(this.layout, this.data.items[this.data.fabricIndex]?.id));
      }).exec();
      return;
    }

    const canvas = this.seamCanvas;
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const dpr = Math.min(info.pixelRatio || 1, 3);
    const width = Math.max(1, Math.round(cloth.width * dpr));
    const height = Math.max(1, Math.round(cloth.height * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext('2d');
    context.setTransform(width / cloth.width, 0, 0, height / cloth.height, 0, 0);
    context.clearRect(0, 0, cloth.width, cloth.height);
    context.setLineDash([4, 3]);
    context.lineJoin = 'round';
    for (const invalid of [false, true]) {
      context.strokeStyle = invalid ? '#c7352b' : '#53605b';
      context.lineWidth = invalid ? 1.8 : 1.25;
      for (const seam of this.visibleSeams) {
        if (seam.error.invalid !== invalid) continue;
        for (const path of seam.paths) {
          context.beginPath();
          path.forEach((point, index) => {
            const x = point.x * cloth.width;
            const y = point.y * cloth.height;
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.closePath();
          context.stroke();
        }
      }
    }
  },

  selectPart(e) {
    this.loadPart(Number(e.currentTarget.dataset.index));
  },

  onModelPartSelect(e) {
    const part=Number(e.detail.index);
    if(Number.isInteger(part)&&part>=0&&part<this.faces.length)this.loadPart(part);
  },

  selectGhost(e) {
    const part=Number(e.currentTarget.dataset.part),slot=Number(e.currentTarget.dataset.slot);
    const selected=this.design[part].pieces.findIndex(p=>p.index===slot);
    this.loadPart(part,selected);
  },

  selectFabric(e) {
    this.setData({
      fabricIndex: Number(e.currentTarget.dataset.index),
      selected: -1
    });
    this.loadPart(this.data.part);
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

  pieceSizePixels(part, index) {
    const model = getModel(this.modelId);
    const size = pieceSize(this.modelId, part, index);
    const scale = model.pieceScales?.[part]?.[index] || [1, 1];
    const unit = this.layout?.unit || ((wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowWidth / 750);
    return [size[0] * scale[0] * unit, size[1] * scale[1] * unit];
  },

  pieceTouchStart(e) {
    if (!e.touches || !e.touches.length) return;
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    if(this.pinch)return;
    if (e.touches.length === 1) {
      this.setData({selected:index});
      const touch=e.touches[0], piece=this.design[this.data.part]?.pieces[index];
      if(piece)this.pieceDrag={index,x:Number(touch.clientX??touch.pageX??touch.x),y:Number(touch.clientY??touch.pageY??touch.y),px:piece.x,py:piece.y};
      return;
    }
    const activeIndex=Number.isInteger(this.pieceDrag?.index)?this.pieceDrag.index:Number(this.data.selected);
    if(activeIndex>=0)this.beginPiecePinch(e.touches,activeIndex);
  },

  beginPiecePinch(touches,index){
    if(this.piecePositionTimer){clearTimeout(this.piecePositionTimer);this.piecePositionTimer=null;}
    this.flushPiecePosition();
    this.pieceDrag=null;
    const point=touch=>({x:Number(touch.clientX??touch.pageX??touch.x),y:Number(touch.clientY??touch.pageY??touch.y)});
    const first=point(touches[0]),second=point(touches[1]);
    if(![first.x,first.y,second.x,second.y].every(Number.isFinite))return null;
    const distance=Math.max(1,Math.hypot(first.x-second.x,first.y-second.y));
    const piece=this.design[this.data.part]?.pieces[index];
    this.pinch={
      index,
      startDistance:distance,
      startScale:Number(this.design.__sizeScale)||1,
      startAngle:Math.atan2(second.y-first.y,second.x-first.x)*180/Math.PI,
      startRotation:Number(piece?.angle)||0,
      design:JSON.parse(JSON.stringify(this.design))
    };
    this.setData({selected:index});
    return this.pinch;
  },

  pieceTouchMove(e) {
    if (!e.touches || !e.touches.length) return;
    let gesture=this.pinch;
    if(!gesture&&e.touches.length>=2){
      const activeIndex=Number.isInteger(this.pieceDrag?.index)?this.pieceDrag.index:Number(this.data.selected);
      if(activeIndex>=0)gesture=this.beginPiecePinch(e.touches,activeIndex);
    }
    if (!gesture) {
      const drag=this.pieceDrag;
      if(!drag || e.touches.length!==1)return;
      const touch=e.touches[0];
      const x=drag.px+Number(touch.clientX??touch.pageX??touch.x)-drag.x;
      const y=drag.py+Number(touch.clientY??touch.pageY??touch.y)-drag.y;
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      this.pendingPiecePosition={index:drag.index,part:this.data.part,x,y};
      if(!this.piecePositionTimer){
        const wait=Math.max(0,32-(Date.now()-(this.piecePositionRenderedAt||0)));
        this.piecePositionTimer=setTimeout(()=>{
          this.piecePositionTimer=null;
          this.flushPiecePosition();
        },wait);
      }
      return;
    }
    if(e.touches.length<2)return;
    const point = touch => ({x: Number(touch.clientX ?? touch.pageX ?? touch.x), y: Number(touch.clientY ?? touch.pageY ?? touch.y)});
    const first = point(e.touches[0]);
    const second = point(e.touches[1]);
    if(![first.x,first.y,second.x,second.y].every(Number.isFinite))return;
    const distance = Math.max(1, Math.hypot(first.x - second.x, first.y - second.y));
    const sizeScale = Math.max(.5, Math.min(2.5, gesture.startScale * distance / gesture.startDistance));
    const angle=Math.atan2(second.y-first.y,second.x-first.x)*180/Math.PI;
    let rotationDelta=angle-gesture.startAngle;
    if(rotationDelta>180)rotationDelta-=360;
    else if(rotationDelta < -180)rotationDelta+=360;
    const rotation=((gesture.startRotation+rotationDelta)%360+360)%360;
    const scaleChanged=Math.abs(sizeScale-gesture.startScale)>=.005;
    const rotationChanged=Math.abs(rotationDelta)>=.5;
    if(!scaleChanged&&!rotationChanged)return;

    this.design = JSON.parse(JSON.stringify(gesture.design));
    const delta = sizeScale - gesture.startScale;
    this.faces.forEach((_, part) => {
      (this.design[part]?.pieces || []).forEach(piece => {
        const [width, height] = this.pieceSizePixels(part, piece.index);
        piece.x = (Number(piece.x) || 0) - width * delta / 2;
        piece.y = (Number(piece.y) || 0) - height * delta / 2;
      });
    });
    const selectedPiece=this.design[this.data.part]?.pieces[gesture.index];
    if(selectedPiece)selectedPiece.angle=rotation;
    this.faces.forEach((_,part)=>{if(this.design[part]?.pieces?.length)this.design[part].confirmed=false;});
    this.design.__sizeScale = sizeScale;
    this.hasChanges = true;
    const activePieces=this.design[this.data.part]?.pieces||[];
    this.setData({pieces:this.data.pieces.map((piece,index)=>activePieces[index]?{
      ...piece,x:activePieces[index].x,y:activePieces[index].y,angle:activePieces[index].angle||0,sizeScale
    }:piece)});
  },

  pieceTouchEnd(e) {
    const drag=this.pieceDrag;
    const dragged=Boolean(drag);
    this.pieceDrag=null;
    if(dragged){
      const touch=e.changedTouches&&e.changedTouches[0];
      if(touch){
        const x=drag.px+Number(touch.clientX??touch.pageX??touch.x)-drag.x;
        const y=drag.py+Number(touch.clientY??touch.pageY??touch.y)-drag.y;
        if(Number.isFinite(x)&&Number.isFinite(y))this.pendingPiecePosition={index:drag.index,part:this.data.part,x,y};
      }
      if(this.piecePositionTimer){clearTimeout(this.piecePositionTimer);this.piecePositionTimer=null;}
      this.flushPiecePosition();
      this.loadPart(this.data.part,drag.index);
      this.store();
    }
    if (!this.pinch || (e.touches && e.touches.length >= 2)) return;
    const selected = this.pinch.index;
    this.pinch = null;
    this.loadPart(this.data.part, selected);
    this.store();
  },

  // Drag updates only the moving piece. Defer placement validation and seam redraw until release.
  flushPiecePosition(){
    const next=this.pendingPiecePosition;
    this.pendingPiecePosition=null;
    if(!next)return;
    const source=this.design[next.part]?.pieces;
    if(!source||!source[next.index])return;
    const pieces=source.map((piece,index)=>index===next.index?{...piece,x:next.x,y:next.y}:piece);
    this.design[next.part].pieces=pieces;
    this.hasChanges=true;
    this.piecePositionRenderedAt=Date.now();
    const visible=this.data.pieces.map((piece,index)=>index===next.index?{...piece,x:next.x,y:next.y}:piece);
    this.setData({pieces:visible});
  },

  restartForRescale() {
    this.design = {__sizeScale: 1};
    this.faces.forEach((_, part) => {
      this.design[part] = {
        pieces: [],
        confirmed: false,
        ...(this.modelId === 'bear' && part === 3 ? {layoutVersion: 2} : {})
      };
    });
    this.hasChanges = true;
    this.pinch = null;
    this.loadPart(this.data.part, -1);
    this.store();
  },

  updatePieces(pieces, selected, part = this.data.part, persist = true) {
    this.hasChanges=true;
    this.design[part] = {
      pieces,
      confirmed: false,
      ...(this.modelId === 'bear' && part === 3 ? { layoutVersion: 2 } : {})
    };

    this.loadPart(part, selected);
    if(persist)this.store();
  },

  rotate() {
    const i = this.data.selected;

    if (i < 0) {
      this.toast(this.data.t.select);
      return;
    }

    const pieces = this.design[this.data.part].pieces.map((p, n) => n === i ? {
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
    this.hasChanges=true;

    if (!this.store()) {
      this.design[part].confirmed = false;
      return;
    }

    const preview=this.selectComponent('#bear-preview');
    if(preview&&preview.playConfirmation)preview.playConfirmation(part);

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
    if(this.hasChanges&&!this.record){this.setData({exitDialog:true});return;}
    wx.navigateBack();
  },
  cancelExit(){this.setData({exitDialog:false});},
  cancelDialog(){
    if(this.data.exitDialog)this.cancelExit();
    else this.cancelSave();
  },
  confirmDialog(){
    if(this.data.exitDialog)this.confirmExit();
    else this.saveToDesigns();
  },
  confirmExit(){try{wx.removeStorageSync(this.draftKey)}catch(_){}this.hasChanges=false;if(wx.disableAlertBeforeUnload)wx.disableAlertBeforeUnload();this.setData({exitDialog:false});wx.navigateBack();},
  explainIncomplete(){
    this.loadPart(this.data.part,this.data.selected);
    const validation=validatePlacements(this.design,this.library,this.layout,this.modelId);
    const part=this.faces.findIndex((ids,i)=>!this.design[i]?.confirmed || this.design[i].pieces.length!==ids.length || !validation.parts[i].valid);
    if(part<0)return false;
    const errors=validation.parts[part].errors;
    const slot=Object.keys(errors).find(key=>errors[key].invalid);
    let reason=this.data.language==='en'?'Confirm this part first':'请确认此部位';
    if(slot!==undefined){
      const error=errors[slot];
      reason=(this.data.language==='en'?'Piece ':'裁片 ')+String.fromCharCode(65+Number(slot))+' '+
        (error.outside?(this.data.language==='en'?'is outside the fabric':'超出布料范围'):(this.data.language==='en'?'overlaps another piece':'与其他裁片重叠'));
      const piece=this.design[part].pieces.find(p=>p.index===Number(slot));
      const fabricIndex=this.data.items.findIndex(f=>f.id===piece?.fabricId);
      if(fabricIndex>=0)this.setData({fabricIndex});
    }else if((this.design[part]?.pieces.length||0)!==this.faces[part].length) reason=this.data.t.need;
    const target=this.design[part]?.pieces.find(p=>slot!==undefined?p.index===Number(slot):true);
    if(target){
      const fabricIndex=this.data.items.findIndex(f=>f.id===target.fabricId);
      if(fabricIndex>=0)this.setData({fabricIndex});
    }
    this.loadPart(part);
    wx.showModal({title:this.data.t.parts[part],content:reason,showCancel:false});
    return true;
  },
  openSave(){
    if(this.explainIncomplete())return;
    this.setData({saveName:this.record?.name||'',saveDialog:true});
  },
  inputSaveName(e){this.setData({saveName:e.detail.value});},
  cancelSave(){this.setData({saveDialog:false});},
  stopDialog(){},
  async saveToDesigns(){
    if(this.data.saving)return;
    if(this.explainIncomplete()){this.setData({saveDialog:false});return;}
    if(!(this.data.saveName||'').trim()){this.toast(this.data.t.saveNameRequired);return;}
    this.setData({saving:true});
    try{
      const d=JSON.parse(JSON.stringify(this.design));
      this.faces.forEach((_,i)=>(d[i].pieces||[]).forEach(p=>{p.placement=this.texturePlacement(p,i)}));
      let thumbnail='';
      const preview=this.selectComponent('#bear-preview');
      if(preview&&preview.captureThumbnail)try{thumbnail=await preview.captureThumbnail();}catch(error){console.warn('Could not capture model preview',error);}
      saveDesign(this.data.saveName,d,this.library,this.record&&this.record.id,this.modelId,thumbnail);
      try{wx.removeStorageSync(this.draftKey)}catch(_){}
      this.hasChanges=false;
      if(wx.disableAlertBeforeUnload)wx.disableAlertBeforeUnload();
      wx.reLaunch({url:'/pages/designs/index',fail:()=>this.toast(this.data.t.saveFallback)});
    }catch(e){
      this.setData({saving:false});
      console.error('Save design failed',e);
      const message=e&&e.message==='Incomplete design'?this.data.t.incompleteDesign:
        e&&e.message==='Name required'?this.data.t.saveNameRequired:
        this.data.t.saveFailed+': '+(e&&e.message||this.data.t.retry);
      this.toast(message);
    }
  }
});
