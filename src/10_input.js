/*
 * Input. Pointer Events only, one active pointer at a time. A press on the
 * board becomes a tap (place or select) or, once it moves far enough, a drag.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});

  var input = {};
  R.input = input;

  var DRAG_THRESHOLD = 10;

  var active = null;

  function boardCell(ev) {
    return R.render.cellFromClient(ev.clientX, ev.clientY);
  }

  function boardAcceptsInput(s) {
    return s.phase === 'building' || s.phase === 'wave';
  }

  function onPointerDown(ev) {
    var s = R.state;
    if (!s || active) return;
    if (!boardAcceptsInput(s)) return;
    var cell = boardCell(ev);
    if (!cell) return;

    ev.preventDefault();
    active = {
      id: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      cell: cell,
      moved: false,
      piece: R.pieces.at(s, cell.c, cell.r)
    };
  }

  function onPointerMove(ev) {
    if (!active || ev.pointerId !== active.id) return;
    var dx = ev.clientX - active.startX;
    var dy = ev.clientY - active.startY;
    if (!active.moved && (dx * dx + dy * dy) > DRAG_THRESHOLD * DRAG_THRESHOLD) {
      active.moved = true;
    }
  }

  function onPointerUp(ev) {
    if (!active || ev.pointerId !== active.id) return;
    var s = R.state;
    var press = active;
    active = null;
    if (!s || !boardAcceptsInput(s)) return;

    if (press.moved) return;

    var cell = boardCell(ev) || press.cell;
    if (cell.i !== press.cell.i) return;

    if (press.piece) {
      R.pieces.flip(s, cell.c, cell.r);
    } else {
      R.pieces.place(s, s.ui.selectedType, cell.c, cell.r);
    }
  }

  function onPointerCancel(ev) {
    if (active && ev.pointerId === active.id) active = null;
  }

  input.init = function () {
    var board = document.getElementById('board');
    board.addEventListener('pointerdown', onPointerDown);
    global.addEventListener('pointermove', onPointerMove, { passive: true });
    global.addEventListener('pointerup', onPointerUp);
    global.addEventListener('pointercancel', onPointerCancel);

    /* Stop the browser turning taps into zoom, scroll or text selection. */
    document.addEventListener('gesturestart', function (ev) { ev.preventDefault(); });
    document.addEventListener('dblclick', function (ev) { ev.preventDefault(); });
    document.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    document.addEventListener('touchmove', function (ev) {
      if (ev.cancelable) ev.preventDefault();
    }, { passive: false });
  };

  input.cancel = function () {
    active = null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
