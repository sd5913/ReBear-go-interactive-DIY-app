'use strict';

const VERTEX = `
attribute vec3 aPos, aNormal;
attribute vec2 aUV;

uniform vec4 uOrbit, uScale;
uniform vec3 uCenter;
uniform float uExpand;

varying vec3 vNormal;
varying vec2 vUV;

vec3 rotate(vec3 p) {
  vec3 q = vec3(
    uOrbit.x * p.x - uOrbit.y * p.z,
    p.y,
    uOrbit.y * p.x + uOrbit.x * p.z
  );

  return vec3(
    q.x,
    uOrbit.z * q.y - uOrbit.w * q.z,
    uOrbit.w * q.y + uOrbit.z * q.z
  );
}

void main() {
  vec3 expanded = uCenter + (aPos - uCenter) * uExpand;
  vec3 q = rotate(expanded - vec3(0., .91, 0.));

  gl_Position = vec4(
    q.x * uScale.x,
    q.y * uScale.y,
    -q.z * .4,
    1.
  );

  vNormal = rotate(aNormal);
  vUV = aUV;
}
`;

const FRAGMENT = `
precision mediump float;

varying vec3 vNormal;
varying vec2 vUV;

uniform sampler2D uFabric;

// 裁片中心，以及旋转后的两个采样方向。
uniform vec2 uUvOrigin, uUvX, uUvY;

uniform vec3 uBase, uHighlight;
uniform float uTextured, uSelected, uGlow;

void main() {
  if (uGlow > .5) {
    gl_FragColor = vec4(uHighlight, .88);
    return;
  }
  vec2 uv =
    uUvOrigin +
    uUvX * (vUV.x - .5) +
    uUvY * (vUV.y - .5);

  // 裁片超出布料图片时，超出部分显示底色，
  // 避免把图片边缘无限拉伸。
  float inside =
    step(0., uv.x) *
    step(uv.x, 1.) *
    step(0., uv.y) *
    step(uv.y, 1.);

  vec4 fabric = texture2D(uFabric, clamp(uv, 0., 1.));

  vec3 base = mix(
    uBase,
    fabric.rgb,
    fabric.a * uTextured * inside
  );

  float diffuse =
    .67 +
    .33 * max(
      0.,
      dot(
        normalize(vNormal),
        normalize(vec3(-.45, .65, 1.))
      )
    );

  gl_FragColor = vec4(
    mix(
      base * diffuse,
      uHighlight,
      .38 * uSelected
    ),
    1.
  );
}
`;

