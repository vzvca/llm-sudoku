"use strict";

var nodeTest = require("node:test");
var describe = nodeTest.describe;
var it = nodeTest.it;
var assert = require("node:assert/strict");

var Sudoku = require("../js/models/sudoku.js");
var GameStore = require("../js/services/store.js");
var MistralClient = require("../js/services/mistral.js");

var rng = (function () {
  var seed = 42;
  return function () {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
})();

function memStorage() {
  var data = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; }
  };
}

describe("Sudoku engine", function () {
  it("génère une grille avec solution unique", function () {
    var res = Sudoku.generate("facile", rng);
    assert.equal(res.puzzle.length, 81);
    assert.equal(res.solution.length, 81);
    assert.ok(Sudoku.isValidComplete(res.solution));
    assert.equal(Sudoku.countSolutions(res.puzzle, 2), 1);
  });

  it("génère des grilles de difficultés différentes", function () {
    ["facile", "moyen", "difficile"].forEach(function (d) {
      var res = Sudoku.generate(d, rng);
      var clues = res.puzzle.filter(function (v) { return v > 0; }).length;
      assert.ok(clues >= 22, d + " : " + clues + " indices");
      assert.ok(clues <= 45, d + " : " + clues + " indices");
    });
  });

  it("résout une grille valide", function () {
    var res = Sudoku.generate("moyen", rng);
    var solved = Sudoku.solve(res.puzzle);
    assert.ok(solved);
    assert.ok(Sudoku.isValidComplete(solved));
    assert.deepEqual(solved, res.solution);
  });

  it("sérialise et désérialise", function () {
    var res = Sudoku.generate("facile", rng);
    var s = Sudoku.serialize(res.puzzle);
    assert.equal(s.length, 81);
    assert.deepEqual(Sudoku.deserialize(s), res.puzzle);
    assert.equal(Sudoku.deserialize("xx"), null);
  });

  it("détecte les conflits", function () {
    var grid = new Array(81).fill(0);
    grid[Sudoku.cellIndex(0, 0)] = 5;
    grid[Sudoku.cellIndex(0, 8)] = 5;
    var bad = Sudoku.findConflictingCells(grid);
    assert.ok(bad[Sudoku.cellIndex(0, 0)]);
    assert.ok(bad[Sudoku.cellIndex(0, 8)]);
  });

  it("trouve un indice pertinent", function () {
    var res = Sudoku.generate("facile", rng);
    var hint = Sudoku.findBestHint(res.puzzle, res.solution);
    assert.ok(hint);
    assert.equal(hint.value, res.solution[hint.index]);
  });
});

