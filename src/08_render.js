/*
 * Rendering: one WebGL scene with an orthographic camera tilted towards the
 * player, the static board, and pooled meshes for everything that changes.
 * The renderer reads state and never writes to it.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});
  var B = R.BALANCE;
  var V = R.VIEW;
  var C = R.COLORS;

  var rd = {};
  R.render = rd;

  rd.ready = false;
  rd.hitStop = 0;
  rd.cell = 40;
  rd.boardW = 0;
  rd.boardH = 0;

  var THREE = null;
  var scene = null;
  var camera = null;
  var renderer = null;
  var dummy = null;
  var raycaster = null;
  var pointerNdc = null;
  var boardPlane = null;
  var hitPoint = null;

  var cosTilt = Math.cos(V.TILT_DEG * Math.PI / 180);

  /* ---------- procedural textures ---------- */

  function makeCanvas(size) {
    var cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    return cv;
  }

  function glowTexture() {
    var s = 128;
    var cv = makeCanvas(s);
    var g = cv.getContext('2d');
    var grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.42)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    var t = new THREE.CanvasTexture(cv);
    return t;
  }

  /* A soft-edged bar used for beam segments; the gradient runs across width. */
  function beamTexture() {
    var s = 64;
    var cv = makeCanvas(s);
    var g = cv.getContext('2d');
    var grad = g.createLinearGradient(0, 0, s, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  }

  /* Arrow pointing towards -y in texture space (drawn up the plane). */
  function chevronTexture() {
    var s = 64;
    var cv = makeCanvas(s);
    var g = cv.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(14, 40);
    g.lineTo(32, 22);
    g.lineTo(50, 40);
    g.stroke();
    return new THREE.CanvasTexture(cv);
  }

  /* Soft-edged square so adjacent lit road cells merge into one band. */
  function tileGlowTexture() {
    var s = 64;
    var cv = makeCanvas(s);
    var g = cv.getContext('2d');
    var img = g.createImageData(s, s);
    for (var y = 0; y < s; y++) {
      for (var x = 0; x < s; x++) {
        var fx = Math.abs((x + 0.5) / s - 0.5) * 2;
        var fy = Math.abs((y + 0.5) / s - 0.5) * 2;
        var f = Math.max(fx, fy);
        var a = f < 0.76 ? 1 : Math.max(0, 1 - (f - 0.76) / 0.24);
        var o = (y * s + x) * 4;
        img.data[o] = 255;
        img.data[o + 1] = 255;
        img.data[o + 2] = 255;
        img.data[o + 3] = Math.round(a * a * 255);
      }
    }
    g.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(cv);
  }

  function ringTexture() {
    var s = 128;
    var cv = makeCanvas(s);
    var g = cv.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 10, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      g.beginPath();
      g.moveTo(s / 2 + Math.cos(a) * (s / 2 - 22), s / 2 + Math.sin(a) * (s / 2 - 22));
      g.lineTo(s / 2 + Math.cos(a) * (s / 2 - 34), s / 2 + Math.sin(a) * (s / 2 - 34));
      g.stroke();
    }
    return new THREE.CanvasTexture(cv);
  }

  rd.tex = {};

  /* ---------- scene construction ---------- */

  function buildLights() {
    var hemi = new THREE.HemisphereLight(0x8fa8e0, 0x0a0d18, 1.05);
    scene.add(hemi);
    var dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(2.5, 8, 4);
    scene.add(dir);
  }

  var tileMeshes = {};

  function buildBoard(state) {
    var kind = state.grid.kind;
    var i, c, r;

    var emptyIdx = [];
    var roadIdx = [];
    for (i = 0; i < kind.length; i++) {
      if (kind[i] === R.EMPTY) emptyIdx.push(i);
      else if (kind[i] === R.ROAD || kind[i] === R.SPAWN) roadIdx.push(i);
    }

    /* Buildable tiles sit slightly proud of the board. */
    var emptyGeo = new THREE.BoxGeometry(0.9, 0.18, 0.9);
    var emptyMat = new THREE.MeshLambertMaterial({ color: C.tile });
    var empties = new THREE.InstancedMesh(emptyGeo, emptyMat, emptyIdx.length);
    empties.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    for (i = 0; i < emptyIdx.length; i++) {
      c = R.grid.colOf(emptyIdx[i]);
      r = R.grid.rowOf(emptyIdx[i]);
      dummy.position.set(R.grid.worldX(c), -0.09, R.grid.worldZ(r));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      empties.setMatrixAt(i, dummy.matrix);
    }
    empties.instanceMatrix.needsUpdate = true;
    scene.add(empties);
    tileMeshes.empty = empties;
    tileMeshes.emptyIdx = emptyIdx;

    /* Road tiles form a continuous sunken ribbon. */
    var roadGeo = new THREE.BoxGeometry(1.0, 0.14, 1.0);
    var roadMat = new THREE.MeshLambertMaterial({ color: C.road });
    var roads = new THREE.InstancedMesh(roadGeo, roadMat, roadIdx.length);
    for (i = 0; i < roadIdx.length; i++) {
      c = R.grid.colOf(roadIdx[i]);
      r = R.grid.rowOf(roadIdx[i]);
      dummy.position.set(R.grid.worldX(c), -0.10, R.grid.worldZ(r));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      roads.setMatrixAt(i, dummy.matrix);
    }
    roads.instanceMatrix.needsUpdate = true;
    scene.add(roads);
    tileMeshes.road = roads;

    /* Direction chevrons on every road, pointing the way the enemies walk. */
    var steps = [];
    for (var rt = 0; rt < state.routes.length; rt++) {
      var rp = state.routes[rt].path;
      for (var si = 0; si < rp.length - 1; si++) steps.push([rp[si], rp[si + 1]]);
    }
    var chevGeo = new THREE.PlaneGeometry(0.62, 0.62);
    var chevMat = new THREE.MeshBasicMaterial({
      map: rd.tex.chevron,
      transparent: true,
      opacity: 0.36,
      color: C.chevron,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var chevrons = new THREE.InstancedMesh(chevGeo, chevMat, steps.length);
    for (i = 0; i < steps.length; i++) {
      var a = steps[i][0];
      var b2 = steps[i][1];
      var ang = Math.atan2(b2.c - a.c, -(b2.r - a.r));
      dummy.position.set(R.grid.worldX(a.c), 0.012, R.grid.worldZ(a.r));
      dummy.rotation.set(-Math.PI / 2, 0, -ang);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      chevrons.setMatrixAt(i, dummy.matrix);
    }
    chevrons.instanceMatrix.needsUpdate = true;
    scene.add(chevrons);
    tileMeshes.chevrons = chevrons;

    /*
     * One portal per road. A road the player has not been shown yet is drawn
     * faintly rather than hidden, so the second entrance is somewhere on the
     * board before anything ever walks out of it.
     */
    rd.portalRings = [];
    for (var pi = 0; pi < state.routes.length; pi++) {
      var sp = state.routes[pi].spawn;
      var portal = new THREE.Group();
      portal.position.set(R.grid.worldX(sp[0]), 0.015, R.grid.worldZ(sp[1]));
      var disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.42, 24),
        new THREE.MeshBasicMaterial({ color: 0x140a22 })
      );
      disc.rotation.x = -Math.PI / 2;
      portal.add(disc);
      var ring = new THREE.Mesh(
        new THREE.PlaneGeometry(0.94, 0.94),
        new THREE.MeshBasicMaterial({
          map: rd.tex.ring,
          color: 0x9b4dff,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      portal.add(ring);
      scene.add(portal);
      rd.portalRings.push(ring);
    }
    rd.portalRing = rd.portalRings[0];

    /* The Lumen Core: pedestal, crystal and a glow disc on the floor. */
    var core = new THREE.Group();
    core.position.set(R.grid.worldX(R.MAP.core[0]), 0, R.grid.worldZ(R.MAP.core[1]));
    var ped = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.42, 0.22, 6),
      new THREE.MeshLambertMaterial({ color: 0x2b3766 })
    );
    ped.position.y = 0.11;
    core.add(ped);
    var crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3, 0),
      new THREE.MeshLambertMaterial({ color: C.core, emissive: C.coreRim, emissiveIntensity: 0.9 })
    );
    crystal.position.y = 0.52;
    core.add(crystal);
    var haze = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({
        map: rd.tex.glow,
        color: C.coreRim,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    haze.rotation.x = -Math.PI / 2;
    haze.position.y = 0.02;
    core.add(haze);
    scene.add(core);
    rd.coreGroup = core;
    rd.coreCrystal = crystal;
    rd.coreHaze = haze;
  }

  /* ---------- init ---------- */

  rd.init = function (state) {
    THREE = global.THREE;
    if (!THREE) return false;

    var canvas = document.getElementById('gl');
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    } catch (err) {
      return false;
    }
    if (!renderer || !renderer.getContext()) return false;

    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setClearColor(C.background, 1);

    scene = new THREE.Scene();
    dummy = new THREE.Object3D();
    raycaster = new THREE.Raycaster();
    pointerNdc = new THREE.Vector2();
    hitPoint = new THREE.Vector3();
    boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    var t = V.TILT_DEG * Math.PI / 180;
    camera.position.set(0, V.CAMERA_DISTANCE * Math.cos(t), V.CAMERA_DISTANCE * Math.sin(t));
    camera.lookAt(0, 0, 0);

    rd.tex.glow = glowTexture();
    rd.tex.beam = beamTexture();
    rd.tex.chevron = chevronTexture();
    rd.tex.ring = ringTexture();
    rd.tex.tileGlow = tileGlowTexture();
    rd.tex.frame = frameTexture();
    rd.tex.shard = shardTexture();

    buildLights();
    buildBoard(state);
    rd.buildDynamic();

    rd.scene = scene;
    rd.camera = camera;
    rd.renderer = renderer;
    rd.THREE = THREE;
    rd.ready = true;
    return true;
  };

  /* ---------- layout ---------- */

  rd.applyLayout = function () {
    var app = document.getElementById('app');
    var wrap = document.getElementById('boardWrap');
    var board = document.getElementById('board');
    var vw = global.innerWidth;
    var vh = global.innerHeight;

    var colW = Math.min(vw, Math.round(vh * R.LAYOUT.COLUMN_ASPECT));
    app.style.width = colW + 'px';
    document.body.classList.toggle('wide', vw > vh);

    var availW = wrap.clientWidth;
    var availH = wrap.clientHeight;
    var cellsW = B.COLS + 2 * V.MARGIN_X;
    var cellsH = B.ROWS + V.MARGIN_TOP + V.MARGIN_BOTTOM;
    var cell = Math.min(availW / cellsW, availH / cellsH);
    if (!(cell > 0)) cell = R.LAYOUT.MIN_CELL;

    var w = Math.max(64, Math.round(cellsW * cell));
    var h = Math.max(64, Math.round(cellsH * cell));
    board.style.width = w + 'px';
    board.style.height = h + 'px';

    rd.cell = cell;
    rd.boardW = w;
    rd.boardH = h;

    if (!rd.ready) return;

    camera.left = -(B.COLS / 2 + V.MARGIN_X);
    camera.right = B.COLS / 2 + V.MARGIN_X;
    camera.top = (B.ROWS / 2 + V.MARGIN_TOP) * cosTilt;
    camera.bottom = -(B.ROWS / 2 + V.MARGIN_BOTTOM) * cosTilt;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };

  /* ---------- coordinate helpers ---------- */

  /* Board-overlay pixel position of a world point. */
  var projScratch = null;
  rd.project = function (x, y, z, out) {
    if (!rd.ready) return null;
    if (!projScratch) projScratch = new THREE.Vector3();
    projScratch.set(x, y, z).project(camera);
    var o = out || {};
    o.x = (projScratch.x * 0.5 + 0.5) * rd.boardW;
    o.y = (-projScratch.y * 0.5 + 0.5) * rd.boardH;
    return o;
  };

  rd.projectCell = function (c, r, y, out) {
    return rd.project(R.grid.worldX(c), y || 0, R.grid.worldZ(r), out);
  };

  /* Convert a client-space pointer position to a board cell, or null. */
  rd.cellFromClient = function (clientX, clientY) {
    if (!rd.ready) return null;
    var board = document.getElementById('board');
    var rect = board.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (!raycaster.ray.intersectPlane(boardPlane, hitPoint)) return null;
    var c = R.grid.colFromWorldX(hitPoint.x);
    var r = R.grid.rowFromWorldZ(hitPoint.z);
    if (!R.grid.inBounds(c, r)) return null;
    return { c: c, r: r, i: R.grid.idx(c, r) };
  };


  /* ---------- dynamic layer: lit tiles, beams and pieces ---------- */

  var CELLS = B.COLS * B.ROWS;
  var MAX_PIECES = 48;
  var LIT_Y = 0.035;
  var BEAM_Y = 0.16;
  var PIECE_Y = 0.0;

  var dyn = {};
  var scratchColor = null;
  var hiddenMatrix = null;

  /* Rotation that lays a plane flat and points its length along a direction. */
  function dirAngle(dir) {
    return -Math.atan2(R.grid.DC[dir], -R.grid.DR[dir]);
  }

  function additiveMaterial(map, color) {
    return new THREE.MeshBasicMaterial({
      map: map || null,
      color: color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  function makeInstanced(geo, mat, count, order) {
    var mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.renderOrder = order || 0;
    /* Allocate the colour attribute up front, then draw nothing until filled. */
    for (var i = 0; i < count; i++) {
      mesh.setMatrixAt(i, hiddenMatrix);
      mesh.setColorAt(i, scratchColor.setHex(0xffffff));
    }
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  }

  /* A writer that fills instances in order and hides the leftovers. */
  function Filler(mesh) {
    this.mesh = mesh;
    this.n = 0;
  }

  Filler.prototype.push = function (x, y, z, rotZ, sx, sy, colorHex) {
    var mesh = this.mesh;
    if (this.n >= mesh.instanceMatrix.count) return;
    dummy.position.set(x, y, z);
    dummy.rotation.set(-Math.PI / 2, 0, rotZ);
    dummy.scale.set(sx, sy, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(this.n, dummy.matrix);
    mesh.setColorAt(this.n, scratchColor.setHex(colorHex));
    this.n++;
  };

  Filler.prototype.pushObject = function (obj, colorHex) {
    var mesh = this.mesh;
    if (this.n >= mesh.instanceMatrix.count) return;
    obj.updateMatrix();
    mesh.setMatrixAt(this.n, obj.matrix);
    mesh.setColorAt(this.n, scratchColor.setHex(colorHex));
    this.n++;
  };

  /*
   * Only the instances actually written are drawn. Lowering `count` rather than
   * hiding the leftovers keeps unused instances out of the vertex shader.
   */
  Filler.prototype.finish = function () {
    var mesh = this.mesh;
    mesh.count = this.n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.n = 0;
  };

  rd.buildDynamic = function () {
    scratchColor = new THREE.Color();
    hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

    var quad = new THREE.PlaneGeometry(1, 1);

    dyn.litGlow = makeInstanced(quad, additiveMaterial(rd.tex.tileGlow, 0xffffff), CELLS, 1);
    /* One tile marker, used to point at a suggested first placement. */
    dyn.suggest = makeInstanced(quad, additiveMaterial(rd.tex.tileGlow, 0xffffff), 1, 1);
    dyn.beamGlow = makeInstanced(quad, additiveMaterial(rd.tex.beam, 0xffffff), B.MAX_SEGMENTS, 2);
    dyn.beamCore = makeInstanced(quad, additiveMaterial(rd.tex.beam, 0xffffff), B.MAX_SEGMENTS, 3);
    dyn.bounce = makeInstanced(quad, additiveMaterial(rd.tex.glow, 0xffffff), 32, 4);
    dyn.previewBeam = makeInstanced(quad, additiveMaterial(rd.tex.beam, 0xffffff), 64, 1);

    /* Mirror: a thin bright slab standing on the tile at 45 degrees. */
    dyn.mirrorBody = makeInstanced(
      new THREE.BoxGeometry(0.92, 0.26, 0.09),
      new THREE.MeshLambertMaterial({ color: C.mirror, emissive: 0x24486b, emissiveIntensity: 0.6 }),
      MAX_PIECES
    );
    dyn.mirrorEdge = makeInstanced(
      new THREE.BoxGeometry(0.94, 0.05, 0.13),
      additiveMaterial(null, C.mirrorEdge),
      MAX_PIECES,
      2
    );

    /* Splitter: a translucent violet cube with a bright internal diagonal. */
    dyn.splitterBody = makeInstanced(
      new THREE.BoxGeometry(0.72, 0.42, 0.72),
      new THREE.MeshLambertMaterial({
        color: C.splitter, emissive: 0x3b1d6b, emissiveIntensity: 0.8,
        transparent: true, opacity: 0.62
      }),
      MAX_PIECES
    );
    dyn.splitterPlane = makeInstanced(
      new THREE.BoxGeometry(0.98, 0.30, 0.05),
      additiveMaterial(null, 0xdcc7ff),
      MAX_PIECES,
      2
    );

    /* Reflector: a golden cup that throws the light straight back. */
    dyn.reflectorCup = makeInstanced(
      new THREE.CylinderGeometry(0.38, 0.20, 0.34, 14, 1, true),
      new THREE.MeshLambertMaterial({
        color: C.reflector, emissive: 0x6b4a12, emissiveIntensity: 0.7, side: THREE.DoubleSide
      }),
      MAX_PIECES
    );
    dyn.reflectorDisc = makeInstanced(
      new THREE.CircleGeometry(0.19, 14),
      additiveMaterial(null, 0xffe6a8),
      MAX_PIECES,
      2
    );

    /* Lamp: a lantern with a notch showing which way it points. */
    dyn.lampBody = makeInstanced(
      new THREE.CylinderGeometry(0.22, 0.27, 0.40, 6),
      new THREE.MeshLambertMaterial({ color: C.lamp, emissive: 0xa85f10, emissiveIntensity: 1.0 }),
      MAX_PIECES
    );
    dyn.lampNotch = makeInstanced(
      new THREE.BoxGeometry(0.14, 0.14, 0.30),
      additiveMaterial(null, 0xffe9b0),
      MAX_PIECES,
      2
    );

    dyn.pieceObj = new THREE.Object3D();
    buildEnemies();
    buildHighlights();
    buildParticles();
    dyn.pulse = makeInstanced(new THREE.PlaneGeometry(1, 1),
      additiveMaterial(rd.tex.glow, 0xffffff), 6, 9);
  };

  /*
   * Colour tracks the fraction of the source power that is left, so light
   * that has been through an enemy is visibly amber and then red. Width tracks
   * absolute power, so upgrading the core thickens every beam.
   */
  function beamColor(fraction) {
    if (fraction >= 0.86) return C.beamHot;
    if (fraction >= 0.45) return R.util.mixColor(C.beamMid, C.beamHot, (fraction - 0.45) / 0.41);
    return R.util.mixColor(C.beamLow, C.beamMid, R.util.clamp(fraction / 0.45, 0, 1));
  }

  function beamWidth(power) {
    return 0.09 + 0.27 * R.util.clamp(power / 35, 0, 1);
  }

  /*
   * Only road cells glow. That is the number the player is pushing (LIT n/25),
   * and it keeps light spilling over buildable tiles from washing the board out.
   */
  function drawLitTiles(state) {
    var f = new Filler(dyn.litGlow);
    var lit = state.beam.lit;
    var kinds = state.grid.kind;
    var srcPower = R.beam.corePower(state.coreLevel);
    for (var i = 0; i < CELLS; i++) {
      var p = lit[i];
      if (p <= 0) continue;
      if (kinds[i] !== R.ROAD && kinds[i] !== R.SPAWN) continue;
      var c = i % B.COLS;
      var r = (i - c) / B.COLS;
      var strength = R.util.clamp(p / srcPower, 0.06, 1);
      var hue = R.util.mixColor(C.beamLow, C.litGlow, R.util.clamp(strength * 1.5, 0, 1));
      var col = R.util.mixColor(0x000000, hue, 0.10 + 0.38 * strength);
      f.push(R.grid.worldX(c), LIT_Y, R.grid.worldZ(r), 0, 1.06, 1.06, col);
    }
    f.finish();
  }

  var SWEEP_SPEED = 60;
  var sweepLength = 999;
  var lastRouteVersion = -1;

  /* A re-routed beam travels out from the source instead of appearing at once. */
  function advanceSweep(state, dtReal) {
    if (state.routeVersion !== lastRouteVersion) {
      lastRouteVersion = state.routeVersion;
      sweepLength = 0;
    }
    if (sweepLength < 999) sweepLength += SWEEP_SPEED * dtReal;
    if (sweepLength > 200) sweepLength = 999;
  }

  rd.sweepLength = function () {
    return sweepLength;
  };

  rd.previewCount = function () {
    return dyn.previewBeam ? dyn.previewBeam.__previewCount || 0 : 0;
  };

  rd.resetSweep = function () {
    sweepLength = 999;
    lastRouteVersion = -1;
  };

  function drawBeams(state) {
    var glow = new Filler(dyn.beamGlow);
    var core = new Filler(dyn.beamCore);
    var bounce = new Filler(dyn.bounce);
    var segs = state.beam.segments;
    var n = state.beam.segCount;

    for (var i = 0; i < n; i++) {
      var s = segs[i];
      var len = Math.abs(s.x1 - s.x0) + Math.abs(s.z1 - s.z0);
      if (len <= 0.001) continue;

      /* Trim the far end of the segment while the sweep is still travelling. */
      var visible = len;
      if (sweepLength < 999) {
        var avail = sweepLength - s.dist0;
        if (avail <= 0) continue;
        if (avail < len) visible = avail;
      }
      var fx = s.x1 === s.x0 ? 0 : (s.x1 - s.x0) / len;
      var fz = s.z1 === s.z0 ? 0 : (s.z1 - s.z0) / len;
      var ex = s.x0 + fx * visible;
      var ez = s.z0 + fz * visible;
      var mx = (s.x0 + ex) / 2;
      var mz = (s.z0 + ez) / 2;

      var rot = dirAngle(s.dir);
      var power = s.powerStart;
      var frac = s.sourcePower > 0 ? R.util.clamp(power / s.sourcePower, 0, 1) : 0;
      var col = beamColor(frac);
      var w = beamWidth(power);
      var lift = feel.gutter * (1 + feel.flare);
      if (feel.flare > 0) col = R.util.mixColor(col, 0xffffff, Math.min(1, feel.flare));
      glow.push(mx, BEAM_Y, mz, rot, w * 1.7 * (1 + feel.flare * 0.5), visible + 0.04,
        R.util.mixColor(0x000000, col, (0.09 + 0.21 * frac) * lift));
      core.push(mx, BEAM_Y + 0.005, mz, rot, w * (0.34 + 0.2 * frac) * (1 + feel.flare * 0.4), visible + 0.04,
        R.util.mixColor(0x000000, col, (0.34 + 0.56 * frac) * lift));
      if (s.bendAtStart) {
        bounce.push(s.x0, BEAM_Y + 0.01, s.z0, 0, 0.55, 0.55, R.util.mixColor(0x000000, col, 0.2 + 0.3 * frac));
      }
    }
    glow.finish();
    core.finish();
    bounce.finish();
  }

  /* ---------- ghost beam while dragging ---------- */

  var previewKey = '';
  var previewResult = null;

  /*
   * A pulsing marker over the tile the opening suggests. It is only ever set
   * for a player who has not placed anything yet, and it goes out the moment
   * they do, so it points once and then leaves them alone.
   */
  function drawSuggestion(state) {
    var f = new Filler(dyn.suggest);
    var cell = state.ui.suggest;
    if (cell) {
      var pulse = 0.45 + 0.35 * Math.sin(state.time * 4.5);
      f.push(R.grid.worldX(cell.c), LIT_Y + 0.02, R.grid.worldZ(cell.r), 0, 1.02, 1.02,
        R.util.mixColor(0x000000, C.valid, pulse));
    }
    f.finish();
  }

  function drawPreview(state) {
    var d = state.ui.drag;
    var f = new Filler(dyn.previewBeam);
    if (!d || !d.dragging || !d.cell || !d.valid) {
      previewKey = '';
      dyn.previewBeam.__previewCount = 0;
      f.finish();
      return;
    }

    var orient = 0;
    var removeIndex = null;
    if (d.kind === 'piece') {
      var p = R.pieces.byId(state, d.pieceId);
      if (p) {
        orient = p.type === 'lamp' ? p.dir : p.orient;
        removeIndex = R.grid.idx(d.fromC, d.fromR);
      }
    } else {
      orient = R.beam.bestOrientation(state, d.type, d.cell.c, d.cell.r);
    }

    var key = d.type + '|' + d.cell.i + '|' + orient + '|' + state.coreLevel + '|' + state.pieces.size;
    if (key !== previewKey) {
      previewKey = key;
      previewResult = R.beam.preview(state, d.type, d.cell.c, d.cell.r, orient, removeIndex);
    }
    if (!previewResult) {
      dyn.previewBeam.__previewCount = 0;
      f.finish();
      return;
    }
    for (var i = 0; i < previewResult.segCount; i++) {
      var s = previewResult.segments[i];
      var len = Math.abs(s.x1 - s.x0) + Math.abs(s.z1 - s.z0);
      if (len <= 0.001) continue;
      f.push((s.x0 + s.x1) / 2, BEAM_Y + 0.02, (s.z0 + s.z1) / 2, dirAngle(s.dir),
        0.30, len, 0x1d5f77);
    }
    dyn.previewBeam.__previewCount = f.n;
    f.finish();
  }

  var POP_TIME = 0.22;

  function pieceScale(state, p) {
    var age = state.time - p.placedAt;
    var s = 1;
    if (age >= 0 && age < POP_TIME) {
      var t = age / POP_TIME;
      s = 0.2 + 1.0 * R.util.easeOutBack(t);
    }
    if (p.inactiveUntil > state.time) s *= 0.72;
    return s;
  }

  function drawPieces(state) {
    var fills = {
      mirrorBody: new Filler(dyn.mirrorBody),
      mirrorEdge: new Filler(dyn.mirrorEdge),
      splitterBody: new Filler(dyn.splitterBody),
      splitterPlane: new Filler(dyn.splitterPlane),
      reflectorCup: new Filler(dyn.reflectorCup),
      reflectorDisc: new Filler(dyn.reflectorDisc),
      lampBody: new Filler(dyn.lampBody),
      lampNotch: new Filler(dyn.lampNotch)
    };
    var o = dyn.pieceObj;
    var it = state.pieces.values();
    var entry = it.next();
    while (!entry.done) {
      var p = entry.value;
      var x = R.grid.worldX(p.c);
      var z = R.grid.worldZ(p.r);
      var sc = pieceScale(state, p);
      var dragging = state.ui.drag && state.ui.drag.pieceId === p.id;
      var dim = (p.inactiveUntil > state.time || dragging) ? 0.45 : 1;
      var diag = p.orient === 0 ? Math.PI / 4 : -Math.PI / 4;
      var flip = flipTimes[p.id];
      if (flip) {
        var ft = (realClock - flip.at) / 0.12;
        if (ft >= 1) delete flipTimes[p.id];
        else diag += (1 - R.util.easeOutCubic(ft)) * flip.dir * Math.PI / 2;
      }

      if (p.type === 'mirror') {
        o.position.set(x, PIECE_Y + 0.13 * sc, z);
        o.rotation.set(0, diag, 0);
        o.scale.set(sc, sc, sc);
        fills.mirrorBody.pushObject(o, R.util.mixColor(0x101820, 0xffffff, dim));
        o.position.y = PIECE_Y + 0.26 * sc;
        fills.mirrorEdge.pushObject(o, R.util.mixColor(0x000000, C.mirrorEdge, dim));
      } else if (p.type === 'splitter') {
        o.position.set(x, PIECE_Y + 0.21 * sc, z);
        o.rotation.set(0, 0, 0);
        o.scale.set(sc, sc, sc);
        fills.splitterBody.pushObject(o, R.util.mixColor(0x101820, 0xffffff, dim));
        o.rotation.set(0, diag, 0);
        fills.splitterPlane.pushObject(o, R.util.mixColor(0x000000, 0xdcc7ff, dim));
      } else if (p.type === 'reflector') {
        o.position.set(x, PIECE_Y + 0.17 * sc, z);
        o.rotation.set(0, 0, 0);
        o.scale.set(sc, sc, sc);
        fills.reflectorCup.pushObject(o, R.util.mixColor(0x101820, 0xffffff, dim));
        o.position.y = PIECE_Y + 0.35 * sc;
        o.rotation.set(-Math.PI / 2, 0, 0);
        fills.reflectorDisc.pushObject(o, R.util.mixColor(0x000000, 0xffe6a8, dim));
      } else if (p.type === 'lamp') {
        o.position.set(x, PIECE_Y + 0.20 * sc, z);
        o.rotation.set(0, 0, 0);
        o.scale.set(sc, sc, sc);
        fills.lampBody.pushObject(o, R.util.mixColor(0x101820, 0xffffff, dim));
        o.position.set(x + R.grid.DC[p.dir] * 0.26 * sc, PIECE_Y + 0.22 * sc, z + R.grid.DR[p.dir] * 0.26 * sc);
        fills.lampNotch.pushObject(o, R.util.mixColor(0x000000, 0xffe9b0, dim));
      }
      entry = it.next();
    }
    for (var gi = 0; gi < ghostPieces.length; gi++) {
      var gp = ghostPieces[gi];
      var gt = (realClock - gp.at) / 0.24;
      var gs = Math.max(0.01, 1 - gt) * 1.1;
      var gdiag = gp.orient === 0 ? Math.PI / 4 : -Math.PI / 4;
      var gx = R.grid.worldX(gp.c);
      var gz = R.grid.worldZ(gp.r);
      var gcol = R.util.mixColor(0x000000, 0xffffff, Math.max(0, 1 - gt));
      o.position.set(gx, PIECE_Y + 0.13 * gs, gz);
      o.rotation.set(0, gp.type === 'lamp' ? 0 : gdiag, 0);
      o.scale.set(gs, gs, gs);
      var target = gp.type === 'mirror' ? fills.mirrorBody
        : gp.type === 'splitter' ? fills.splitterBody
          : gp.type === 'reflector' ? fills.reflectorCup : fills.lampBody;
      target.pushObject(o, gcol);
    }

    Object.keys(fills).forEach(function (k) { fills[k].finish(); });
  }


  /* ---------- enemies ---------- */

  var MAX_ENEMIES = 72;
  var MAX_BARS = 72;
  var UP_VEC = null;
  var travelVec = null;
  var billboardX = 0;

  /* Geometry per enemy type. Types added later fall back to the mote shape. */
  var ENEMY_SHAPE = {};

  function buildEnemies() {
    UP_VEC = new THREE.Vector3(0, 1, 0);
    travelVec = new THREE.Vector3(0, 0, 1);
    billboardX = V.TILT_DEG * Math.PI / 180 - Math.PI / 2;

    function body(geo, color, emissive, count) {
      return makeInstanced(geo, new THREE.MeshLambertMaterial({
        color: color, emissive: emissive, emissiveIntensity: 0.6
      }), count || MAX_ENEMIES);
    }

    dyn.enemyMote = body(new THREE.SphereGeometry(1, 10, 8), C.enemy.mote, 0x3a0d5c);
    dyn.enemyRunner = body(new THREE.ConeGeometry(0.85, 2.1, 6), C.enemy.runner, 0x0c4a48);
    dyn.enemySwarm = body(new THREE.TetrahedronGeometry(1.35), C.enemy.swarmling, 0x4a0e33);
    dyn.enemyBulwark = body(new THREE.BoxGeometry(1.5, 1.45, 1.5), C.enemy.bulwark, 0x1d1838);
    dyn.enemyUmbra = body(new THREE.OctahedronGeometry(1.25, 0), C.enemy.umbra, 0x3d0f6b, 8);

    ENEMY_SHAPE.mote = 'enemyMote';
    ENEMY_SHAPE.runner = 'enemyRunner';
    ENEMY_SHAPE.swarmling = 'enemySwarm';
    ENEMY_SHAPE.bulwark = 'enemyBulwark';
    ENEMY_SHAPE.bruteking = 'enemyBulwark';
    ENEMY_SHAPE.umbra = 'enemyUmbra';

    /* Brutes wear a visible shell; it is what soaks up the light. */
    dyn.enemyShell = makeInstanced(
      new THREE.BoxGeometry(1.8, 1.72, 1.8),
      additiveMaterial(null, 0x9a86ff),
      MAX_ENEMIES,
      3
    );

    var quad = new THREE.PlaneGeometry(1, 1);
    dyn.enemyGlint = makeInstanced(quad, additiveMaterial(rd.tex.glow, 0xffffff), MAX_ENEMIES, 3);
    dyn.bossRing = makeInstanced(quad, additiveMaterial(rd.tex.ring, 0xffffff), 8, 4);
    /* White base materials so the per-instance colour is the only tint. */
    dyn.barBack = makeInstanced(quad, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_BARS, 5);
    dyn.barFill = makeInstanced(quad, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_BARS, 6);
    dyn.enemyObj = new THREE.Object3D();
    dyn.shieldObj = new THREE.Object3D();
  }

  Filler.prototype.pushBillboard = function (x, y, z, sx, sy, colorHex) {
    var mesh = this.mesh;
    if (this.n >= mesh.instanceMatrix.count) return;
    dummy.position.set(x, y, z);
    dummy.rotation.set(billboardX, 0, 0);
    dummy.scale.set(sx, sy, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(this.n, dummy.matrix);
    mesh.setColorAt(this.n, scratchColor.setHex(colorHex));
    this.n++;
  };

  function shapeKey(type) {
    return ENEMY_SHAPE[type] || 'enemyMote';
  }

  var SPIN = { mote: 0.8, runner: 0, swarmling: 2.4, bulwark: 0.25, bruteking: 0.3, umbra: 0.5 };

  function drawEnemies(state) {
    var fills = {};
    var k;
    for (k in ENEMY_SHAPE) {
      if (!fills[ENEMY_SHAPE[k]]) fills[ENEMY_SHAPE[k]] = new Filler(dyn[ENEMY_SHAPE[k]]);
    }
    var shell = new Filler(dyn.enemyShell);
    var glint = new Filler(dyn.enemyGlint);
    var ring = new Filler(dyn.bossRing);
    var back = new Filler(dyn.barBack);
    var fill = new Filler(dyn.barFill);
    var o = dyn.enemyObj;
    var shieldPose = dyn.shieldObj;
    var list = state.enemies;

    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.t < -1) continue;
      var fade = R.util.clamp(e.t + 1, 0, 1);
      /* Enemies grow out of the portal instead of sliding in half-clipped. */
      var rad = e.radius * (0.25 + 0.75 * fade);
      var y = rad + 0.06;
      var hit = state.time - e.hitAt;
      var flash = hit >= 0 && hit < 0.09 ? 1 : 0;
      /*
       * A hit that the shield turned away and a hit that landed have to look
       * different. A deflection reads as a hard pale-blue flare on the face;
       * a landed hit keeps the white burn.
       */
      var deflected = e.shield > 0 && state.time - e.shieldedAt < 0.09;
      var tint = flash
        ? (deflected ? 0x9fd8ff : 0xffffff)
        : R.util.mixColor(0x000000, 0xffffff, 0.35 + 0.65 * fade);

      o.position.set(e.x, y, e.z);
      o.scale.set(rad, rad, rad);
      if (e.type === 'runner') {
        travelVec.set(e.dx, 0, e.dz);
        if (travelVec.lengthSq() < 1e-6) travelVec.set(0, 0, 1);
        travelVec.normalize();
        o.quaternion.setFromUnitVectors(UP_VEC, travelVec);
      } else {
        o.quaternion.set(0, 0, 0, 1);
        o.rotation.y = state.time * (SPIN[e.type] || 0) + e.id;
      }
      fills[shapeKey(e.type)].pushObject(o, tint);

      /*
       * The shell is the shield made visible. It sits on the face the body is
       * walking towards, brightens when light is turned away by it, and is
       * dropped entirely once a boss enters its exposed phase, so the change
       * is legible without reading a number.
       */
      if (e.shield > 0) {
        var shieldCol = deflected ? 0xbfe4ff : (flash ? 0xffffff : 0x8a72ff);
        var shieldMix = 0.09 + 0.07 * fade + (deflected ? 0.4 : 0);
        var face = R.grid.DC[e.face] !== undefined ? e.face : R.S;
        shieldPose.position.set(
          e.x + R.grid.DC[face] * rad * 0.62,
          y,
          e.z + R.grid.DR[face] * rad * 0.62
        );
        shieldPose.scale.set(rad, rad, rad);
        shieldPose.quaternion.set(0, 0, 0, 1);
        shell.pushObject(shieldPose, R.util.mixColor(0x000000, shieldCol, shieldMix));
      }

      if (e.boss) {
        ring.pushBillboard(e.x, y, e.z, rad * 4.4, rad * 4.4,
          R.util.mixColor(0x000000, e.type === 'umbra' ? 0xb14dff : 0xffc247, 0.55));
      }

      var glintCol = C.enemyGlint[e.type] || C.enemyGlint.mote;
      glint.pushBillboard(e.x, y, e.z, rad * 2.3, rad * 2.3,
        R.util.mixColor(0x000000, flash ? 0xffffff : glintCol, (flash ? 0.85 : 0.4) * fade));

      if ((e.hp < e.maxHp || e.boss) && e.t >= 0) {
        var w = Math.max(0.34, rad * 2.1);
        var by = y + rad + 0.22;
        var frac = R.util.clamp(e.hp / e.maxHp, 0, 1);
        back.pushBillboard(e.x, by, e.z, w + 0.07, 0.16, 0x141a2c);
        fill.pushBillboard(e.x - w * (1 - frac) / 2, by, e.z, w * frac, 0.09,
          frac > 0.5 ? 0x7ce0a8 : (frac > 0.25 ? 0xffc247 : 0xff5d6c));
      }
    }

    for (k in fills) fills[k].finish();
    shell.finish();
    glint.finish();
    ring.finish();
    back.finish();
    fill.finish();
  }


  /* ---------- particles, shake and run transitions ---------- */

  var MAX_PARTICLES = 400;
  var particles = [];
  var particleCount = 0;

  var feel = {
    shakeAmp: 0,
    shakeTime: 0,
    shakeTotal: 0,
    flare: 0,
    gutter: 1,
    pulseAt: -1,
    portalFlare: 0
  };
  rd.feel = feel;

  function shardTexture() {
    var s = 64;
    var cv = makeCanvas(s);
    var g = cv.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,1)';
    g.beginPath();
    g.moveTo(32, 4);
    g.lineTo(52, 32);
    g.lineTo(32, 60);
    g.lineTo(12, 32);
    g.closePath();
    g.fill();
    return new THREE.CanvasTexture(cv);
  }

  function buildParticles() {
    for (var i = 0; i < MAX_PARTICLES; i++) {
      particles.push({
        active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        life: 0, ttl: 1, size: 0.1, color: 0xffffff, spin: 0, rot: 0, drag: 1
      });
    }
    dyn.particles = makeInstanced(
      new THREE.PlaneGeometry(1, 1),
      additiveMaterial(rd.tex.shard, 0xffffff),
      MAX_PARTICLES,
      8
    );
  }

  function spawnParticle() {
    if (particleCount >= MAX_PARTICLES) return null;
    for (var i = 0; i < MAX_PARTICLES; i++) {
      if (!particles[i].active) {
        particles[i].active = true;
        particleCount++;
        return particles[i];
      }
    }
    return null;
  }

  /* A burst of shards, used for deaths and celebrations. */
  rd.burst = function (x, z, color, count, opts) {
    var o = opts || {};
    var speed = o.speed || 2.2;
    var size = o.size || 0.16;
    var ttl = o.ttl || 0.55;
    for (var i = 0; i < count; i++) {
      var p = spawnParticle();
      if (!p) return;
      var a = (i / count) * Math.PI * 2 + Math.random() * 0.7;
      var sp = speed * (0.45 + Math.random() * 0.75);
      p.x = x;
      p.y = (o.y === undefined ? 0.3 : o.y);
      p.z = z;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = (o.up || 1.6) * (0.3 + Math.random());
      p.life = 0;
      p.ttl = ttl * (0.7 + Math.random() * 0.6);
      p.size = size * (0.6 + Math.random() * 0.8);
      p.color = color;
      p.spin = (Math.random() - 0.5) * 12;
      p.rot = Math.random() * 6.28;
      p.drag = o.drag || 2.2;
    }
  };

  /* A couple of sparks where the light is biting into something. */
  rd.spark = function (x, z, color) {
    var p = spawnParticle();
    if (!p) return;
    p.x = x + (Math.random() - 0.5) * 0.3;
    p.y = 0.22 + Math.random() * 0.2;
    p.z = z + (Math.random() - 0.5) * 0.3;
    p.vx = (Math.random() - 0.5) * 1.4;
    p.vz = (Math.random() - 0.5) * 1.4;
    p.vy = 1.1 + Math.random();
    p.life = 0;
    p.ttl = 0.26;
    p.size = 0.075;
    p.color = color;
    p.spin = 8;
    p.rot = Math.random() * 6.28;
    p.drag = 3.5;
  };

  rd.clearParticles = function () {
    for (var i = 0; i < particles.length; i++) particles[i].active = false;
    particleCount = 0;
    feel.shakeAmp = 0;
    feel.shakeTime = 0;
    feel.flare = 0;
    feel.gutter = 1;
    feel.pulseAt = -1;
    feel.portalFlare = 0;
  };

  function stepParticles(dt) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.ttl) {
        p.active = false;
        particleCount--;
        continue;
      }
      var k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vz *= k;
      p.vy -= 6.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) {
        p.y = 0.05;
        p.vy = 0;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      p.rot += p.spin * dt;
    }
  }

  function drawParticles() {
    var f = new Filler(dyn.particles);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (!p.active) continue;
      var t = p.life / p.ttl;
      var fade = 1 - t * t;
      var s = p.size * (1 - 0.45 * t);
      f.pushBillboardRot(p.x, p.y, p.z, s, s, p.rot, R.util.mixColor(0x000000, p.color, fade));
    }
    f.finish();
  }

  Filler.prototype.pushBillboardRot = function (x, y, z, sx, sy, rotZ, colorHex) {
    var mesh = this.mesh;
    if (this.n >= mesh.instanceMatrix.count) return;
    dummy.position.set(x, y, z);
    dummy.rotation.set(billboardX, 0, rotZ);
    dummy.scale.set(sx, sy, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(this.n, dummy.matrix);
    mesh.setColorAt(this.n, scratchColor.setHex(colorHex));
    this.n++;
  };

  /* ---------- screen shake ---------- */

  rd.shake = function (amount, seconds) {
    /* Never shake the board out from under a finger that is placing a piece. */
    if (R.state && R.state.ui.drag) return;
    if (amount <= feel.shakeAmp && feel.shakeTime > 0) return;
    feel.shakeAmp = amount;
    feel.shakeTime = seconds;
    feel.shakeTotal = seconds;
  };

  var shakeSeed = 1;

  function applyShake(dtReal) {
    var boardEl = document.getElementById('board');
    if (!boardEl) return;
    if (feel.shakeTime <= 0) {
      if (boardEl.style.transform !== '') boardEl.style.transform = '';
      return;
    }
    feel.shakeTime -= dtReal;
    var k = Math.max(0, feel.shakeTime / feel.shakeTotal);
    var amp = feel.shakeAmp * k * k;
    shakeSeed = (shakeSeed * 1103515245 + 12345) & 0x7fffffff;
    var a = (shakeSeed / 0x7fffffff) * 6.283;
    boardEl.style.transform = 'translate(' + (Math.cos(a) * amp).toFixed(1) + 'px,' +
      (Math.sin(a) * amp).toFixed(1) + 'px)';
  }

  /* ---------- the pulse that runs along the beam after a core upgrade ---------- */

  var PULSE_SPEED = 26;

  function drawPulse(state, now) {
    if (feel.pulseAt < 0) return;
    var dist = (now - feel.pulseAt) * PULSE_SPEED;
    var segs = state.beam.segments;
    var f = new Filler(dyn.pulse);
    var found = false;
    for (var i = 0; i < state.beam.segCount; i++) {
      var s = segs[i];
      var len = Math.abs(s.x1 - s.x0) + Math.abs(s.z1 - s.z0);
      var d = dist - s.dist0;
      if (d < 0 || d > len) continue;
      found = true;
      var fx = len === 0 ? 0 : (s.x1 - s.x0) / len;
      var fz = len === 0 ? 0 : (s.z1 - s.z0) / len;
      f.push(s.x0 + fx * d, BEAM_Y + 0.02, s.z0 + fz * d, 0, 1.1, 1.1, 0x8a6a2a);
    }
    f.finish();
    if (!found && dist > 4) feel.pulseAt = -1;
  }


  /* ---------- reacting to simulation events ---------- */

  var realClock = 0;
  var flipTimes = {};
  var ghostPieces = [];

  rd.clock = function () {
    return realClock;
  };

  rd.particleCount = function () {
    return particleCount;
  };

  rd.ghostCount = function () {
    return ghostPieces.length;
  };

  rd.handleEvents = function (state) {
    for (var i = 0; i < state.events.length; i++) {
      var e = state.events[i];
      switch (e.type) {
        case 'kill':
          var col = C.enemyGlint[e.enemy] || 0xffffff;
          if (e.boss) {
            rd.burst(e.x, e.z, col, 18, { speed: 3.6, size: 0.24, ttl: 0.9, up: 2.6 });
            rd.burst(e.x, e.z, 0xffffff, 10, { speed: 2.2, size: 0.16, ttl: 0.7 });
            rd.shake(9, 0.32);
            rd.hitStop = 0.06;
          } else if (e.enemy === 'bulwark') {
            rd.burst(e.x, e.z, col, 10, { speed: 2.6, size: 0.19, ttl: 0.65 });
            rd.shake(4, 0.13);
          } else {
            rd.burst(e.x, e.z, col, e.enemy === 'swarmling' ? 4 : 7, { speed: 2.1, size: 0.13 });
          }
          break;
        case 'leak':
          rd.shake(e.leak >= 3 ? 7 : 4, 0.2);
          rd.burst(e.x, e.z, 0xff5d6c, 8, { speed: 1.7, size: 0.15, ttl: 0.5 });
          break;
        case 'upgrade':
          feel.pulseAt = realClock;
          break;
        case 'wavestart':
          feel.portalFlare = 1;
          break;
        case 'flip':
          flipTimes[e.id] = { at: realClock, dir: e.toOrient ? 1 : -1 };
          break;
        case 'sell':
        case 'undo':
          if (e.record) {
            ghostPieces.push({
              type: e.record.type, c: e.record.c, r: e.record.r,
              orient: e.record.orient, dir: e.record.dir, at: realClock
            });
          }
          break;
        case 'win':
          feel.flare = 1.3;
          for (var k = 0; k < 8; k++) {
            rd.burst(
              (Math.random() - 0.5) * 7,
              (Math.random() - 0.5) * 10,
              [0xffc247, 0x59e8ff, 0xffffff, 0x7ce0a8][k % 4],
              12, { speed: 3, size: 0.2, ttl: 1.4, up: 3 }
            );
          }
          break;
        case 'lose':
          rd.shake(10, 0.5);
          break;
        default:
          break;
      }
    }
  };

  function stepFeel(state, dt) {
    if (state.phase === 'lost') feel.gutter = Math.max(0, feel.gutter - dt * 1.1);
    else feel.gutter = Math.min(1, feel.gutter + dt * 4);
    feel.flare = Math.max(0, feel.flare - dt * 0.9);
    for (var i = ghostPieces.length - 1; i >= 0; i--) {
      if (realClock - ghostPieces[i].at > 0.24) ghostPieces.splice(i, 1);
    }
  }

  /* Sparks where the light is biting, roughly ten a second per enemy. */
  function sparkEnemies(state, dt) {
    if (dt <= 0) return;
    var chance = dt / 0.1;
    var list = state.enemies;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (state.time - e.hitAt > 0.06 || e.t < 0) continue;
      if (Math.random() < chance) {
        rd.spark(e.x, e.z, C.enemyGlint[e.type] || 0xffffff);
      }
    }
  }

  /* ---------- selection and drag highlights ---------- */

  function frameTexture() {
    var s = 64;
    var cv = makeCanvas(s);
    var g = cv.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.strokeRect(5, 5, s - 10, s - 10);
    return new THREE.CanvasTexture(cv);
  }

  function buildHighlights() {
    var quad = new THREE.PlaneGeometry(1, 1);
    dyn.hoverTile = new THREE.Mesh(quad, additiveMaterial(rd.tex.frame, 0xffffff));
    dyn.hoverTile.rotation.x = -Math.PI / 2;
    dyn.hoverTile.scale.set(0.98, 0.98, 1);
    dyn.hoverTile.position.y = 0.06;
    dyn.hoverTile.renderOrder = 7;
    dyn.hoverTile.visible = false;
    scene.add(dyn.hoverTile);

    dyn.selectRing = new THREE.Mesh(quad, additiveMaterial(rd.tex.frame, C.accent || 0x59e8ff));
    dyn.selectRing.rotation.x = -Math.PI / 2;
    dyn.selectRing.scale.set(1.0, 1.0, 1);
    dyn.selectRing.position.y = 0.055;
    dyn.selectRing.renderOrder = 7;
    dyn.selectRing.visible = false;
    scene.add(dyn.selectRing);
  }

  function drawHighlights(state) {
    var d = state.ui.drag;
    if (d && d.dragging && d.cell) {
      dyn.hoverTile.visible = true;
      dyn.hoverTile.position.x = R.grid.worldX(d.cell.c);
      dyn.hoverTile.position.z = R.grid.worldZ(d.cell.r);
      dyn.hoverTile.material.color.setHex(d.valid ? C.valid : C.invalid);
    } else {
      dyn.hoverTile.visible = false;
    }

    var p = R.pieces.selected(state);
    if (p) {
      var pulseScale = 1.0 + 0.05 * Math.sin(state.time * 7);
      dyn.selectRing.visible = true;
      dyn.selectRing.position.x = R.grid.worldX(p.c);
      dyn.selectRing.position.z = R.grid.worldZ(p.r);
      dyn.selectRing.scale.set(pulseScale, pulseScale, 1);
      dyn.selectRing.material.color.setHex(state.ui.moveMode ? C.valid : 0x59e8ff);
    } else {
      dyn.selectRing.visible = false;
    }
  }

  rd.drawDynamic = function (state, dtReal) {
    var dt = dtReal || 0;
    realClock += dt;
    stepFeel(state, dt);
    advanceSweep(state, dt);
    sparkEnemies(state, dt);
    stepParticles(dt);
    drawLitTiles(state);
    drawBeams(state);
    drawSuggestion(state);
    drawPreview(state);
    drawPieces(state);
    drawEnemies(state);
    drawParticles();
    drawPulse(state, realClock);
    drawHighlights(state);
    applyShake(dt);
  };

  /* ---------- frame ---------- */

  rd.draw = function (state, dtReal) {
    if (!rd.ready) return;
    var t = state.time;

    if (rd.coreCrystal) {
      var lvl = state.coreLevel;
      var pulse = 0.85 + 0.15 * Math.sin(t * 2.4);
      rd.coreCrystal.rotation.y += dtReal * 0.6;
      rd.coreCrystal.material.emissiveIntensity = pulse * (0.7 + 0.16 * lvl);
      var s = 1 + 0.05 * lvl;
      rd.coreCrystal.scale.set(s, s, s);
      rd.coreHaze.material.opacity = 0.32 + 0.05 * lvl + 0.06 * Math.sin(t * 2.4);
    }
    if (rd.portalRings) {
      if (feel.portalFlare > 0) feel.portalFlare = Math.max(0, feel.portalFlare - dtReal * 1.6);
      for (var pr = 0; pr < rd.portalRings.length; pr++) {
        var pring = rd.portalRings[pr];
        /* A road that has not opened yet turns slowly and stays dim. */
        var open = pr < state.routesOpen;
        pring.rotation.z -= dtReal * (open ? 0.5 : 0.12);
        var ps = open ? 1 + feel.portalFlare * 0.8 : 0.7;
        pring.scale.set(ps, ps, 1);
        pring.material.opacity = open ? 1 : 0.28;
        pring.material.color.setHex(open
          ? R.util.mixColor(0x9b4dff, 0xffffff, feel.portalFlare)
          : 0x4a3070);
      }
    }

    rd.drawDynamic(state, dtReal);

    renderer.render(scene, camera);
  };

  /* Draw one frame without touching game state; used by performance probes. */
  rd.renderOnce = function () {
    if (rd.ready) renderer.render(scene, camera);
  };

  rd.info = function () {
    if (!renderer) return null;
    return {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      programs: renderer.info.programs ? renderer.info.programs.length : 0,
      objects: scene ? scene.children.length : 0
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