// Read the supplied bear GLB by named nodes and retain each node's UV layout.
function readBear(arrayBuffer) {
  const header = new DataView(arrayBuffer);

  if (header.getUint32(0, true) !== 0x46546c67) {
    throw new Error('需要 Rebear GLB 模板');
  }

  const jsonLength = header.getUint32(12, true);
  const encoded = new Uint8Array(arrayBuffer, 20, jsonLength);

  const doc = JSON.parse(
    decodeURIComponent(
      Array.from(
        encoded,
        b => '%' + b.toString(16).padStart(2, '0')
      ).join('')
    )
  );

  const binOffset = 28 + jsonLength;
  function attribute(index) {
    const a = doc.accessors[index];
    const view = doc.bufferViews[a.bufferView];
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
    const bytes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
    const read = { 5121: 'getUint8', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
    if (!width || !bytes || !read) throw new Error('Unsupported bear GLB attribute');
    const offset = binOffset + (view.byteOffset || 0) + (a.byteOffset || 0);
    const stride = view.byteStride || width * bytes;
    const values = new Float32Array(a.count * width);
    for (let i=0;i<a.count;i++) for(let k=0;k<width;k++) values[i*width+k]=header[read](offset+i*stride+k*bytes,true);
    return values;
  }

  const defs = {
    head: ['head_front', null, 0], body: ['body_front', null, 1],
    'left-ears': ['earL_front', null, 2], 'right-ears': ['earR_front', null, 2],
    'left-arm': ['armL_upper', null, 3], 'right-arm': ['armR_upper', null, 3]
  };
  const parts = [];
  function transform(node, x, y, z) {
    const s=node.scale||[1,1,1], q=node.rotation||[0,0,0,1], t=node.translation||[0,0,0];
    x*=s[0]; y*=s[1]; z*=s[2];
    const qx=q[0], qy=q[1], qz=q[2], qw=q[3];
    const ix=qw*x+qy*z-qz*y, iy=qw*y+qz*x-qx*z, iz=qw*z+qx*y-qy*x, iw=-qx*x-qy*y-qz*z;
    return [ix*qw+iw*-qx+iy*-qz-iz*-qy+t[0],iy*qw+iw*-qy+iz*-qx-ix*-qz+t[1],iz*qw+iw*-qz+ix*-qy-iy*-qx+t[2]];
  }
  for (const node of doc.nodes || []) {
    const def = defs[node.name];
    if (!def || node.mesh === undefined) continue;
    for (const primitive of doc.meshes[node.mesh].primitives) {
      if (primitive.mode !== undefined && primitive.mode !== 4) continue;
      if (primitive.attributes.NORMAL === undefined || primitive.attributes.TEXCOORD_0 === undefined) continue;
      const pos = attribute(primitive.attributes.POSITION), normal = attribute(primitive.attributes.NORMAL), uv = attribute(primitive.attributes.TEXCOORD_0);
      const indices = primitive.indices === undefined ? Array.from({length: pos.length / 3}, (_, i) => i) : Array.from(attribute(primitive.indices));
      const groups = new Map();
      indices.forEach((index, i) => {
        const face = i < indices.length / 2 ? 0 : 1;
        if (!groups.has(face)) groups.set(face, []);
        groups.get(face).push(index);
      });
      const sideCount = def[1] ? 2 : 1;
      for (let side = 0; side < sideCount; side++) {
        const tris = indices;
        const verts = tris.flatMap(i => transform(node,pos[i*3],pos[i*3+1],pos[i*3+2]));
        const norms = tris.flatMap(i => transform(node,normal[i*3],normal[i*3+1],normal[i*3+2]));
        const tex = tris.flatMap(i => [uv[i*2],uv[i*2+1]]);
        const id = def[2] === 3 ? (node.name === 'left-arm' ? 'armL_upper' : 'armR_upper') : def[2] === 2 ? (node.name === 'left-ears' ? 'earL_front' : 'earR_front') : def[side];
        const bounds=[Infinity,Infinity,-Infinity,-Infinity];
        for(let i=0;i<tex.length;i+=2){bounds[0]=Math.min(bounds[0],tex[i]);bounds[1]=Math.min(bounds[1],tex[i+1]);bounds[2]=Math.max(bounds[2],tex[i]);bounds[3]=Math.max(bounds[3],tex[i+1]);}
        const uvWidth=bounds[2]-bounds[0]||1, uvHeight=bounds[3]-bounds[1]||1;
        for(let i=0;i<tex.length;i+=2){tex[i]=(tex[i]-bounds[0])/uvWidth;tex[i+1]=(tex[i+1]-bounds[1])/uvHeight;}
        parts.push({id, group:def[2], label:def[2]===0?'头部':def[2]===1?'身体':def[2]===2?'耳朵':'手臂', side:side?'back':'front', base:[.72,.48,.32], pos:new Float32Array(verts), normal:new Float32Array(norms), uv:new Float32Array(tex), mask:'/assets/bear-material/'+node.name+'.png'});
      }
    }
  }
  if (!parts.length) throw new Error('Bear GLB has no supported named parts');
  const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  parts.forEach(p=>p.pos.forEach((v,i)=>{const a=i%3;min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);}));
  const center=min.map((v,i)=>(v+max[i])/2), scale=1.18/Math.max(...max.map((v,i)=>v-min[i]));
  parts.forEach(p=>{
    p.pos.forEach((v,i)=>{const a=i%3;p.pos[i]=(v-center[a])*scale+(a===1?.91:0);});
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    p.pos.forEach((v,i)=>{const a=i%3;lo[a]=Math.min(lo[a],v);hi[a]=Math.max(hi[a],v);});
    p.center=lo.map((v,i)=>(v+hi[i])/2);
  });
  return parts;
}