describe("GameStore", function () {
  it("crée, modifie et vérifie une grille", function () {
    var store = new GameStore(memStorage());
    var status = store.newGrid("facile");
    assert.equal(status.emptyCells > 0, true);
    var idx = store.values.findIndex(function (v, i) { return !v && !store.given[i]; });
    store.setCellValue(idx, store.solution[idx]);
    var chk = store.checkGrid();
    assert.equal(chk.conflicts.length, 0);
    assert.equal(chk.complete, false);
  });

  it("refuse de modifier les indices de départ", function () {
    var store = new GameStore(memStorage());
    store.newGrid("facile");
    var givenIdx = store.given.findIndex(function (g) { return g; });
    assert.equal(store.setCellValue(givenIdx, 9), false);
  });

  it("résout et réinitialise", function () {
    var store = new GameStore(memStorage());
    store.newGrid("moyen");
    var r = store.solveGrid();
    assert.equal(r.ok, true);
    assert.ok(Sudoku.isValidComplete(store.values));
    store.resetGrid();
    assert.deepEqual(store.values, store.puzzle);
  });

  it("donne un indice", function () {
    var store = new GameStore(memStorage());
    store.newGrid("facile");
    var h = store.getHint();
    assert.equal(h.ok, true);
    assert.ok(h.row >= 1 && h.row <= 9);
    assert.ok(h.column >= 1 && h.column <= 9);
    assert.equal(h.value, store.solution[Sudoku.cellIndex(h.row - 1, h.column - 1)]);
  });

  it("persiste dans le localStorage", function () {
    var storage = memStorage();
    var store = new GameStore(storage);
    store.newGrid("difficile");
    var store2 = new GameStore(storage);
    assert.deepEqual(store2.puzzle, store.puzzle);
    assert.equal(store2.difficulty, "difficile");
  });

  it("remplit la zone de la case sélectionnée", function () {
    var store = new GameStore(memStorage());
    store.newGrid("facile");
    store.selected = store.values.findIndex(function (v, i) { return !v && !store.given[i]; });
    var r = store.fillArea("row");
    assert.equal(r.ok, true);
    assert.ok(r.filled >= 1);
    var row = Math.floor(store.selected / 9);
    for (var c = 0; c < 9; c++) {
      assert.ok(store.values[row * 9 + c] > 0, "case " + c + " vide");
    }
    var sel = store.getSelection();
    assert.equal(sel.row, row + 1);
    assert.ok(sel.box >= 1 && sel.box <= 9);
  });

  it("efface le bloc de la case sélectionnée", function () {
    var store = new GameStore(memStorage());
    store.newGrid("facile");
    var emptyIdx = store.values.findIndex(function (v, i) { return !v && !store.given[i]; });
    store.setCellValue(emptyIdx, store.solution[emptyIdx]);
    store.selected = emptyIdx;
    var r = store.clearArea("box");
    assert.equal(r.ok, true);
    assert.ok(r.cleared >= 1);
    assert.equal(store.values[emptyIdx], 0);
    store.given.forEach(function (g, i) {
      if (g) assert.ok(store.values[i] > 0, "indice de départ effacé !");
    });
  });

  it("signale l'absence de sélection", function () {
    var store = new GameStore(memStorage());
    store.newGrid("facile");
    store.selected = null;
    var r = store.fillArea("row");
    assert.equal(r.ok, false);
  });

  it("inclut la sélection dans le contexte LLM", function () {
    var store = new GameStore(memStorage());
    store.newGrid("facile");
    store.selected = 40;
    var ctx = store.context();
    assert.ok(ctx.selection);
    assert.equal(ctx.selection.row, 5);
    assert.equal(ctx.selection.column, 5);
    assert.equal(ctx.selection.box, 5);
  });

  it("expose un contexte lisible pour le LLM", function () {
    var store = new GameStore(memStorage());
    store.newGrid("facile");
    var ctx = store.context();
    assert.equal(ctx.difficulty, "facile");
    assert.ok(ctx.grid.indexOf("|") !== -1);
  });
});

describe("MistralClient", function () {
  it("définit les outils de function calling", function () {
    var names = MistralClient.TOOLS.map(function (t) { return t.function.name; });
    ["new_grid", "check_grid", "place_value", "clear_cell", "get_hint", "solve_grid", "fill_area", "clear_area", "reset_grid"].forEach(function (n) {
      assert.ok(names.indexOf(n) !== -1, "outil manquant : " + n);
    });
  });

  it("a un prompt système en français", function () {
    assert.ok(MistralClient.SYSTEM_PROMPT.indexOf("français") !== -1);
  });

  it("transcrit un audio via FormData vers l'API transcriptions", function () {
    var captured = null;
    var realFetch = global.fetch;
    global.fetch = function (url, opts) {
      captured = { url: url, opts: opts };
      return Promise.resolve({
        ok: true,
        json: function () { return Promise.resolve({ text: "  prépare une grille difficile  " }); }
      });
    };
    var c = new MistralClient("key", "model");
    return c.transcribeAudio(new Blob(["audio"], { type: "audio/webm" })).then(function (text) {
      global.fetch = realFetch;
      assert.equal(text, "prépare une grille difficile");
      assert.equal(captured.url, "https://api.mistral.ai/v1/audio/transcriptions");
      assert.equal(captured.opts.headers.Authorization, "Bearer key");
      assert.ok(captured.opts.body instanceof FormData);
      assert.equal(captured.opts.body.get("model"), MistralClient.TRANSCRIPTION_MODEL);
      assert.equal(captured.opts.body.get("language"), "fr");
    }).catch(function (e) {
      global.fetch = realFetch;
      throw e;
    });
  });
});
