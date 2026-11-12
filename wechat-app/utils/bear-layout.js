const faces=[
  ['head_front','head_back'],
  ['body_front','body_back'],
  ['earL_front','earL_back','earR_front','earR_back'],
  ['armL_upper','armL_lower','armR_upper','armR_lower'],
  ['legL','legR']
];

const armLabels={
  zh:['左臂上片','左臂下片','右臂上片','右臂下片'],
  en:['Left arm upper','Left arm lower','Right arm upper','Right arm lower']
};

function migrateDesign(design){
  const arm=design[3];
  if(!arm||!Array.isArray(arm.pieces)||arm.layoutVersion===2)return design;
  const otherArm=arm.pieces.filter(p=>p.index===0||p.index===1).map(p=>({
    ...p,index:p.index+2,label:String.fromCharCode(67+p.index),x:p.x+32,y:p.y+20
  }));
  return {...design,3:{...arm,layoutVersion:2,pieces:[...arm.pieces,...otherArm]}};
}

module.exports={faces,armLabels,migrateDesign};