// The supplied cushion has indexed meshes named top / bottom / loop.
// Its loop contains two disconnected UV panels, giving four editable pieces.
function readCushion(arrayBuffer) {
  const header = new DataView(arrayBuffer);
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2) {
    throw new Error('Invalid cushion GLB');
  }
  const jsonLength = header.getUint32(12, true);
  const encoded = new Uint8Array(arrayBuffer, 20, jsonLength);
  const doc = JSON.parse(decodeURIComponent(Array.from(encoded, b => '%' + b.toString(16).padStart(2, '0')).join('')));
  const binOffset = 28 + jsonLength;

  function attribute(index) {
    const accessor = doc.accessors[index];
    const view = doc.bufferViews[accessor.bufferView];
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3 }[accessor.type];
    const bytes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType];
    const read = { 5121: 'getUint8', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[accessor.componentType];
    if (!width || !bytes || !read) throw new Error('Unsupported cushion attribute');
    const offset = binOffset + (view.byteOffset || 0) + (accessor.byteOffset || 0);
    const stride = view.byteStride || width * bytes;
    const values = new Float32Array(accessor.count * width);
    for (let i = 0; i < accessor.count; i++) {
      for (let axis = 0; axis < width; axis++) values[i * width + axis] = header[read](offset + i * stride + axis * bytes, true);
    }
    return values;
  }

  const definitions = {
    top: { ids: ['cushion_top'], group: 0, label: '上面' },
    bottom: { ids: ['cushion_bottom'], group: 1, label: '下面' },
    loop: { ids: ['cushion_side_a', 'cushion_side_b'], group: 2, label: '侧围' }
  };
  const parts = [];
  for (const node of doc.nodes) {
    const definition = definitions[node.name];
    if (!definition) continue;
    for (const primitive of doc.meshes[node.mesh].primitives) {
      if (primitive.mode !== undefined && primitive.mode !== 4) throw new Error('Cushion must use triangles');
      const pos = attribute(primitive.attributes.POSITION);
      const normal = attribute(primitive.attributes.NORMAL);
      const uv = attribute(primitive.attributes.TEXCOORD_0);
      const indices = primitive.indices === undefined ? Array.from({ length: pos.length / 3 }, (_, i) => i) : Array.from(attribute(primitive.indices));
      const parent = Array.from({ length: pos.length / 3 }, (_, i) => i);
      function root(i) {
        while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
        return i;
      }
      for (let i = 0; i < indices.length; i += 3) {
        const a = root(indices[i]);
        parent[root(indices[i + 1])] = a;
        parent[root(indices[i + 2])] = a;
      }
      const components = new Map();
      for (let i = 0; i < indices.length; i += 3) {
        const key = root(indices[i]);
        if (!components.has(key)) components.set(key, []);
        components.get(key).push(...indices.slice(i, i + 3));
      }
      const panels = [...components.values()].sort((a, b) => Math.min(...a) - Math.min(...b));
      if (panels.length !== definition.ids.length) throw new Error('Unexpected cushion panels');
      panels.forEach((panel, index) => {
        const bounds = [Infinity, Infinity, -Infinity, -Infinity];
        panel.forEach(i => {
          bounds[0] = Math.min(bounds[0], uv[i * 2]);
          bounds[1] = Math.min(bounds[1], uv[i * 2 + 1]);
          bounds[2] = Math.max(bounds[2], uv[i * 2]);
          bounds[3] = Math.max(bounds[3], uv[i * 2 + 1]);
        });
        parts.push({
          id: definition.ids[index], group: definition.group, label: definition.label,
          base: [.83, .76, .65],
          pos: new Float32Array(panel.flatMap(i => Array.from(pos.slice(i * 3, i * 3 + 3)))),
          normal: new Float32Array(panel.flatMap(i => Array.from(normal.slice(i * 3, i * 3 + 3)))),
          uv: new Float32Array(panel.flatMap(i => {
            const u = (uv[i * 2] - bounds[0]) / (bounds[2] - bounds[0]);
            const v = (uv[i * 2 + 1] - bounds[1]) / (bounds[3] - bounds[1]);
            // Side panels are vertical in the source UV, horizontal in the tray.
            return node.name === 'loop' ? [v, 1 - u] : [u, v];
          }))
        });
      });
    }
  }
  if (parts.length !== 4) throw new Error('Incomplete cushion model');
  const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
  parts.forEach(part => part.pos.forEach((value, i) => {
    minimum[i % 3] = Math.min(minimum[i % 3], value);
    maximum[i % 3] = Math.max(maximum[i % 3], value);
  }));
  const center = minimum.map((value, axis) => (value + maximum[axis]) / 2);
  const scale = 1.18 / Math.max(...maximum.map((value, axis) => value - minimum[axis]));
  parts.forEach(part => part.pos.forEach((value, i) => {
    part.pos[i] = (value - center[i % 3]) * scale + (i % 3 === 1 ? .91 : 0);
  }));
  return parts;
}

