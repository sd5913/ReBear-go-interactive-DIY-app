'use strict';

const VERTEX = `
attribute vec3 aPos, aNormal;
attribute vec2 aUV;
uniform vec4 uOrbit, uScale;
varying vec3 vNormal;
varying vec2 vUV;
vec3 rotate(vec3 p) {
  vec3 q = vec3(uOrbit.x*p.x-uOrbit.y*p.z, p.y, uOrbit.y*p.x+uOrbit.x*p.z);
  return vec3(q.x,uOrbit.z*q.y-uOrbit.w*q.z,uOrbit.w*q.y+uOrbit.z*q.z);
}
void main() {
  vec3 q=rotate(aPos-vec3(0.,.91,0.));
  gl_Position=vec4(q.x*uScale.x,q.y*uScale.y,-q.z*.4,1.);
  vNormal=rotate(aNormal);
  vUV=aUV;
}`;
const FRAGMENT = `
precision mediump float;
varying vec3 vNormal;
varying vec2 vUV;
uniform sampler2D uFabric;
uniform vec2 uCrop;
uniform vec3 uBase;
uniform float uTextured,uSelected;
void main() {
  vec4 fabric=texture2D(uFabric,(vUV-.5)*uCrop+.5);
  vec3 base=mix(uBase,fabric.rgb,fabric.a*uTextured);
  float diffuse=.67+.33*max(0.,dot(normalize(vNormal),normalize(vec3(-.45,.65,1.))));
  gl_FragColor=vec4(mix(base*diffuse,vec3(.99,.78,.43),.17*uSelected),1.);
}`;

function readBear(arrayBuffer) {
  const header = new DataView(arrayBuffer);
  if (header.getUint32(0,true)!==0x46546c67) throw new Error('需要 Rebear GLB 模板');
  const jsonLength=header.getUint32(12,true);
  const encoded=new Uint8Array(arrayBuffer,20,jsonLength);
  // Template metadata is UTF-8. decodeURIComponent also works in WeChat JS.
  const doc=JSON.parse(decodeURIComponent(Array.from(encoded,b=>'%'+b.toString(16).padStart(2,'0')).join('')));
  function attribute(index) {
    const a=doc.accessors[index], view=doc.bufferViews[a.bufferView];
    const width={VEC3:3,VEC2:2}[a.type];
    return new Float32Array(arrayBuffer,28+jsonLength+(view.byteOffset||0)+(a.byteOffset||0),a.count*width);
  }
  return doc.meshes[0].primitives.map(({attributes,material})=>{
    const m=doc.materials[material];
    return {...m.extras,base:m.pbrMetallicRoughness.baseColorFactor.slice(0,3).map(c=>1.055*c**(1/2.4)-.055),
      pos:attribute(attributes.POSITION), normal:attribute(attributes.NORMAL), uv:attribute(attributes.TEXCOORD_0)};
  });
}

const fabrics=[
  {id:'check',label:'橘格纹',color:'#c96d4d',colors:[[245,213,171],[204,106,76],[163,67,55]]},
  {id:'denim',label:'靛蓝布',color:'#567b9a',colors:[[92,132,162],[65,103,136],[45,78,110]]},
  {id:'stripe',label:'绿条纹',color:'#6d9176',colors:[[226,227,193],[128,160,127],[69,110,90]]},
  {id:'dots',label:'莓果圆点',color:'#ac6482',colors:[[174,93,129],[207,131,153],[252,217,198]]}
];

