/* Dynasty 2D Living Tree - pure Canvas, no assets
   - SVG silhouette with bloom glow
   - Optional procedural branches + golden veins (toggle with BRANCHES_ENABLED)
   - Drifting mist + gold dust
   - Pan (drag), Zoom (wheel), Reset button
*/

const VEIN_BUFFER_SCALE = 0.6;
const FLOW_OUTLINE_ENABLED = false;

const init = async () => {
  const canvas = document.getElementById('tree-canvas');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.cursor = 'grab';

  let width, height;
  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.floor(width * DPR);
    canvas.height = Math.floor(height * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // --- Camera (pan/zoom)
  const camera = { x: 0, y: 0, scale: 1 };
  const defaultCam = { x: 0, y: -40, scale: 1 };
  Object.assign(camera, defaultCam);

  // Expose camera globally so players overlay can sync with it
  window._treeCamera = camera;

  let hoveredScroll = null;
  let activeScroll = null;

  function screenToWorld(clientX, clientY){
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    return {
      x: (px - width/2) / camera.scale - camera.x,
      y: (py - height/2) / camera.scale - camera.y
    };
  }

  function pickScroll(wx, wy){
    let best = null;
    let bestDist = Infinity;
    for (const scroll of scrolls){
      const dx = wx - scroll.worldX;
      const dy = wy - scroll.worldY;
      const dist = Math.hypot(dx, dy);
      if (dist < scroll.radius && dist < bestDist){
        best = scroll;
        bestDist = dist;
      }
    }
    return best;
  }

  function refreshCursor(){
    if (dragging){
      canvas.style.cursor = 'grabbing';
    } else if (hoveredScroll){
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'grab';
    }
  }

  function updateHoverFromEvent(e){
    const world = screenToWorld(e.clientX, e.clientY);
    hoveredScroll = pickScroll(world.x, world.y);
    updateTreeHover(world.x, world.y);
    refreshCursor();
    return hoveredScroll;
  }

  let dragging = false, lastX = 0, lastY = 0;
  let pointerDownScroll = null;
  let pointerDownInfo = null;

  canvas.addEventListener('pointerdown', e => {
    const hit = updateHoverFromEvent(e);
    pointerDownScroll = hit;
    pointerDownInfo = { x: e.clientX, y: e.clientY, time: performance.now(), pointerId: e.pointerId };
    if (!hit){
      if (activeScroll) activeScroll = null;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    }
    refreshCursor();
  });

  canvas.addEventListener('pointermove', e => {
    if (dragging){
      const dx = (e.clientX - lastX) / camera.scale;
      const dy = (e.clientY - lastY) / camera.scale;
      camera.x += dx;
      camera.y += dy;
      lastX = e.clientX;
      lastY = e.clientY;
    }
    updateHoverFromEvent(e);
  });

  canvas.addEventListener('pointerup', e => {
    if (dragging){
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    const hit = updateHoverFromEvent(e);
    if (pointerDownInfo){
      const dist = Math.hypot(e.clientX - pointerDownInfo.x, e.clientY - pointerDownInfo.y);
      const deltaT = performance.now() - pointerDownInfo.time;
      if (pointerDownScroll && pointerDownScroll === hit && dist < 6 && deltaT < 400){
        activeScroll = activeScroll === hit ? null : hit;
      }
    }
    pointerDownScroll = null;
    pointerDownInfo = null;
    refreshCursor();
  });

  canvas.addEventListener('pointerleave', () => {
    dragging = false;
    hoveredScroll = null;
    pointerDownScroll = null;
    pointerDownInfo = null;
    hoverGlow.target = 0;
    refreshCursor();
  });

  canvas.addEventListener('pointercancel', () => {
    dragging = false;
    hoveredScroll = null;
    pointerDownScroll = null;
    pointerDownInfo = null;
    hoverGlow.target = 0;
    refreshCursor();
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0012);
    const mx = (e.offsetX - width/2) / camera.scale - camera.x;
    const my = (e.offsetY - height/2) / camera.scale - camera.y;
    camera.scale *= factor;
    camera.x += mx - mx * factor;
    camera.y += my - my * factor;
  }, { passive: false });

  // --- Pinch-to-zoom for mobile ---
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let pinchCenter = { x: 0, y: 0 };
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      dragging = false;
      const t0 = e.touches[0], t1 = e.touches[1];
      pinchStartDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      pinchStartScale = camera.scale;
      pinchCenter = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      if (pinchStartDist > 0) {
        const newScale = pinchStartScale * (dist / pinchStartDist);
        const cx = (t0.clientX + t1.clientX) / 2;
        const cy = (t0.clientY + t1.clientY) / 2;
        const mx = (cx - width/2) / camera.scale - camera.x;
        const my = (cy - height/2) / camera.scale - camera.y;
        const factor = newScale / camera.scale;
        camera.scale = newScale;
        camera.x += mx - mx * factor;
        camera.y += my - my * factor;
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchend', () => { pinchStartDist = 0; });

  document.getElementById('reset').addEventListener('click', () => Object.assign(camera, defaultCam));

  function applyCamera(){
    ctx.translate(width / 2, height / 2);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(camera.x, camera.y);
  }

  // --- Utility: cubic Bezier interpolation
  function bezierPoint(p0, p1, p2, p3, t) {
    const it = 1 - t;
    const x = it*it*it*p0.x + 3*it*it*t*p1.x + 3*it*t*t*p2.x + t*t*t*p3.x;
    const y = it*it*it*p0.y + 3*it*it*t*p1.y + 3*it*t*t*p2.y + t*t*t*p3.y;
    return { x, y };
  }
  function bezierTangent(p0, p1, p2, p3, t) {
    const x = 3*(1-t)*(1-t)*(p1.x-p0.x) + 6*(1-t)*t*(p2.x-p1.x) + 3*t*t*(p3.x-p2.x);
    const y = 3*(1-t)*(1-t)*(p1.y-p0.y) + 6*(1-t)*t*(p2.y-p1.y) + 3*t*t*(p3.y-p2.y);
    return { x, y };
  }

  // --- Tree generation (inverted: roots at top)
  // Root anchors along the top to start main branches
  const rootY = -220;
  const BRANCHES_ENABLED = false;
  const anchors = Array.from({ length: 9 }, (_, i) => ({
    x: -360 + i * 90 + rand(-14, 14),
    y: rootY + rand(-8, 16)
  }));

  function rand(a,b){ return a + Math.random()*(b-a); }

  // Branch definition: bezier + children + vein particles
  const branches = [];

  function makeBranch(start, depth, main=false){
    if (depth > 4) return null;
    // end point trends downward (positive y because inverted tree grows down)
    const len = rand(120 - depth*12, 180 - depth*8);
    const dx = rand(-120 + depth*16, 120 - depth*16);
    const dy = len;

    const p0 = start;
    const p3 = { x: p0.x + dx, y: p0.y + dy };
    // controls create organic curve
    const p1 = { x: p0.x + dx*0.25 + rand(-40, 40), y: p0.y + dy*0.15 + rand(-16, 16) };
    const p2 = { x: p0.x + dx*0.75 + rand(-40, 40), y: p0.y + dy*0.8 + rand(-18, 18) };

    const thickness = Math.max(2, main ? 12 - depth*2 : 8 - depth*1.6);

    const node = { p0, p1, p2, p3, thickness, depth, children: [], veins: [] };
    branches.push(node);

    // spawn vein particles along this curve
    const veinCount = Math.max(3, 10 - depth*2);
    for (let i=0;i<veinCount;i++){
      node.veins.push({
        t: Math.random(),
        speed: rand(0.0025, 0.006) * (1 + depth*0.1),
        size: Math.max(1, 2.3 - depth*0.3),
        phase: Math.random()*Math.PI*2
      });
    }

    // spawn children
    const childN = main
      ? 2 + (Math.random() < 0.7 ? 1 : 0)
      : (Math.random() < 0.7 ? 1 : 0) + (Math.random() < 0.35 ? 1 : 0);

    const attachTs = [];
    for (let c=0;c<childN;c++){
      attachTs.push(rand(0.35, 0.8));
    }
    attachTs.sort((a,b)=>a-b);

    for (const tAttach of attachTs){
      const base = bezierPoint(p0, p1, p2, p3, tAttach);
      const tan = bezierTangent(p0, p1, p2, p3, tAttach);
      const dir = Math.atan2(tan.y, tan.x) + (Math.random()<0.5?-1:1)*rand(0.5, 1.1);
      const len2 = len * rand(0.4, 0.75);

      const childP0 = base;
      const childP3 = { x: base.x + Math.cos(dir)*len2, y: base.y + Math.sin(dir)*len2 };
      const childP1 = { x: base.x + Math.cos(dir-0.2)*len2*0.3 + rand(-20, 20),
                        y: base.y + Math.sin(dir-0.2)*len2*0.3 + rand(-12, 12) };
      const childP2 = { x: base.x + Math.cos(dir+0.2)*len2*0.7 + rand(-20, 20),
                        y: base.y + Math.sin(dir+0.2)*len2*0.7 + rand(-12, 12) };

      const child = {
        p0: childP0, p1: childP1, p2: childP2, p3: childP3,
        thickness: Math.max(1.5, thickness*0.72),
        depth: depth+1, children: [], veins: []
      };
      branches.push(child);

      const vc = Math.max(2, 8 - child.depth*2);
      for (let i=0;i<vc;i++){
        child.veins.push({
          t: Math.random(),
          speed: rand(0.003, 0.007),
          size: Math.max(0.8, 2.0 - child.depth*0.3),
          phase: Math.random()*Math.PI*2
        });
      }

      // maybe recurse further
      if (child.depth < 4 && Math.random() < 0.85){
        makeBranch(childP3, child.depth, false);
      }
    }

    return node;
  }

  if (BRANCHES_ENABLED){
    // Build main branches from anchors
    const trunkRoot = { x: 0, y: rootY - 30 };
    // central trunk
    makeBranch(trunkRoot, 0, true);
    // crown fan
    for (const a of anchors){
      makeBranch(a, 0, true);
    }
  }

  const scrolls = [];
  if (BRANCHES_ENABLED){
    const scrollCatalog = [
      { title: 'Founding Edict', detail: 'Charter of the first dynasty born in starlit soil.' },
      { title: 'Roots of Aegis', detail: 'Treatise binding guardians to the living archives.' },
      { title: 'Golden Concord', detail: 'Accords that braided rival bloodlines into one.' },
      { title: 'Verdant Oath', detail: 'Vow whispered by caretakers to awaken the glow.' },
      { title: 'Chronicle of Embers', detail: 'Record of years when the roots burned with fury.' },
      { title: 'Silver Annex', detail: 'Map of hidden alcoves connecting distant scrolls.' },
      { title: 'Crown Ledger', detail: 'Ledger of inheritance etched with light.' },
      { title: 'Blooming Cipher', detail: 'Encrypted rites for coaxing dormant branches.' },
      { title: 'Luminous Pact', detail: 'Promise that lets knowledge travel along veins.' }
    ];

    const branchPool = branches.filter(b => b.depth >= 1 && b.depth <= 3);
    if (branchPool.length) {
      for (const entry of scrollCatalog){
        const branch = branchPool[(Math.random() * branchPool.length) | 0];
        const attachT = rand(0.28, 0.82);
        const anchor = bezierPoint(branch.p0, branch.p1, branch.p2, branch.p3, attachT);
        const tangent = bezierTangent(branch.p0, branch.p1, branch.p2, branch.p3, attachT);
        const angle = Math.atan2(tangent.y, tangent.x);
        scrolls.push({
          branch,
          t: attachT,
          anchor,
          angle,
          title: entry.title,
          detail: entry.detail,
          width: rand(46, 58),
          height: rand(60, 72),
          wobblePhase: Math.random() * Math.PI * 2,
          wobbleSpeed: rand(0.4, 0.9),
          haloPhase: Math.random() * Math.PI * 2,
          expanded: false,
          worldX: anchor.x,
          worldY: anchor.y,
          radius: 40
        });
      }
    }
  }

  const dust = Array.from({ length: 60 }, () => ({
    x: rand(-520, 520),
    y: rand(rootY - 60, 520),
    vx: rand(-16, 16) * 0.05,
    vy: rand(-9, 9) * 0.035,
    r: rand(0.9, 2.4),
    a: rand(0.35, 0.9),
    gold: Math.random() < 0.4
  }));

  const treeVeinStreams = [];
  let treeScale = 1;
  let treeCenterX = 0;
  let treeTop = 0;
  let treeHeight = 0;
  let treeWidth = 0;
  let treeWorldTop = rootY - 40;
  let treeDrawOffsetX = 0;
  let treeDrawOffsetY = 0;

  let drawTreeSilhouette = () => {};
  let drawTreeVeins = () => {};
  let hitTestTree = () => false;
  let treeMaskData = null;
  let treeMaskWidth = 0;
  let treeMaskHeight = 0;
  let treeHitPath = null;
  const hitTestCanvas = document.createElement('canvas');
  hitTestCanvas.width = hitTestCanvas.height = 1;
  const hitTestCtx = hitTestCanvas.getContext('2d');
  const hoverGlow = { x: 0, y: 0, strength: 0, target: 0 };

  const svgNs = 'http://www.w3.org/2000/svg';
  const treePathElement = document.getElementById('tree-silhouette-path');
  const treeImageElement = document.getElementById('tree-silhouette-image');

  let treeReadyPromise;

  function withTreeTransform(fn){
    ctx.save();
    ctx.translate(0, treeWorldTop);
    ctx.scale(treeScale, treeScale);
    ctx.translate(-treeCenterX, -treeTop);
    try {
      fn();
    } finally {
      ctx.restore();
    }
  }

  function tintMaskCanvas(maskCanvas, fillStyle){
    const tinted = document.createElement('canvas');
    tinted.width = maskCanvas.width;
    tinted.height = maskCanvas.height;
    const tctx = tinted.getContext('2d');
    tctx.drawImage(maskCanvas, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = fillStyle;
    tctx.fillRect(0, 0, tinted.width, tinted.height);
    return tinted;
  }

  function worldToTree(wx, wy){
    if (!treeScale) return { x: 0, y: 0 };
    return {
      x: wx / treeScale + treeCenterX,
      y: (wy - treeWorldTop) / treeScale + treeTop
    };
  }

  function updateTreeHover(wx, wy){
    if (!hitTestTree) return;
    if (typeof dragging !== 'undefined' && dragging){
      hoverGlow.target = 0;
      return;
    }
    if (hitTestTree(wx, wy)){
      hoverGlow.x = wx;
      hoverGlow.y = wy;
      hoverGlow.target = 1;
    } else {
      hoverGlow.target = 0;
    }
  }

  function createStreamSampler(pathElement, totalLength){
    if (!pathElement || typeof pathElement.getPointAtLength !== 'function' || !isFinite(totalLength) || totalLength <= 0){
      return { samples: [], step: 1 };
    }
    const sampleStep = Math.max(28, totalLength / 220);
    const sampleCount = Math.max(2, Math.ceil(totalLength / sampleStep));
    const samples = [];
    for (let i = 0; i <= sampleCount; i++){
      const dist = Math.min(totalLength, i * sampleStep);
      const pt = pathElement.getPointAtLength(dist);
      samples.push({ x: pt.x, y: pt.y, dist });
    }
    if (samples.length && samples[samples.length - 1].dist !== totalLength){
      const last = pathElement.getPointAtLength(totalLength);
      samples[samples.length - 1] = { x: last.x, y: last.y, dist: totalLength };
    }
    return { samples, step: sampleStep };
  }

  function createPolylineSampler(points){
    if (!points || points.length < 2){
      return { samples: points ? points.map(p => ({ x: p.x, y: p.y, dist: 0 })) : [], step: 1, totalLength: 0 };
    }
    const segments = [];
    let cumulative = 0;
    for (let i = 1; i < points.length; i++){
      const prev = points[i - 1];
      const curr = points[i];
      const len = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      if (len < 0.6) continue;
      segments.push({ x0: prev.x, y0: prev.y, x1: curr.x, y1: curr.y, len, start: cumulative });
      cumulative += len;
    }
    if (!segments.length){
      return { samples: [{ x: points[0].x, y: points[0].y, dist: 0 }], step: 1, totalLength: 0 };
    }
    const totalLength = cumulative;
    const sampleStep = Math.max(32, totalLength / 180);
    const sampleCount = Math.max(2, Math.ceil(totalLength / sampleStep));

    function sampleAt(dist){
      if (dist <= 0){
        const seg = segments[0];
        return { x: seg.x0, y: seg.y0, dist: 0 };
      }
      if (dist >= totalLength){
        const seg = segments[segments.length - 1];
        return { x: seg.x1, y: seg.y1, dist: totalLength };
      }
      for (const seg of segments){
        if (dist <= seg.start + seg.len){
          const t = (dist - seg.start) / seg.len;
          return {
            x: seg.x0 + (seg.x1 - seg.x0) * t,
            y: seg.y0 + (seg.y1 - seg.y0) * t,
            dist
          };
        }
      }
      const seg = segments[segments.length - 1];
      return { x: seg.x1, y: seg.y1, dist: totalLength };
    }

    const samples = [];
    for (let i = 0; i <= sampleCount; i++){
      const dist = Math.min(totalLength, i * sampleStep);
      samples.push(sampleAt(dist));
    }
    if (samples[samples.length - 1].dist !== totalLength){
      samples[samples.length - 1] = sampleAt(totalLength);
    }
    return { samples, step: sampleStep, totalLength };
  }

  function sampleStreamPoint(stream, dist){
    const samples = stream && stream.samples;
    if (!samples || !samples.length){
      return { x: 0, y: 0 };
    }
    if (dist <= 0) return samples[0];
    if (!isFinite(dist)) return samples[samples.length - 1];
    if (dist >= stream.length){
      return samples[samples.length - 1];
    }
    const step = stream.sampleStep || (samples.length > 1 ? samples[1].dist - samples[0].dist : 1);
    const approxIndex = Math.max(0, Math.min(samples.length - 2, Math.floor(dist / Math.max(1e-6, step))));
    const start = samples[approxIndex];
    const end = samples[approxIndex + 1];
    const startDist = start.dist ?? approxIndex * step;
    const endDist = end.dist ?? (approxIndex + 1) * step;
    const span = Math.max(1e-5, endDist - startDist);
    const t = Math.max(0, Math.min(1, (dist - startDist) / span));
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t
    };
  }

  let veinBufferCanvas = null;
  let veinBufferCtx = null;
  let veinBufferDirty = true;

  const renderVeinStreams = (dtMs, time) => {
    if (!treeVeinStreams.length) return;
    const dt = dtMs * 0.001;
    const targetW = Math.max(1, Math.round(treeWidth * VEIN_BUFFER_SCALE));
    const targetH = Math.max(1, Math.round(treeHeight * VEIN_BUFFER_SCALE));
    if (!veinBufferCanvas || veinBufferCanvas.width !== targetW || veinBufferCanvas.height !== targetH){
      veinBufferCanvas = document.createElement('canvas');
      veinBufferCanvas.width = targetW;
      veinBufferCanvas.height = targetH;
      veinBufferCtx = veinBufferCanvas.getContext('2d');
      veinBufferDirty = true;
    }
    withTreeTransform(() => {
      const bufferCtx = veinBufferCtx;
      if (veinBufferDirty){
        bufferCtx.lineCap = 'round';
        bufferCtx.lineJoin = 'round';
        bufferCtx.setLineDash([]);
        for (const stream of treeVeinStreams){
          const total = stream.length;
          if (!isFinite(total) || total <= 0) continue;
          for (const particle of stream.particles){
            particle._pos = particle.pos;
          }
        }
      }
      bufferCtx.setTransform(1, 0, 0, 1, 0, 0);
      bufferCtx.globalCompositeOperation = 'source-over';
      bufferCtx.clearRect(0, 0, veinBufferCanvas.width, veinBufferCanvas.height);
      bufferCtx.globalCompositeOperation = 'lighter';
      const bufferScaleX = veinBufferCanvas.width / treeWidth;
      const bufferScaleY = veinBufferCanvas.height / treeHeight;
      bufferCtx.save();
      bufferCtx.scale(bufferScaleX, bufferScaleY);

      for (const stream of treeVeinStreams){
        const total = stream.length;
        if (!isFinite(total) || total <= 0) continue;
        for (const particle of stream.particles){
          particle._pos = (particle._pos + particle.speed * dt) % total;
          particle.pos = particle._pos;
          const head = Math.min(total - 0.01, particle._pos);
          const tail = Math.max(0, head - particle.span);
          const steps = Math.max(5, Math.min(12, Math.round(particle.span / (stream.segmentLength || 1) * 4.5)));
          const stepSize = steps > 0 ? Math.max(0.6, (head - tail) / steps) : (head - tail || 1);
          bufferCtx.beginPath();
          for (let seg = 0; seg <= steps; seg++){
            const dist = Math.max(0, head - seg * stepSize);
            const pt = sampleStreamPoint(stream, dist);
            const px = pt.x - treeDrawOffsetX;
            const py = pt.y - treeDrawOffsetY;
            if (seg === 0){
              bufferCtx.moveTo(px, py);
            } else {
              bufferCtx.lineTo(px, py);
            }
          }
          const widthPx = (stream.baseWidth * 0.42 + 0.58 + particle.glow * 0.62) * (0.72 + 0.28 * Math.sin(time * 2.2 + particle.phase));
          bufferCtx.lineWidth = widthPx;
          const tailAlpha = 0.06 + 0.12 * particle.glow;
          bufferCtx.strokeStyle = `rgba(247,194,113,${tailAlpha})`;
          bufferCtx.stroke();

          const headPt = sampleStreamPoint(stream, head);
          bufferCtx.fillStyle = 'rgba(247,194,113,0.3)';
          bufferCtx.beginPath();
          const headRadius = 2.4 + 1.6 * particle.glow;
          bufferCtx.arc(headPt.x - treeDrawOffsetX, headPt.y - treeDrawOffsetY, headRadius, 0, Math.PI * 2);
          bufferCtx.fill();

          // add small trailing sparks for perceived motion
          const sparkCount = Math.min(steps, 4);
          for (let s = 1; s <= sparkCount; s++){
            const dist = Math.max(0, head - s * stepSize * 0.9);
            const pt = sampleStreamPoint(stream, dist);
            const px = pt.x - treeDrawOffsetX;
            const py = pt.y - treeDrawOffsetY;
            const fade = 1 - s / (sparkCount + 1);
            const radius = Math.max(0.9, headRadius * 0.35 * fade);
            bufferCtx.fillStyle = `rgba(247,194,113,${tailAlpha * fade * 1.6})`;
            bufferCtx.beginPath();
            bufferCtx.arc(px, py, radius, 0, Math.PI * 2);
            bufferCtx.fill();
          }
        }
      }

      bufferCtx.restore();
      veinBufferDirty = false;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(veinBufferCanvas, treeDrawOffsetX, treeDrawOffsetY, treeWidth, treeHeight);
      ctx.restore();
    });
  };

  if (treePathElement) {
    const treePathData = treePathElement.getAttribute('d') || '';
    if (!treePathData) {
      throw new Error('Tree silhouette path is missing its "d" attribute');
    }
    const treePath = new Path2D(treePathData);
    treeHitPath = treePath;
    hitTestTree = (wx, wy) => {
      const local = worldToTree(wx, wy);
      return hitTestCtx.isPointInPath(treeHitPath, local.x, local.y);
    };
    const tempSvg = document.createElementNS(svgNs, 'svg');
    tempSvg.setAttribute('width', '0');
    tempSvg.setAttribute('height', '0');
    tempSvg.style.position = 'absolute';
    tempSvg.style.opacity = '0';
    tempSvg.style.pointerEvents = 'none';
    const tempPath = document.createElementNS(svgNs, 'path');
    tempPath.setAttribute('d', treePathData);
    tempSvg.appendChild(tempPath);
    document.body.appendChild(tempSvg);
    const rawBBox = tempPath.getBBox();
    const treeBBox = {
      x: rawBBox.x,
      y: rawBBox.y,
      width: rawBBox.width,
      height: rawBBox.height
    };
    const treeTargetWidth = 980;
    const treeTargetHeight = 1180;
    treeScale = Math.min(treeTargetWidth / treeBBox.width, treeTargetHeight / treeBBox.height);
    treeCenterX = treeBBox.x + treeBBox.width / 2;
    treeTop = treeBBox.y;
    treeHeight = treeBBox.height;
    treeWidth = treeBBox.width;
    treeDrawOffsetX = treeBBox.x;
    treeDrawOffsetY = treeTop;
    treeWorldTop = rootY - 40;

    const subPathStrings = treePathData.split(/(?=M\s)/g).map(s => s.trim()).filter(Boolean);
    for (const rawSub of subPathStrings){
      const subPath = rawSub.startsWith('M') ? rawSub : `M ${rawSub}`;
      if (subPath.length < 4) continue;
      const streamPath = document.createElementNS(svgNs, 'path');
      streamPath.setAttribute('d', subPath);
      tempSvg.appendChild(streamPath);

      let totalLength;
      try {
        totalLength = streamPath.getTotalLength();
      } catch (_) {
        tempSvg.removeChild(streamPath);
        continue;
      }
      if (!isFinite(totalLength) || totalLength < 160){
        tempSvg.removeChild(streamPath);
        continue;
      }

      const bbox = streamPath.getBBox();
      const baseWidth = Math.max(1.2, Math.min(4.2, Math.sqrt(bbox.width * bbox.height) * 0.0028));
      const segmentLength = Math.max(60, totalLength * 0.055);
      const particleCount = Math.min(8, Math.max(3, Math.round(totalLength / 520)));
      const particles = Array.from({ length: particleCount }, () => ({
        pos: Math.random() * totalLength,
        speed: rand(45, 95),
        span: rand(segmentLength * 1.7, segmentLength * 3.6),
        glow: rand(0.5, 1),
        phase: Math.random() * Math.PI * 2
      }));

      const sampler = createStreamSampler(streamPath, totalLength);
      treeVeinStreams.push({
        length: totalLength,
        baseWidth,
        segmentLength,
        particles,
        samples: sampler.samples,
        sampleStep: sampler.step,
        cursor: 0
      });
      tempSvg.removeChild(streamPath);
    }

    if (tempPath.parentNode === tempSvg) {
      tempSvg.removeChild(tempPath);
    }
    if (tempSvg.parentNode) {
      tempSvg.parentNode.removeChild(tempSvg);
    }

    treeReadyPromise = Promise.resolve();

    drawTreeSilhouette = time => {
      const pulse = 0.5 + Math.sin(time * 0.8) * 0.5;
      withTreeTransform(() => {
        ctx.fillStyle = '#05090d';
        ctx.fill(treePath);

        ctx.save();
        ctx.shadowColor = `rgba(247,194,113,${0.22 + 0.16 * pulse})`;
        ctx.shadowBlur = 90 + 50 * pulse;
        ctx.fillStyle = `rgba(247,194,113,${0.10 + 0.08 * pulse})`;
        ctx.fill(treePath);
        ctx.restore();

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createLinearGradient(0, 0, 0, treeHeight);
        grad.addColorStop(0, `rgba(247,194,113,${0.28 + 0.12 * pulse})`);
        grad.addColorStop(0.35, 'rgba(247,194,113,0.18)');
        grad.addColorStop(0.72, 'rgba(120,180,200,0.06)');
        grad.addColorStop(1, 'rgba(50,70,80,0)');
        ctx.fillStyle = grad;
        ctx.fill(treePath);
        ctx.restore();

        ctx.lineWidth = 3 / treeScale;
        ctx.strokeStyle = `rgba(247,194,113,${0.09 + 0.05 * pulse})`;
        ctx.stroke(treePath);
      });
    };
    drawTreeVeins = renderVeinStreams;
    veinBufferDirty = true;
    veinBufferDirty = true;
  } else if (treeImageElement) {
    const waitForImage = () => {
      if (treeImageElement.complete && treeImageElement.naturalWidth && treeImageElement.naturalHeight) {
        return Promise.resolve();
      }
      if (treeImageElement.decode) {
        return treeImageElement.decode().catch(() => {});
      }
      return new Promise(resolve => {
        let settled = false;
        let onLoad;
        let onError;
        const cleanup = () => {
          if (settled) return;
          settled = true;
          if (onLoad) treeImageElement.removeEventListener('load', onLoad);
          if (onError) treeImageElement.removeEventListener('error', onError);
          resolve();
        };
        onLoad = () => cleanup();
        onError = () => cleanup();
        treeImageElement.addEventListener('load', onLoad, { once: true });
        treeImageElement.addEventListener('error', onError, { once: true });
      });
    };

    function buildMaskSkeletonPolylines(maskCanvas, offsetX, offsetY){
      const maxDim = 420;
      const scaleFactor = Math.min(maxDim / maskCanvas.width, maxDim / maskCanvas.height, 1);
      const sampleWidth = Math.max(64, Math.round(maskCanvas.width * scaleFactor));
      const sampleHeight = Math.max(64, Math.round(maskCanvas.height * scaleFactor));
      const temp = document.createElement('canvas');
      temp.width = sampleWidth;
      temp.height = sampleHeight;
      const tctx = temp.getContext('2d');
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(maskCanvas, 0, 0, sampleWidth, sampleHeight);
      const { data } = tctx.getImageData(0, 0, sampleWidth, sampleHeight);
      const binary = new Uint8Array(sampleWidth * sampleHeight);
      for (let i = 0; i < sampleWidth * sampleHeight; i++){
        const alpha = data[i * 4 + 3];
        binary[i] = alpha > 32 ? 1 : 0;
      }
      const skeleton = thinZhangSuen(binary, sampleWidth, sampleHeight);
      const polylines = extractSkeletonPolylines(skeleton, sampleWidth, sampleHeight);
      const scaleX = maskCanvas.width / sampleWidth;
      const scaleY = maskCanvas.height / sampleHeight;
      return polylines.map(line => {
        const scaled = line.map(pt => ({
          x: offsetX + (pt.x + 0.5) * scaleX,
          y: offsetY + (pt.y + 0.5) * scaleY
        }));
        return smoothPolyline(scaled, 2);
      });
    }

    function thinZhangSuen(binary, width, height){
      const data = binary.slice();
      const idx = (x, y) => y * width + x;
      const neighborOffsets = [
        [0, -1], [1, -1], [1, 0], [1, 1],
        [0, 1], [-1, 1], [-1, 0], [-1, -1]
      ];
      const getNeighbors = (x, y, store) => {
        for (let i = 0; i < 8; i++){
          const nx = x + neighborOffsets[i][0];
          const ny = y + neighborOffsets[i][1];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height){
            store[i] = 0;
          } else {
            store[i] = data[idx(nx, ny)];
          }
        }
        return store;
      };
      const neighborBuffer = new Array(8).fill(0);
      let changed = true;
      while (changed){
        changed = false;
        const toClear = [];
        for (let y = 1; y < height - 1; y++){
          for (let x = 1; x < width - 1; x++){
            const p = idx(x, y);
            if (!data[p]) continue;
            const nb = getNeighbors(x, y, neighborBuffer);
            const neighborSum = nb[0] + nb[1] + nb[2] + nb[3] + nb[4] + nb[5] + nb[6] + nb[7];
            if (neighborSum < 2 || neighborSum > 6) continue;
            let transitions = 0;
            for (let i = 0; i < 8; i++){
              const current = nb[i];
              const next = nb[(i + 1) % 8];
              if (!current && next) transitions++;
            }
            if (transitions !== 1) continue;
            if (nb[0] && nb[2] && nb[4]) continue;
            if (nb[2] && nb[4] && nb[6]) continue;
            toClear.push(p);
          }
        }
        if (toClear.length){
          changed = true;
          for (const p of toClear){
            data[p] = 0;
          }
        }
        toClear.length = 0;
        for (let y = 1; y < height - 1; y++){
          for (let x = 1; x < width - 1; x++){
            const p = idx(x, y);
            if (!data[p]) continue;
            const nb = getNeighbors(x, y, neighborBuffer);
            const neighborSum = nb[0] + nb[1] + nb[2] + nb[3] + nb[4] + nb[5] + nb[6] + nb[7];
            if (neighborSum < 2 || neighborSum > 6) continue;
            let transitions = 0;
            for (let i = 0; i < 8; i++){
              const current = nb[i];
              const next = nb[(i + 1) % 8];
              if (!current && next) transitions++;
            }
            if (transitions !== 1) continue;
            if (nb[0] && nb[2] && nb[6]) continue;
            if (nb[0] && nb[4] && nb[6]) continue;
            toClear.push(p);
          }
        }
        if (toClear.length){
          changed = true;
          for (const p of toClear){
            data[p] = 0;
          }
        }
      }
      return data;
    }

    function extractSkeletonPolylines(skeleton, width, height){
      const neighborOffsets = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 1, dy: 1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: -1, dy: -1 }
      ];
      const idx = (x, y) => y * width + x;
      const degrees = new Uint8Array(width * height);
      const nodes = new Set();
      const neighborsOf = (index) => {
        const x = index % width;
        const y = Math.floor(index / width);
        const result = [];
        for (const { dx, dy } of neighborOffsets){
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nIdx = idx(nx, ny);
          if (skeleton[nIdx]) result.push(nIdx);
        }
        return result;
      };
      for (let y = 0; y < height; y++){
        for (let x = 0; x < width; x++){
          const index = idx(x, y);
          if (!skeleton[index]) continue;
          const neighborCount = neighborsOf(index).length;
          degrees[index] = neighborCount;
          if (neighborCount !== 2){
            nodes.add(index);
          }
        }
      }
      const edgeVisited = new Set();
      const toPoint = index => ({ x: index % width, y: Math.floor(index / width) });
      const edgeKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
      const trace = (startIdx, nextIdx) => {
        const indices = [startIdx, nextIdx];
        let prev = startIdx;
        let current = nextIdx;
        let guard = 0;
        while (++guard < width * height){
          if (nodes.has(current) && current !== startIdx){
            break;
          }
          const neighbors = neighborsOf(current).filter(n => n !== prev);
          if (!neighbors.length){
            break;
          }
          const candidate = neighbors[0];
          prev = current;
          current = candidate;
          indices.push(current);
          if (nodes.has(current) && current !== startIdx){
            break;
          }
        }
        return indices;
      };
      const polylines = [];
      for (const startIdx of nodes){
        const neighbors = neighborsOf(startIdx);
        for (const neighbor of neighbors){
          const key = edgeKey(startIdx, neighbor);
          if (edgeVisited.has(key)) continue;
          const indices = trace(startIdx, neighbor);
          for (let i = 1; i < indices.length; i++){
            edgeVisited.add(edgeKey(indices[i - 1], indices[i]));
          }
          polylines.push(indices.map(toPoint));
        }
      }
      for (let index = 0; index < skeleton.length; index++){
        if (!skeleton[index]) continue;
        if (degrees[index] !== 2) continue;
        const neighbors = neighborsOf(index);
        for (const neighbor of neighbors){
          const key = edgeKey(index, neighbor);
          if (edgeVisited.has(key)) continue;
          const indices = trace(index, neighbor);
          for (let i = 1; i < indices.length; i++){
            edgeVisited.add(edgeKey(indices[i - 1], indices[i]));
          }
          polylines.push(indices.map(toPoint));
        }
      }
      return polylines.filter(poly => poly.length >= 2);
    }

    function smoothPolyline(points, passes){
      let pts = points.slice();
      for (let iter = 0; iter < passes; iter++){
        if (pts.length <= 3) break;
        const next = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++){
          const prev = pts[i - 1];
          const curr = pts[i];
          const after = pts[i + 1];
          next.push({
            x: (prev.x + curr.x + after.x) / 3,
            y: (prev.y + curr.y + after.y) / 3
          });
        }
        next.push(pts[pts.length - 1]);
        pts = next;
      }
      return pts;
    }

    function polylineLength(points){
      let total = 0;
      for (let i = 1; i < points.length; i++){
        const prev = points[i - 1];
        const curr = points[i];
        total += Math.hypot(curr.x - prev.x, curr.y - prev.y);
      }
      return total;
    }

    treeReadyPromise = waitForImage().then(() => {
      const naturalWidth = treeImageElement.naturalWidth || treeImageElement.width;
      const naturalHeight = treeImageElement.naturalHeight || treeImageElement.height;
      if (!naturalWidth || !naturalHeight) {
        throw new Error('Tree PNG is missing intrinsic dimensions');
      }

      treeTop = 0;
      treeHeight = naturalHeight;
      treeWidth = naturalWidth;
      treeCenterX = naturalWidth / 2;
      treeDrawOffsetX = 0;
      treeDrawOffsetY = 0;

      const treeTargetWidth = 980;
      const treeTargetHeight = 1180;
      treeScale = Math.min(treeTargetWidth / treeWidth, treeTargetHeight / treeHeight);
      treeWorldTop = rootY - 40;

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = naturalWidth;
      maskCanvas.height = naturalHeight;
      const maskCtx = maskCanvas.getContext('2d');
      maskCtx.drawImage(treeImageElement, 0, 0, naturalWidth, naturalHeight);

      let maskImageData = null;
      try {
        maskImageData = maskCtx.getImageData(0, 0, naturalWidth, naturalHeight);
      } catch (err) {
        console.warn('Dynasty tree: unable to sample PNG pixels (likely due to browser security restrictions); falling back to reduced effects.', err);
      }
      if (maskImageData){
        const data = maskImageData.data;
        for (let i = 0; i < data.length; i += 4){
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const maskAlpha = Math.max(0, Math.min(255, (255 - luminance))) * (a / 255);
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = maskAlpha;
        }
        maskCtx.putImageData(maskImageData, 0, 0);
      }

      const baseTexture = tintMaskCanvas(maskCanvas, '#05090d');
      const glowTexture = tintMaskCanvas(maskCanvas, '#f7c271');
      const highlightTexture = tintMaskCanvas(maskCanvas, '#f7c271');
      const maskCopy = document.createElement('canvas');
      maskCopy.width = maskCanvas.width;
      maskCopy.height = maskCanvas.height;
      maskCopy.getContext('2d').drawImage(maskCanvas, 0, 0);

      if (maskImageData){
        treeMaskData = maskImageData.data;
        treeMaskWidth = naturalWidth;
        treeMaskHeight = naturalHeight;
        hitTestTree = (wx, wy) => {
          const local = worldToTree(wx, wy);
          const lx = Math.round(local.x - treeDrawOffsetX);
          const ly = Math.round(local.y - treeDrawOffsetY);
          if (lx < 0 || ly < 0 || lx >= treeMaskWidth || ly >= treeMaskHeight) return false;
          const idx = (ly * treeMaskWidth + lx) * 4 + 3;
          return treeMaskData[idx] > 24;
        };
      } else {
        hitTestTree = () => false;
      }

      let flowCanvas = null;
      let flowCtx = null;
      let flowMask = null;
      let flowStripeGap = 0;
      let flowStripeWidth = 0;
      let lastFlowFrameTick = -1;
      const flowScale = 0.5;
      if (FLOW_OUTLINE_ENABLED && maskImageData){
        flowCanvas = document.createElement('canvas');
        flowCanvas.width = Math.max(1, Math.round(maskCanvas.width * flowScale));
        flowCanvas.height = Math.max(1, Math.round(maskCanvas.height * flowScale));
        flowCtx = flowCanvas.getContext('2d');
        flowMask = document.createElement('canvas');
        flowMask.width = flowCanvas.width;
        flowMask.height = flowCanvas.height;
        flowMask.getContext('2d').drawImage(
          maskCopy,
          0, 0, maskCopy.width, maskCopy.height,
          0, 0, flowCanvas.width, flowCanvas.height
        );
        flowStripeGap = Math.max(44, flowCanvas.height / 12);
        flowStripeWidth = flowStripeGap * 0.45;
      }

      const updateFlowTexture = flowCtx ? (time => {
        const tick = Math.floor(time * 18);
        if (tick === lastFlowFrameTick) return;
        lastFlowFrameTick = tick;
        flowCtx.clearRect(0, 0, flowCanvas.width, flowCanvas.height);
        const travel = flowStripeGap * 1.2;
        const offset = (time * 12) % travel;
        for (let y = -flowStripeGap * 2 + offset; y < flowCanvas.height + flowStripeGap * 2; y += flowStripeGap){
          const grad = flowCtx.createLinearGradient(0, y - flowStripeWidth, 0, y + flowStripeWidth);
          grad.addColorStop(0, 'rgba(247,194,113,0)');
          grad.addColorStop(0.4, 'rgba(247,194,113,0.04)');
          grad.addColorStop(0.5, 'rgba(255,236,200,0.12)');
          grad.addColorStop(0.6, 'rgba(247,194,113,0.04)');
          grad.addColorStop(1, 'rgba(247,194,113,0)');
          flowCtx.fillStyle = grad;
          flowCtx.fillRect(0, y - flowStripeWidth, flowCanvas.width, flowStripeWidth * 2);
        }
        flowCtx.globalCompositeOperation = 'destination-in';
        flowCtx.drawImage(flowMask, 0, 0);
        flowCtx.globalCompositeOperation = 'source-over';
      }) : (() => {});

      treeVeinStreams.length = 0;
      if (maskImageData){
        try {
          const skeletonPolylines = buildMaskSkeletonPolylines(maskCanvas, treeDrawOffsetX, treeDrawOffsetY);
          const veinCandidates = skeletonPolylines
            .map(points => ({ points, length: polylineLength(points) }))
            .filter(item => item.length > 140)
            .sort((a, b) => b.length - a.length)
            .slice(0, 20);
          for (const { points, length } of veinCandidates){
            const sampler = createPolylineSampler(points);
            if (!sampler.samples.length || !isFinite(length) || length <= 0) continue;
            const segmentLength = Math.max(60, length * 0.06);
            const particleCount = Math.min(8, Math.max(3, Math.round(length / 520)));
            const particles = Array.from({ length: particleCount }, () => ({
              pos: Math.random() * length,
              speed: rand(45, 95),
              span: rand(segmentLength * 1.7, segmentLength * 3.4),
              glow: rand(0.5, 1),
              phase: Math.random() * Math.PI * 2
            }));
            treeVeinStreams.push({
              length,
              baseWidth: Math.max(1.4, Math.min(5, Math.sqrt(length) * 0.06)),
              segmentLength,
              particles,
              samples: sampler.samples,
              sampleStep: sampler.step
            });
          }
        } catch (err) {
          console.warn('Dynasty tree: unable to derive skeleton paths from PNG; disabling animated veins for this session.', err);
        }
      }

      drawTreeVeins = treeVeinStreams.length ? renderVeinStreams : () => {};
      veinBufferDirty = true;

      drawTreeSilhouette = time => {
        const pulse = 0.5 + Math.sin(time * 0.8) * 0.5;
        withTreeTransform(() => {
          ctx.drawImage(baseTexture, treeDrawOffsetX, treeDrawOffsetY);

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.28 + 0.22 * pulse;
          ctx.drawImage(glowTexture, treeDrawOffsetX, treeDrawOffsetY);
          ctx.globalAlpha *= 0.55;
          ctx.drawImage(glowTexture, treeDrawOffsetX, treeDrawOffsetY);
          ctx.restore();

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1;
          ctx.filter = 'none';
          const grad = ctx.createLinearGradient(0, 0, 0, treeHeight);
          grad.addColorStop(0, `rgba(247,194,113,${0.28 + 0.12 * pulse})`);
          grad.addColorStop(0.35, 'rgba(247,194,113,0.18)');
          grad.addColorStop(0.72, 'rgba(120,180,200,0.06)');
          grad.addColorStop(1, 'rgba(50,70,80,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(treeDrawOffsetX, treeDrawOffsetY, treeWidth, treeHeight);
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(maskCopy, treeDrawOffsetX, treeDrawOffsetY);
          ctx.restore();

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const shimmerCenter = treeDrawOffsetY + treeHeight * (0.28 + 0.18 * Math.sin(time * 0.45));
          const shimmerSpan = treeHeight * 0.34;
          const shimmer = ctx.createLinearGradient(0, shimmerCenter - shimmerSpan, 0, shimmerCenter + shimmerSpan);
          shimmer.addColorStop(0, 'rgba(247,194,113,0)');
          shimmer.addColorStop(0.35, `rgba(247,194,113,${0.12 + 0.08 * pulse})`);
          shimmer.addColorStop(0.5, `rgba(255,236,200,${0.26 + 0.14 * pulse})`);
          shimmer.addColorStop(0.65, `rgba(247,194,113,${0.12 + 0.08 * pulse})`);
          shimmer.addColorStop(1, 'rgba(247,194,113,0)');
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = shimmer;
          ctx.fillRect(treeDrawOffsetX, treeDrawOffsetY, treeWidth, treeHeight);
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(maskCopy, treeDrawOffsetX, treeDrawOffsetY);
          ctx.restore();

          if (flowCanvas){
            updateFlowTexture(time);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.18 + 0.12 * pulse;
            ctx.drawImage(flowCanvas, treeDrawOffsetX, treeDrawOffsetY, treeWidth, treeHeight);
            ctx.restore();
          }

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.16 + 0.12 * pulse;
          ctx.drawImage(highlightTexture, treeDrawOffsetX, treeDrawOffsetY);
          ctx.globalAlpha *= 0.5;
          ctx.drawImage(highlightTexture, treeDrawOffsetX, treeDrawOffsetY);
          ctx.restore();

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.34 + 0.22 * pulse;
          const rootCenterY = treeDrawOffsetY + treeHeight * 0.86;
          const rootGlow = ctx.createRadialGradient(treeCenterX, rootCenterY, treeWidth * 0.05, treeCenterX, rootCenterY, treeWidth * 0.48);
          rootGlow.addColorStop(0, `rgba(255,224,170,${0.28 + 0.18 * pulse})`);
          rootGlow.addColorStop(1, 'rgba(50,40,10,0)');
          ctx.fillStyle = rootGlow;
          ctx.beginPath();
          ctx.rect(treeDrawOffsetX, treeDrawOffsetY, treeWidth, treeHeight);
          ctx.fill();
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(maskCopy, treeDrawOffsetX, treeDrawOffsetY);
          ctx.restore();
        });
      };
    });
  } else {
    throw new Error('No tree silhouette asset was provided');
  }

  function branchStrokePath(branch){
    ctx.beginPath();
    ctx.moveTo(branch.p0.x, branch.p0.y);
    ctx.bezierCurveTo(
      branch.p1.x, branch.p1.y,
      branch.p2.x, branch.p2.y,
      branch.p3.x, branch.p3.y
    );
  }

  function drawBranchSilhouette(branch, color, thickness){
    branchStrokePath(branch);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.stroke();
  }

  function drawBranchGlow(branch, strength){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    branchStrokePath(branch);
    ctx.lineWidth = branch.thickness * (1.35 + strength * 1.2);
    ctx.strokeStyle = `rgba(247,194,113,${0.06 + strength * 0.35})`;
    ctx.shadowColor = 'rgba(247,194,113,0.6)';
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();
  }

  function drawVeins(branch, time){
    if (!branch.veins || !branch.veins.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const vein of branch.veins){
      vein.t = (vein.t + vein.speed) % 1;
      const point = bezierPoint(branch.p0, branch.p1, branch.p2, branch.p3, vein.t);
      const pulse = 0.45 + 0.55 * Math.sin(time * 2.6 + vein.phase);
      const radius = vein.size * (0.9 + 0.6 * pulse);
      ctx.fillStyle = `rgba(247,194,113,${0.38 + pulse * 0.4})`;
      ctx.shadowColor = 'rgba(247,194,113,0.8)';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawScrolls(time){
    if (!scrolls.length) return;
    withTreeTransform(() => {
      ctx.save();
      ctx.font = '600 16px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const scroll of scrolls){
        const anchor = bezierPoint(scroll.branch.p0, scroll.branch.p1, scroll.branch.p2, scroll.branch.p3, scroll.t);
        scroll.worldX = anchor.x;
        scroll.worldY = anchor.y;
        const wobble = Math.sin(time * scroll.wobbleSpeed + scroll.wobblePhase) * 6;
        const haloPulse = 0.5 + 0.5 * Math.sin(time * 1.8 + scroll.haloPhase);
        ctx.save();
        ctx.translate(anchor.x, anchor.y);
        ctx.rotate(scroll.angle);
        ctx.translate(0, wobble);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(247,194,113,${0.22 + 0.28 * haloPulse})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, scroll.width * 0.65, scroll.height * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = activeScroll === scroll ? 'rgba(32,24,16,0.92)' : 'rgba(32,24,16,0.82)';
        ctx.strokeStyle = 'rgba(247,194,113,0.8)';
        ctx.lineWidth = 2.4;
        roundedRectPath(-scroll.width / 2, -scroll.height / 2, scroll.width, scroll.height, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f5d7a1';
        ctx.fillText(scroll.title, 0, -4);
        if (activeScroll === scroll){
          ctx.font = '400 13px "Segoe UI", sans-serif';
          ctx.fillStyle = 'rgba(245, 215, 161, 0.9)';
          wrapText(scroll.detail, 0, 14, scroll.width * 0.8, 16);
        }

        ctx.restore();
      }
      ctx.restore();
    });
  }

  function wrapText(text, x, y, maxWidth, lineHeight){
    const words = text.split(' ');
    let line = '';
    for (const word of words){
      const test = line ? `${line} ${word}` : word;
      const metrics = ctx.measureText(test);
      if (metrics.width > maxWidth){
        ctx.fillText(line, x, y);
        line = word;
        y += lineHeight;
      } else {
        line = test;
      }
    }
    if (line){
      ctx.fillText(line, x, y);
    }
  }

  function roundedRectPath(x, y, width, height, radius){
    const r = Math.max(0, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawHoverHighlight(time){
    hoverGlow.strength += (hoverGlow.target - hoverGlow.strength) * 0.18;
    if (hoverGlow.strength < 0.02) return;
    const local = worldToTree(hoverGlow.x, hoverGlow.y);
    withTreeTransform(() => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.6 + 0.4 * Math.sin(time * 3 + local.x * 0.002);
      const mix = hoverGlow.strength * pulse;
      const inner = 6 + 10 * mix;
      const outer = 120 + 160 * hoverGlow.strength;
      const grad = ctx.createRadialGradient(local.x, local.y, inner, local.x, local.y, outer);
      grad.addColorStop(0, `rgba(247,194,113,${0.24 * mix})`);
      grad.addColorStop(0.45, `rgba(247,194,113,${0.12 * hoverGlow.strength})`);
      grad.addColorStop(1, 'rgba(247,194,113,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(local.x, local.y, outer, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawBackground(){
    ctx.save();
    const depthGrad = ctx.createLinearGradient(0, rootY - 320, 0, 580);
    depthGrad.addColorStop(0, '#030509');
    depthGrad.addColorStop(0.3, '#040910');
    depthGrad.addColorStop(0.55, '#060d15');
    depthGrad.addColorStop(1, '#020307');
    ctx.fillStyle = depthGrad;
    ctx.fillRect(-width, rootY - 360, width * 2, 1200);

    const aura = ctx.createRadialGradient(0, rootY - 140, 0, 0, rootY - 140, 540);
    aura.addColorStop(0, 'rgba(247,194,113,0.16)');
    aura.addColorStop(0.55, 'rgba(80,100,120,0.08)');
    aura.addColorStop(1, 'rgba(5,8,12,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, rootY - 140, 540, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  await (treeReadyPromise || Promise.resolve());
  function drawDust(dt){
    for (const d of dust){
      d.x += d.vx*dt; d.y += d.vy*dt;
      if (d.x < -560) d.x = 560; if (d.x > 560) d.x = -560;
      if (d.y < rootY-60) d.y = 520; if (d.y > 520) d.y = rootY-60;
      ctx.save();
      ctx.shadowColor = d.gold ? 'rgba(247,194,113,0.9)' : 'rgba(150,220,180,0.5)';
      ctx.shadowBlur = d.gold ? 8 : 6;
      ctx.fillStyle = d.gold ? 'rgba(247,194,113,'+d.a+')' : 'rgba(180,220,200,'+d.a+')';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // --- Animation loop
  let last = performance.now();
  function frame(now){
    const dt = Math.min(50, now-last); last = now;
    const t = now * 0.001;

    ctx.clearRect(0,0,width,height);

    // world
    ctx.save();
    applyCamera();

    // background gradients + mist
    drawBackground();

    // draw tree silhouette with glow
    drawTreeSilhouette(t);
    drawTreeVeins(dt, t);
    drawHoverHighlight(t);

    if (BRANCHES_ENABLED && branches.length){
      // draw branches: base silhouette (dark), then soft glow, then veins
      // draw thicker to thinner to fake depth
      const ordered = [...branches].sort((a,b)=>b.thickness - a.thickness);

      // shadow body
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      for (const b of ordered){
        drawBranchSilhouette(b, '#0a0d11', b.thickness*1.3);
        drawBranchSilhouette(b, '#0b1014', b.thickness);
      }
      ctx.restore();

      // soft rim glow along branches
      ctx.save();
      for (const b of ordered){
        drawBranchGlow(b, 0.18);
      }
      ctx.restore();

      // veins (golden moving lights)
      for (const b of ordered){
        drawVeins(b, t);
      }
    }

    // scroll nodes attached to branches (no-op if disabled)
    drawScrolls(t);

    // dust particles floating around
    drawDust(dt);

    // crown aura at top
    ctx.save();
    const grad = ctx.createRadialGradient(0, rootY-30, 18, 0, rootY-30, 320);
    grad.addColorStop(0, 'rgba(247,194,113,0.30)');
    grad.addColorStop(1, 'rgba(247,194,113,0.00)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, rootY-30, 320, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    ctx.restore(); // world

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
};

init().catch(err => {
  console.error('Failed to initialise tree scene:', err);
});