const fabrics = [
  {
    id: 'check',
    label: '橘格纹',
    color: '#c96d4d',
    colors: [
      [245, 213, 171],
      [204, 106, 76],
      [163, 67, 55]
    ]
  },
  {
    id: 'denim',
    label: '靛蓝布',
    color: '#567b9a',
    colors: [
      [92, 132, 162],
      [65, 103, 136],
      [45, 78, 110]
    ]
  },
  {
    id: 'stripe',
    label: '绿条纹',
    color: '#6d9176',
    colors: [
      [226, 227, 193],
      [128, 160, 127],
      [69, 110, 90]
    ]
  },
  {
    id: 'dots',
    label: '莓果圆点',
    color: '#ac6482',
    colors: [
      [174, 93, 129],
      [207, 131, 153],
      [252, 217, 198]
    ]
  }
];

function createBear(gl, buffer, options = {}) {
  const cushion = options.modelId === 'cushion';
  const transparentBackground = Boolean(options.transparentBackground);
  const parts = cushion ? readCushion(buffer) : readBear(buffer);
  // Center the actual mesh, then fit all eight box corners to the current orbit.
  const minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity];
  parts.forEach(part=>part.pos.forEach((value,i)=>{
    minimum[i%3]=Math.min(minimum[i%3],value);maximum[i%3]=Math.max(maximum[i%3],value);
  }));
  const center=minimum.map((v,i)=>(v+maximum[i])/2);
  parts.forEach(part=>part.pos.forEach((value,i)=>{part.pos[i]=value-center[i%3]+(i%3===1?.91:0);}));
  const half=minimum.map((v,i)=>(maximum[i]-v)/2);
  const corners=[];
  for(const x of [-half[0],half[0]])for(const y of [-half[1],half[1]])for(const z of [-half[2],half[2]])corners.push([x,y,z]);
  const program = gl.createProgram();

  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT]
  ]) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }

    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }

  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }

  const attrib = Object.fromEntries(
    ['aPos', 'aNormal', 'aUV'].map(k => [
      k,
      gl.getAttribLocation(program, k)
    ])
  );

  const uniform = Object.fromEntries(
    [
      'uOrbit',
      'uScale',
      'uFabric',
      'uUvOrigin',
      'uUvX',
      'uUvY',
      'uBase',
      'uTextured',
      'uSelected',
      'uCenter',
      'uExpand',
      'uGlow',
      'uHighlight'
    ].map(k => [
      k,
      gl.getUniformLocation(program, k)
    ])
  );

  const textures = new Map();
  const assignments = new Map();
  const adjustable = parts.filter(p => !p.fixed);

  let selected = cushion ? 'cushion_top' : 'head_front';
  let selectedGroup = null;
  let selectionConfirmed = false;
  let yaw = 0;
  let pitch = cushion ? .65 : 0;
  let preview = null;

  for (const p of parts) {
    p.buffers = [p.pos, p.normal, p.uv].map(data => {
      const b = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

      return b;
    });
  }

  function storeTexture(id, width, height, input) {
    if (Math.max(width, height) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) {
      throw new Error('图片太大，请缩小后重新选择');
    }

    const handle = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, handle);

    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR
    );

    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MAG_FILTER,
      gl.LINEAR
    );

    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      gl.CLAMP_TO_EDGE
    );

    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
      gl.CLAMP_TO_EDGE
    );

    // 当前模型 UV 的 v 方向与图片从上到下的方向一致。
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    try {
      if (input instanceof Uint8Array) {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          width,
          height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          input
        );
      } else {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          input
        );
      }

      if (gl.getError() !== gl.NO_ERROR) {
        throw new Error('当前设备无法载入这张布料图片');
      }
    } catch (error) {
      gl.deleteTexture(handle);
      throw error;
    }

    if (textures.has(id)) {
      gl.deleteTexture(textures.get(id).handle);
    }

    textures.set(id, {
      handle,

      // 保留原来“整块布料拖到模型上”的临时预览方式。
      // 裁片正式分配后，会使用独立的 origin / axisX / axisY。
      crop: [
        Math.min(1, height / width),
        Math.min(1, width / height)
      ]
    });
  }

  storeTexture(
    'empty',
    1,
    1,
    new Uint8Array([255, 255, 255, 255])
  );

  for (const f of fabrics) {
    const size = 128;
    const rgba = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let k = 0;

        if (f.id === 'check') {
          k = (x % 32 < 16 ? 1 : 0) + (y % 32 < 16 ? 1 : 0);
        }

        if (f.id === 'denim') {
          k = ((x + y) % 7 < 2 ? 1 : 0) + (y % 5 === 0 ? 1 : 0);
        }

        if (f.id === 'stripe') {
          k = x % 26 < 11 ? 1 : (x % 26 < 15 ? 2 : 0);
        }

        if (f.id === 'dots') {
          k = Math.hypot(
            (x + (y % 32 < 16 ? 0 : 8)) % 16 - 8,
            y % 16 - 8
          ) < 3.1 ? 2 : 0;
        }

        const j = (y * size + x) * 4;
        const grain = ((x * 19 + y * 13) % 11) - 5;

        for (let i = 0; i < 3; i++) {
          rgba[j + i] = f.colors[k][i] + grain;
        }

        rgba[j + 3] = 255;
      }
    }

    storeTexture(f.id, size, size, rgba);
  }

  function orbit() {
    return [
      Math.cos(yaw),
      Math.sin(yaw),
      Math.cos(pitch),
      Math.sin(pitch)
    ];
  }

  function scale() {
    const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
    const [cy,sy,cp,sp]=orbit();
    let extentX=1e-4,extentY=1e-4;
    for(const [x,y,z] of corners){
      extentX=Math.max(extentX,Math.abs(cy*x-sy*z));
      extentY=Math.max(extentY,Math.abs(cp*y-sp*(sy*x+cy*z)));
    }
    const fit=Math.min(width*.86/(2*extentX),height*.86/(2*extentY));
    return [2*fit/width,2*fit/height];
  }

  function render() {
    gl.viewport(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight
    );

    if (transparentBackground) gl.clearColor(0, 0, 0, 0);
    else gl.clearColor(.968, .950, .917, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(program);

    gl.uniform4fv(uniform.uOrbit, orbit());
    gl.uniform4fv(uniform.uScale, [...scale(), 0, 0]);

    gl.uniform3fv(uniform.uHighlight,selectionConfirmed?[.28,.72,.46]:[1.,.57,.13]);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(uniform.uFabric, 0);

    for (const p of parts) {
      for (const [i, k] of ['aPos', 'aNormal', 'aUV'].entries()) {
        gl.bindBuffer(gl.ARRAY_BUFFER, p.buffers[i]);
        gl.enableVertexAttribArray(attrib[k]);

        gl.vertexAttribPointer(
          attrib[k],
          i === 2 ? 2 : 3,
          gl.FLOAT,
          false,
          0,
          0
        );
      }

      const showing = preview && !p.fixed && (
        p.id === preview.part.id ||
        (preview.both && p.group === preview.part.group)
      );

      const assignment = showing
        ? { fabricId: preview.id }
        : assignments.get(p.id);

      // 同时兼容旧的字符串分配和新的带坐标对象。
      const material = textures.get(
        typeof assignment === 'string'
          ? assignment
          : assignment?.fabricId
      );

      const tex = material || textures.get('empty');

      const isSelected=(selectedGroup!==null&&p.group===selectedGroup)||p.id===(preview?.part.id||selected);
      gl.uniform3fv(uniform.uCenter,p.center);
      if(isSelected){
        gl.uniform1f(uniform.uSelected,1);
        gl.uniform1f(uniform.uExpand,1.055);
        gl.uniform1f(uniform.uGlow,1);
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES,0,p.pos.length/3);
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      }
      gl.uniform1f(uniform.uExpand,1);
      gl.uniform1f(uniform.uGlow,0);

      gl.bindTexture(gl.TEXTURE_2D, tex.handle);

      gl.uniform2fv(
        uniform.uUvOrigin,
        assignment?.origin || [.5, .5]
      );

      gl.uniform2fv(
        uniform.uUvX,
        assignment?.axisX || [tex.crop[0], 0]
      );

      gl.uniform2fv(
        uniform.uUvY,
        assignment?.axisY || [0, tex.crop[1]]
      );

      gl.uniform3fv(uniform.uBase, p.base);
      gl.uniform1f(uniform.uTextured, material ? 1 : 0);

      gl.uniform1f(uniform.uSelected,isSelected?1:0);

      gl.drawArrays(
        gl.TRIANGLES,
        0,
        p.pos.length / 3
      );
    }
  }

  function pick(u, v) {
    if (u < 0 || u > 1 || v < 0 || v > 1) {
      return null;
    }

    const [cy, sy, cp, sp] = orbit();
    const [sx, scaleY] = scale();

    const x = (u * 2 - 1) / sx;
    const y = (1 - v * 2) / scaleY;

    let best = null;
    let nearest = -Infinity;

    for (const part of parts) {
      const p = part.pos;

      for (let i = 0; i < p.length; i += 9) {
        const q = [];

        for (let j = i; j < i + 9; j += 3) {
          const z = sy * p[j] + cy * p[j + 2];
          const h = p[j + 1] - .91;

          q.push([
            cy * p[j] - sy * p[j + 2],
            cp * h - sp * z,
            sp * h + cp * z
          ]);
        }

        const [a, b, c] = q;

        const ax = b[0] - a[0];
        const ay = b[1] - a[1];
        const bx = c[0] - a[0];
        const by = c[1] - a[1];

        const d = ax * by - ay * bx;

        if (Math.abs(d) < 1e-10) continue;

        const s = ((x - a[0]) * by - (y - a[1]) * bx) / d;
        const t = (ax * (y - a[1]) - ay * (x - a[0])) / d;

        if (s < 0 || t < 0 || s + t > 1) continue;

        const z = a[2] +
          s * (b[2] - a[2]) +
          t * (c[2] - a[2]);

        if (z > nearest) {
          nearest = z;
          best = part.fixed ? 'head_front' : part.id;
        }
      }
    }

    return best;
  }

  return {
    parts: adjustable.map(({ id, label, group, side }) => ({
      id,
      label,
      group,
      side
    })),

    render,
    pick,

    rotate(dx, dy) {
      yaw += dx * .012;
      const limit = cushion ? Math.PI : .85;
      pitch = Math.max(
        -limit,
        Math.min(limit, pitch + dy * .01)
      );

      render();
    },

    show(side) {
      yaw = !cushion && side === 'back' ? Math.PI : 0;
      pitch = cushion ? (side === 'back' ? -Math.PI / 2 : Math.PI / 2) : 0;
      render();
    },

    select(id) {
      selected = id;
      selectedGroup = null;
      render();
    },

    selectGroup(group, confirmed = false) {
      selectionConfirmed=Boolean(confirmed);
      selectedGroup=Number.isInteger(group)?group:null;
      selected=null;
      render();
    },

    captureFrontPixels(){
      const state={yaw,pitch,selected,selectedGroup,preview};
      yaw=0;pitch=0;selected=null;selectedGroup=null;preview=null;
      try{
        render();
        const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
        if(!width||!height||gl.isContextLost())throw new Error('Preview buffer unavailable');
        const pixels=new Uint8Array(width*height*4);
        gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        if(gl.getError()!==gl.NO_ERROR||!pixels.some((v,i)=>i%4===3&&v>0))throw new Error('Empty preview buffer');
        // WebGL's origin is bottom-left; ImageData uses top-left.
        const data=new Uint8ClampedArray(pixels.length),stride=width*4;
        for(let y=0;y<height;y++)data.set(pixels.subarray((height-1-y)*stride,(height-y)*stride),y*stride);
        return {width,height,data};
      }
      finally{yaw=state.yaw;pitch=state.pitch;selected=state.selected;selectedGroup=state.selectedGroup;preview=state.preview;render();}
    },

    preview(id, part, both = false) {
      const target = adjustable.find(p => p.id === part);

      preview = target && textures.has(id)
        ? { id, part: target, both }
        : null;

      render();
    },

    addImage(id, image) {
      storeTexture(
        id,
        image.naturalWidth || image.width,
        image.naturalHeight || image.height,
        image
      );
    },

    apply(id, part, both = false) {
      const target = adjustable.find(p => p.id === part);

      if (!target || !textures.has(id) || id === 'empty') {
        return false;
      }

      for (const p of adjustable) {
        if (p.id === part || (both && p.group === target.group)) {
          assignments.set(p.id, id);
        }
      }

      preview = null;
      selected = part;
      selectedGroup = null;

      render();
      return true;
    },

    replaceAssignments(mapping) {
      assignments.clear();

      for (const p of adjustable) {
        const assignment = mapping[p.id];

        const id = typeof assignment === 'string'
          ? assignment
          : assignment?.fabricId;

        if (id && textures.has(id)) {
          assignments.set(p.id, assignment);
        }
      }

      render();
    },

    removeImage(id) {
      const texture = textures.get(id);

      if (texture) {
        gl.deleteTexture(texture.handle);
        textures.delete(id);
      }
    },

    getAssignments() {
      return Object.fromEntries(assignments);
    },

    dispose() {
      for (const p of parts) {
        for (const b of p.buffers) {
          gl.deleteBuffer(b);
        }
      }

      for (const { handle } of textures.values()) {
        gl.deleteTexture(handle);
      }

      gl.deleteProgram(program);
    }
  };
}

if (typeof module === 'object') {
  module.exports = {
    createBear,
    readBear,
    readCushion,
    fabrics
  };
} else {
  globalThis.Rebear = {
    createBear,
    readBear,
    readCushion,
    fabrics
  };
}
