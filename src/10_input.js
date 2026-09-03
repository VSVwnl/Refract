/*
 * Input. Pointer Events only, one active pointer at a time. A press becomes a
 * tap (place, select, or a move target) or, once it travels far enough, a drag
 * that carries a piece to another tile.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});

  var input = {};
  R.input = input;

  var DRAG_THRESHOLD = 10;

  var press = null;

  function cellAt(clientX, clientY) {
    return R.render.cellFromClient(clientX, clientY);
  }

  function boardAcceptsInput(s) {
    return s.phase === 'building' || s.phase === 'wave';
  }

  function dragTargetValid(s, drag, cell) {
    if (!cell || !drag) return false;
    if (drag.kind === 'piece') {
      if (cell.i === R.grid.idx(drag.fromC, drag.fromR)) return true;
      return R.grid.isBuildable(s, cell.c, cell.r);
    }
    return R.pieces.placementProblem(s, drag.type, cell.c, cell.r) === null;
  }

  function updateDrag(s, clientX, clientY) {
    var d = s.ui.drag;
    if (!d) return;
    d.x = clientX;
    d.y = clientY;
    d.cell = cellAt(clientX, clientY);
    d.valid = dragTargetValid(s, d, d.cell);
  }

  function startDrag(s) {
    press.dragging = true;
    s.ui.drag = {
      kind: press.kind,
      type: press.type,
      pieceId: press.pieceId,
      fromC: press.fromC,
      fromR: press.fromR,
      x: press.startX,
      y: press.startY,
      cell: null,
      valid: false,
      dragging: true
    };
    R.pieces.deselect(s);
  }

  function endDrag(s, commit) {
    var d = s.ui.drag;
    s.ui.drag = null;
    if (!d || !commit) return;
    if (!d.cell || !d.valid) return;
    if (d.kind === 'piece') {
      R.pieces.move(s, d.fromC, d.fromR, d.cell.c, d.cell.r);
    } else {
      R.pieces.place(s, d.type, d.cell.c, d.cell.r);
    }
  }

  /* ---------- taps ---------- */

  function handleTap(s, cell) {
    var piece = R.pieces.at(s, cell.c, cell.r);
    var selected = R.pieces.selected(s);

    if (s.ui.moveMode && selected) {
      if (piece && piece.id === selected.id) {
        s.ui.moveMode = false;
        return;
      }
      R.pieces.move(s, selected.c, selected.r, cell.c, cell.r);
      return;
    }

    if (piece) {
      if (selected && selected.id === piece.id) R.pieces.deselect(s);
      else R.pieces.select(s, piece);
      return;
    }

    if (selected) {
      R.pieces.deselect(s);
      return;
    }

    R.pieces.place(s, s.ui.selectedType, cell.c, cell.r);
  }

  /* ---------- pointer handlers ---------- */

  function onBoardPointerDown(ev) {
    var s = R.state;
    if (!s || press) return;
    if (!boardAcceptsInput(s)) return;
    /* Widgets drawn over the board (action bar, undo chip) handle themselves. */
    if (ev.target && ev.target.id !== 'gl') return;
    var cell = cellAt(ev.clientX, ev.clientY);
    if (!cell) return;
    ev.preventDefault();

    var piece = R.pieces.at(s, cell.c, cell.r);
    press = {
      id: ev.pointerId,
      kind: piece ? 'piece' : 'tap',
      type: piece ? piece.type : s.ui.selectedType,
      pieceId: piece ? piece.id : null,
      fromC: cell.c,
      fromR: cell.r,
      startX: ev.clientX,
      startY: ev.clientY,
      cell: cell,
      dragging: false
    };
  }

  input.beginPaletteDrag = function (type, ev) {
    var s = R.state;
    if (!s || press) return;
    if (!boardAcceptsInput(s)) return;
    if (!s.unlocked[type]) return;
    press = {
      id: ev.pointerId,
      kind: 'palette',
      type: type,
      pieceId: null,
      fromC: -1,
      fromR: -1,
      startX: ev.clientX,
      startY: ev.clientY,
      cell: null,
      dragging: false
    };
  };

  function onPointerMove(ev) {
    var s = R.state;
    if (!s || !press || ev.pointerId !== press.id) return;
    var dx = ev.clientX - press.startX;
    var dy = ev.clientY - press.startY;
    if (!press.dragging) {
      if (dx * dx + dy * dy <= DRAG_THRESHOLD * DRAG_THRESHOLD) return;
      if (press.kind === 'tap') {
        /* A drag that started on an empty tile is not a gesture we use. */
        press = null;
        return;
      }
      startDrag(s);
    }
    updateDrag(s, ev.clientX, ev.clientY);
  }

  function onPointerUp(ev) {
    var s = R.state;
    if (!press || ev.pointerId !== press.id) return;
    var p = press;
    press = null;
    if (!s || !boardAcceptsInput(s)) {
      s.ui.drag = null;
      return;
    }

    if (p.dragging) {
      updateDrag(s, ev.clientX, ev.clientY);
      endDrag(s, true);
      return;
    }

    if (p.kind === 'palette') return;

    var cell = cellAt(ev.clientX, ev.clientY);
    if (!cell || cell.i !== R.grid.idx(p.fromC, p.fromR)) return;
    handleTap(s, cell);
  }

  function onPointerCancel(ev) {
    var s = R.state;
    if (!press || ev.pointerId !== press.id) return;
    press = null;
    if (s) endDrag(s, false);
  }

  /* ---------- keyboard (development convenience) ---------- */

  function onKeyDown(ev) {
    var s = R.state;
    if (!s || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var k = ev.key;
    if (k >= '1' && k <= '4') {
      s.ui.selectedType = R.PIECE_TYPES[Number(k) - 1];
    } else if (k === 'f' || k === 'F') {
      var p = R.pieces.selected(s);
      if (p) R.pieces.flip(s, p.c, p.r);
    } else if (k === ' ') {
      if (s.phase === 'building') R.callWaveEarly(s);
      ev.preventDefault();
    } else if (k === 'p' || k === 'P') {
      if (s.phase === 'paused') R.resume();
      else R.pause();
    }
  }

  input.init = function () {
    var board = document.getElementById('board');
    board.addEventListener('pointerdown', onBoardPointerDown);
    global.addEventListener('pointermove', onPointerMove, { passive: true });
    global.addEventListener('pointerup', onPointerUp);
    global.addEventListener('pointercancel', onPointerCancel);
    global.addEventListener('blur', function () { input.cancel(); });
    global.addEventListener('keydown', onKeyDown);

    /* Stop the browser turning taps into zoom, scroll or text selection. */
    document.addEventListener('gesturestart', function (ev) { ev.preventDefault(); });
    document.addEventListener('dblclick', function (ev) { ev.preventDefault(); });
    document.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    document.addEventListener('touchmove', function (ev) {
      if (ev.cancelable) ev.preventDefault();
    }, { passive: false });
  };

  input.cancel = function () {
    press = null;
    if (R.state) R.state.ui.drag = null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
