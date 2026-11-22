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
  if(next.__layoutVersion===3)return next;
  const legacy=Boolean(next[4] || [0,1].some(i=>next[i]?.pieces?.some(p=>p.index>0)) ||
    [2,3].some(i=>next[i]?.pieces?.some(p=>p.index>=2)));
  if(legacy){
    [0,1,2,3].forEach(part=>{
      const record=next[part];
      if(!record||!Array.isArray(record.pieces))return;
      const indexes=part<2?[0]:[0,2];
      next[part]={...record,confirmed:false,pieces:record.pieces.filter(p=>indexes.includes(p.index))
        .map(p=>({...p,index:indexes.indexOf(p.index),label:String.fromCharCode(65+indexes.indexOf(p.index))}))};
    });
    delete next[4];
  }
  next.__layoutVersion=3;
  return next;
}

module.exports={faces,armLabels,migrateDesign};
