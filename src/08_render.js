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

    /* Direction chevrons on the road, pointing the way the enemies walk. */
    var path = state.path;
    var chevGeo = new THREE.PlaneGeometry(0.62, 0.62);
    var chevMat = new THREE.MeshBasicMaterial({
      map: rd.tex.chevron,
      transparent: true,
      opacity: 0.36,
      color: C.chevron,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var chevrons = new THREE.InstancedMesh(chevGeo, chevMat, path.length - 1);
    for (i = 0; i < path.length - 1; i++) {
      var a = path[i];
      var b2 = path[i + 1];
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

    /* Spawn portal. */
    var portal = new THREE.Group();
    portal.position.set(R.grid.worldX(R.MAP.spawn[0]), 0.015, R.grid.worldZ(R.MAP.spawn[1]));
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
    rd.portalRing = ring;

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

    buildLights();
    buildBoard(state);
    if (rd.buildDynamic) rd.buildDynamic(state);

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
    if (rd.portalRing) {
      rd.portalRing.rotation.z -= dtReal * 0.5;
    }

    if (rd.drawDynamic) rd.drawDynamic(state, dtReal);

    renderer.render(scene, camera);
  };

  rd.info = function () {
    if (!renderer) return null;
    return {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      programs: renderer.info.programs ? renderer.info.programs.length : 0
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
