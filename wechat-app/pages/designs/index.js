const copy = require('../../utils/design-copy')
const { getLanguage } = require('../../utils/i18n')
const { updateThumbnail, listDesigns, deleteDesigns, designView, displayDate } = require('../../utils/design-records')
const { getModel } = require('../../utils/model-catalog')

Page({
  data: { t: copy.en, language: 'en', records: [], managing: false, selectedIds: [], deleteIds: [], error: '', repairItems: [] },
  onShow() {
    this.closed=false;
    if(!this.thumbnailAttempts)this.thumbnailAttempts=new Set();
    if(!this.failedThumbnails)this.failedThumbnails=new Set();
    const language = getLanguage()
    this.setData({ language, t: copy[language] })
    wx.setNavigationBarTitle({ title: copy[language].title })
    this.refresh()
  },
  refresh() {
    try {
      const records = listDesigns().map(record => {
        const model = getModel(record.modelId)
        return {
          id: record.id, name: record.name, date: displayDate(record.updatedAt),
          modelId: model.id, modelName: model.names[this.data.language],
          thumbnail: record.thumbnailVersion===2&&!this.failedThumbnails?.has(record.id)?record.thumbnail:model.thumbnail,
          thumbnails: designView(record.design, record.fabrics, model.parts[this.data.language], this.data.t.fabric, model.id).thumbnails,
          selected: this.data.selectedIds.includes(record.id)
        }
      })
      const selectedIds = this.data.selectedIds.filter(id => records.some(record => record.id === id))
      this.setData({ records, selectedIds, error: '', managing: records.length > 0 && this.data.managing })
      this.repairNextThumbnail()
    } catch (_) {
      this.setData({ error: this.data.t.saveError })
    }
  },
  onUnload(){this.closed=true;},
  thumbnailError(event){
    this.failedThumbnails.add(event.currentTarget.dataset.id);
    this.refresh();
  },
  repairNextThumbnail(){
    if(this.closed||this.repairActive)return;
    const record=listDesigns().find(item=>
      (item.thumbnailVersion!==2||!item.thumbnail||this.failedThumbnails.has(item.id))&&!this.thumbnailAttempts.has(item.id));
    if(!record){this.setData({repairItems:[]});return;}
    this.thumbnailAttempts.add(record.id);
    this.repairActive=record;
    const model=getModel(record.modelId);
    const view=designView(record.design,record.fabrics,model.parts[this.data.language],this.data.t.fabric,model.id);
    this.setData({repairItems:[{id:record.id,modelId:model.id,fabrics:record.fabrics,assignments:view.assignments}]});
  },
  skipThumbnailRepair(event){
    if(this.repairActive?.id!==event.currentTarget.dataset.id)return;
    this.repairActive=null;
    if(!this.closed)this.setData({repairItems:[]},()=>this.refresh());
  },
  async repairThumbnail(event){
    const record=this.repairActive;
    if(!record||record.id!==event.currentTarget.dataset.id)return;
    try{
      const preview=this.selectComponent('#thumbnail-repair');
      const thumbnail=await preview.captureThumbnail();
      updateThumbnail(record.id,thumbnail,record.updatedAt);
      this.failedThumbnails.delete(record.id);
    }catch(error){console.warn('ReBear thumbnail repair',error);}
    finally{
      this.repairActive=null;
      if(!this.closed){this.setData({repairItems:[]},()=>this.refresh());}
    }
  },
  toggleManage() {
    this.setData({ managing: !this.data.managing, selectedIds: [] })
    this.refresh()
  },
  open(event) {
    const id = event.currentTarget.dataset.id
    if (this.data.managing) {
      const selectedIds = this.data.selectedIds.includes(id)
        ? this.data.selectedIds.filter(value => value !== id) : this.data.selectedIds.concat(id)
      this.setData({ selectedIds })
      this.refresh()
      return
    }
    wx.navigateTo({ url: '/pages/design-detail/index?id=' + encodeURIComponent(id) })
  },
  edit(event) {
    wx.navigateTo({ url: '/package-design/pages/design/design?id=' + encodeURIComponent(event.currentTarget.dataset.id) })
  },
  selectAll() {
    const all = this.data.records.length === this.data.selectedIds.length
    this.setData({ selectedIds: all ? [] : this.data.records.map(record => record.id) })
    this.refresh()
  },
  remove(event) { this.setData({ deleteIds: [event.currentTarget.dataset.id] }) },
  removeSelected() { if (this.data.selectedIds.length) this.setData({ deleteIds: this.data.selectedIds.slice() }) },
  closeDelete() { this.setData({ deleteIds: [] }) },
  confirmDelete() {
    try {
      deleteDesigns(this.data.deleteIds)
      this.closeDelete()
      this.refresh()
    } catch (_) {
      wx.showToast({ title: this.data.t.saveError, icon: 'none' })
    }
  },
  upload() { wx.reLaunch({ url: '/pages/fabric/fabric' }) },
  stop() {}
})