function createBear(gl,buffer) {
  const parts=readBear(buffer);
  const program=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,VERTEX],[gl.FRAGMENT_SHADER,FRAGMENT]]){
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program,shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  const attrib=Object.fromEntries(['aPos','aNormal','aUV'].map(k=>[k,gl.getAttribLocation(program,k)]));
  const uniform=Object.fromEntries(['uOrbit','uScale','uFabric','uCrop','uBase','uTextured','uSelected'].map(k=>[k,gl.getUniformLocation(program,k)]));
  const textures=new Map(), assignments=new Map();
  const adjustable=parts.filter(p=>!p.fixed);
  let selected='head_front', yaw=0, pitch=0, preview=null;
  for(const p of parts){
    p.buffers=[p.pos,p.normal,p.uv].map(data=>{
      const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b;
    });
  }
  function storeTexture(id,width,height,input) {
    if(Math.max(width,height)>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw new Error('图片太大，请缩小后重新选择');
    const handle=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,handle);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    try {
      if(input instanceof Uint8Array)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,input);
      else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,input);
      if(gl.getError()!==gl.NO_ERROR)throw new Error('当前设备无法载入这张布料图片');
    } catch(error) {gl.deleteTexture(handle);throw error;}
    if(textures.has(id))gl.deleteTexture(textures.get(id).handle);
    textures.set(id,{handle,crop:[Math.min(1,height/width),Math.min(1,width/height)]});
  }
  storeTexture('empty',1,1,new Uint8Array([255,255,255,255]));
  for(const f of fabrics) {
    const size=128, rgba=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      let k=0;
      if(f.id==='check')k=(x%32<16?1:0)+(y%32<16?1:0);
      if(f.id==='denim')k=((x+y)%7<2?1:0)+(y%5===0?1:0);
      if(f.id==='stripe')k=x%26<11?1:(x%26<15?2:0);
      if(f.id==='dots')k=Math.hypot((x+(y%32<16?0:8))%16-8,y%16-8)<3.1?2:0;
      const j=(y*size+x)*4, grain=((x*19+y*13)%11)-5;
      for(let i=0;i<3;i++)rgba[j+i]=f.colors[k][i]+grain;
      rgba[j+3]=255;
    }
    storeTexture(f.id,size,size,rgba);
  }
  function orbit() {return [Math.cos(yaw),Math.sin(yaw),Math.cos(pitch),Math.sin(pitch)];}
  function scale() {
    const width=gl.drawingBufferWidth, height=gl.drawingBufferHeight;
    const s=Math.min(width/1.43,height/2.15);
    return [2*s/width,2*s/height];
  }
  function render() {
    gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
    gl.clearColor(.968,.950,.917,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(program);
    gl.uniform4fv(uniform.uOrbit,orbit());
    gl.uniform4fv(uniform.uScale,[...scale(),0,0]);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(uniform.uFabric,0);
    for(const p of parts) {
      for(const [i,k] of ['aPos','aNormal','aUV'].entries()){
        gl.bindBuffer(gl.ARRAY_BUFFER,p.buffers[i]);
        gl.enableVertexAttribArray(attrib[k]);gl.vertexAttribPointer(attrib[k],i===2?2:3,gl.FLOAT,false,0,0);
      }
      const showing=preview&&!p.fixed&&(p.id===preview.part.id||(preview.both&&p.group===preview.part.group));
      const material=textures.get(showing?preview.id:assignments.get(p.id));
      const tex=material||textures.get('empty');
      gl.bindTexture(gl.TEXTURE_2D,tex.handle);
      gl.uniform2fv(uniform.uCrop,tex.crop);
      gl.uniform3fv(uniform.uBase,p.base);
      gl.uniform1f(uniform.uTextured,material?1:0);
      gl.uniform1f(uniform.uSelected,p.id===(preview?.part.id||selected)?1:0);
      gl.drawArrays(gl.TRIANGLES,0,p.pos.length/3);
    }
  }
  function pick(u,v) {
    if(u<0||u>1||v<0||v>1)return null;
    const [cy,sy,cp,sp]=orbit(), [sx,scaleY]=scale();
    const x=(u*2-1)/sx,y=(1-v*2)/scaleY;
    let best=null, nearest=-Infinity;
    for(const part of parts){
      const p=part.pos;
      for(let i=0;i<p.length;i+=9){
        const q=[];
        for(let j=i;j<i+9;j+=3){
          const z=sy*p[j]+cy*p[j+2], h=p[j+1]-.91;
          q.push([cy*p[j]-sy*p[j+2],cp*h-sp*z,sp*h+cp*z]);
        }
        const [a,b,c]=q, ax=b[0]-a[0], ay=b[1]-a[1], bx=c[0]-a[0], by=c[1]-a[1];
        const d=ax*by-ay*bx;
        if(Math.abs(d)<1e-10)continue;
        const s=((x-a[0])*by-(y-a[1])*bx)/d, t=(ax*(y-a[1])-ay*(x-a[0]))/d;
        if(s<0||t<0||s+t>1)continue;
        const z=a[2]+s*(b[2]-a[2])+t*(c[2]-a[2]);
        if(z>nearest){nearest=z;best=part.fixed?'head_front':part.id;}
      }
    }
    return best;
  }
  return {
    parts:adjustable.map(({id,label,group,side})=>({id,label,group,side})),
    render,pick,
    rotate(dx,dy){yaw+=dx*.012;pitch=Math.max(-.85,Math.min(.85,pitch+dy*.01));render();},
    show(side){yaw=side==='back'?Math.PI:0;pitch=0;render();},
    select(id){selected=id;render();},
    preview(id,part,both=false){
      const target=adjustable.find(p=>p.id===part);
      preview=target&&textures.has(id)?{id,part:target,both}:null;
      render();
    },
    addImage(id,image){storeTexture(id,image.naturalWidth||image.width,image.naturalHeight||image.height,image);},
    apply(id,part,both=false){
      const target=adjustable.find(p=>p.id===part);
      if(!target||!textures.has(id)||id==='empty')return false;
      for(const p of adjustable)if(p.id===part||(both&&p.group===target.group))assignments.set(p.id,id);
      preview=null;selected=part;render();return true;
    },
    replaceAssignments(mapping) {
      assignments.clear();
      for(const p of adjustable) {
        const id=mapping[p.id];
        if(id&&textures.has(id))assignments.set(p.id,id);
      }
      render();
    },
    removeImage(id) {
      const texture=textures.get(id);
      if(texture){gl.deleteTexture(texture.handle);textures.delete(id);}
    },
    getAssignments(){return Object.fromEntries(assignments);},
    dispose(){
      for(const p of parts)for(const b of p.buffers)gl.deleteBuffer(b);
      for(const {handle} of textures.values())gl.deleteTexture(handle);
      gl.deleteProgram(program);
    }
  };
}

if(typeof module==='object')module.exports={createBear,readBear,fabrics};
else globalThis.Rebear={createBear,readBear,fabrics};


