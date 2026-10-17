(function (global) {
  "use strict";

  var m = global.m;
  var Sudoku = global.Sudoku;

  var Board = {
    oninit: function (vnode) {
      vnode.state.selected = null;
    },
    onupdate: function (vnode) {
      var store = vnode.attrs.store;
      if (vnode.state.selected !== null && store.given[vnode.state.selected]) {
        vnode.state.selected = null;
      }
      store.selected = vnode.state.selected;
    },
    oncreate: function (vnode) {
      var self = vnode.state;
      self._handler = function (e) {
        if (!vnode.dom.contains(document.activeElement) && document.activeElement !== document.body) return;
        if (self.selected === null) return;
        var store = vnode.attrs.store;
        if (e.key >= "1" && e.key <= "9") {
          store.setCellValue(self.selected, parseInt(e.key, 10));
          m.redraw();
        } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
          store.setCellValue(self.selected, 0);
          m.redraw();
        } else if (e.key.indexOf("Arrow") === 0) {
          var i = self.selected;
          var r = Sudoku.rowOf(i), c = Sudoku.colOf(i);
          if (e.key === "ArrowUp") r = (r + 8) % 9;
          if (e.key === "ArrowDown") r = (r + 1) % 9;
          if (e.key === "ArrowLeft") c = (c + 8) % 9;
          if (e.key === "ArrowRight") c = (c + 1) % 9;
          self.selected = Sudoku.cellIndex(r, c);
          store.selected = self.selected;
          m.redraw();
          e.preventDefault();
        }
      };
      window.addEventListener("keydown", self._handler);
    },
    onremove: function (vnode) {
      if (vnode.state._handler) window.removeEventListener("keydown", vnode.state._handler);
    },
    view: function (vnode) {
      var store = vnode.attrs.store;
      var st = vnode.state;
      var conflicts = Sudoku.findConflictingCells(store.values);
      var cells = [];
      for (var i = 0; i < 81; i++) {
        (function (idx) {
          var r = Sudoku.rowOf(idx), c = Sudoku.colOf(idx);
          var classes = ["cell"];
          if (r % 3 === 0 && r > 0) classes.push("btop");
          if (c % 3 === 0 && c > 0) classes.push("bleft");
          if (store.given[idx]) classes.push("given");
          if (conflicts[idx]) classes.push("conflict");
          if (store.hintIndex === idx) classes.push("hint");
          if (st.selected === idx) classes.push("selected");
          cells.push(m("div", {
            class: classes.join(" "),
            onclick: function () {
              st.selected = store.given[idx] ? null : idx;
              store.selected = st.selected;
            }
          }, store.values[idx] ? String(store.values[idx]) : ""));
        })(i);
      }
      return m("div.board", cells);
    }
  };

  global.Board = Board;
})(typeof window !== "undefined" ? window : globalThis);
