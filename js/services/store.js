(function (global) {
  "use strict";

  var Sudoku = global.Sudoku || (typeof require !== "undefined" ? require("../models/sudoku.js") : null);

  var KEY = "sudoku.game.state";
  var DIFFICULTIES = ["facile", "moyen", "difficile"];

  function GameStore(storage) {
    this.storage = storage || null;
    this.puzzle = new Array(81).fill(0);
    this.given = new Array(81).fill(false);
    this.values = new Array(81).fill(0);
    this.solution = new Array(81).fill(0);
    this.difficulty = "facile";
    this.hintIndex = null;
    this._load();
  }

  GameStore.prototype._load = function () {
    if (!this.storage) return;
    try {
      var raw = this.storage.getItem(KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (Array.isArray(data.puzzle) && data.puzzle.length === 81 &&
          Array.isArray(data.given) && Array.isArray(data.values) &&
          Array.isArray(data.solution)) {
        this.puzzle = data.puzzle;
        this.given = data.given;
        this.values = data.values;
        this.solution = data.solution;
        this.difficulty = data.difficulty || "facile";
      }
    } catch (e) {}
  };

  GameStore.prototype.save = function () {
    if (!this.storage) return;
    this.storage.setItem(KEY, JSON.stringify({
      puzzle: this.puzzle,
      given: this.given,
      values: this.values,
      solution: this.solution,
      difficulty: this.difficulty
    }));
  };

  GameStore.prototype.newGrid = function (difficulty) {
    if (DIFFICULTIES.indexOf(difficulty) === -1) difficulty = "facile";
    var res = Sudoku.generate(difficulty);
    this.puzzle = res.puzzle;
    this.solution = res.solution;
    this.values = res.puzzle.slice();
    this.given = res.puzzle.map(function (v) { return v > 0; });
    this.difficulty = difficulty;
    this.hintIndex = null;
    this.save();
    return this.status();
  };

  GameStore.prototype.setCellValue = function (i, v) {
    if (i < 0 || i > 80 || this.given[i]) return false;
    this.values[i] = v >= 1 && v <= 9 ? v : 0;
    this.save();
    return true;
  };

  GameStore.prototype.resetGrid = function () {
    this.values = this.puzzle.slice();
    this.hintIndex = null;
    this.save();
    return this.status();
  };

  GameStore.prototype.solveGrid = function () {
    var solved = Sudoku.solve(this.puzzle);
    if (!solved) return { ok: false, message: "Grille sans solution unique" };
    this.values = solved;
    this.hintIndex = null;
    this.save();
    return { ok: true, message: "Grille résolue automatiquement" };
  };

  GameStore.prototype.checkGrid = function () {
    var conflicts = Sudoku.findConflictingCells(this.values);
    var empty = this.values.filter(function (v) { return !v; }).length;
    var complete = empty === 0;
    var correct = complete && Sudoku.isValidComplete(this.values);
    return {
      complete: complete,
      correct: correct,
      conflicts: Object.keys(conflicts).map(Number),
      emptyCells: empty,
      message: correct
        ? "Bravo, la grille est complète et correcte !"
        : (Object.keys(conflicts).length
          ? "Il y a des conflits dans la grille."
          : (complete ? "La grille est complète mais incorrecte." : "Aucun conflit détecté, il reste " + empty + " cases vides."))
    };
  };

  GameStore.prototype.getHint = function () {
    var hint = Sudoku.findBestHint(this.values, this.solution);
    if (!hint) return { ok: false, message: "La grille est déjà complète" };
    this.hintIndex = hint.index;
    this.save();
    return {
      ok: true,
      row: Sudoku.rowOf(hint.index) + 1,
      column: Sudoku.colOf(hint.index) + 1,
      value: this.solution[hint.index] || hint.value,
      candidates: hint.candidates,
      message: "Regarde la ligne " + (Sudoku.rowOf(hint.index) + 1) +
        ", colonne " + (Sudoku.colOf(hint.index) + 1) + " : " + hint.reason + "."
    };
  };

  GameStore.prototype.context = function () {
    var grid = "";
    for (var r = 0; r < 9; r++) {
      if (r && r % 3 === 0) grid += "\n";
      var line = "";
      for (var c = 0; c < 9; c++) {
        if (c && c % 3 === 0) line += " | ";
        var v = this.values[r * 9 + c];
        line += v ? String(v) : ".";
      }
      grid += line + "\n";
    }
    return {
      difficulty: this.difficulty,
      complete: this.values.every(function (v) { return v > 0; }),
      grid: grid.trim()
    };
  };

  GameStore.prototype.status = function () {
    return this.checkGrid();
  };

  GameStore.DIFFICULTIES = DIFFICULTIES;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GameStore;
  } else {
    global.GameStore = GameStore;
  }
})(typeof window !== "undefined" ? window : globalThis);
