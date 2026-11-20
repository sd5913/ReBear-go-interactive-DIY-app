const faces=[
  ['head_front'],
  ['body_front'],
  ['earL_front','earR_front'],
  ['armL_upper','armR_upper'],
];

const armLabels={
  zh:['左臂','右臂'],
  en:['Left arm','Right arm']
};

function migrateDesign(design){
  if(!design)return design;
  const next={...design};
  // Existing drafts stored front/back slots for every UV image. Keep the first
  // placement for each actual image; each GLB UV image already contains both sides.
  const keep=(record, indexes)=>record&&Array.isArray(record.pieces)?{...record,pieces:record.pieces.filter(piece=>indexes.includes(piece.index)).map((piece,index)=>({...piece,index,label:String.fromCharCode(65+index)})),confirmed:false}:record;
  next[0]=keep(next[0],[0]);
  next[1]=keep(next[1],[0]);
  if(next[2]&&Array.isArray(next[2].pieces)) next[2]={...next[2],pieces:next[2].pieces.filter(p=>p.index===0||p.index===2).map((p,i)=>({...p,index:i,label:String.fromCharCode(65+i)})),confirmed:false};
  if(next[3]&&Array.isArray(next[3].pieces)) next[3]={...next[3],pieces:next[3].pieces.filter(p=>p.index===0||p.index===2).map((p,i)=>({...p,index:i,label:String.fromCharCode(65+i)})),confirmed:false};
  return next;
}

module.exports={faces,armLabels,migrateDesign};
