(function (global) {
  "use strict";

  var SIZE = 9;
  var BOX = 3;
  var DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  function rowOf(i) { return Math.floor(i / SIZE); }
  function colOf(i) { return i % SIZE; }
  function boxOf(i) { return Math.floor(rowOf(i) / BOX) * BOX + Math.floor(colOf(i) / BOX); }

  function peers(i) {
    var out = [];
    var r = rowOf(i), c = colOf(i);
    for (var x = 0; x < SIZE; x++) {
      out.push(r * SIZE + x);
      out.push(x * SIZE + c);
    }
    var br = Math.floor(r / BOX) * BOX, bc = Math.floor(c / BOX) * BOX;
    for (var rr = br; rr < br + BOX; rr++) {
      for (var cc = bc; cc < bc + BOX; cc++) out.push(rr * SIZE + cc);
    }
    var seen = {};
    return out.filter(function (j) {
      if (j === i || seen[j]) return false;
      seen[j] = true;
      return true;
    });
  }

  var PEERS = [];
  for (var k = 0; k < 81; k++) PEERS.push(peers(k));

  function cellIndex(r, c) { return r * SIZE + c; }

  function countConflicts(grid, i, v) {
    return PEERS[i].filter(function (j) { return grid[j] === v; }).length;
  }

  function isValidComplete(grid) {
    if (grid.length !== 81) return false;
    for (var i = 0; i < 81; i++) {
      if (grid[i] < 1 || grid[i] > 9) return false;
      if (countConflicts(grid, i, grid[i]) > 0) return false;
    }
    return true;
  }

  function countSolutions(grid, limit, maxNodes) {
    limit = limit || 2;
    maxNodes = typeof maxNodes === "number" ? maxNodes : 100000;
    var g = grid.slice();
    var empty = [];
    for (var i = 0; i < 81; i++) if (!g[i]) empty.push(i);
    var count = 0;
    var nodes = 0;
    function dfs(pos) {
      if (count >= limit) return;
      if (nodes++ > maxNodes) return;
      if (pos === empty.length) { count++; return; }
      var i = empty[pos];
      for (var d = 0; d < 9; d++) {
        var v = DIGITS[d];
        if (countConflicts(g, i, v) === 0) {
          g[i] = v;
          dfs(pos + 1);
          g[i] = 0;
        }
      }
    }
    dfs(0);
    return count;
  }

  function solve(grid) {
    var g = grid.slice();
    function dfs() {
      var best = -1, bestCount = 10;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var cands = [];
        for (var d = 0; d < 9; d++) {
          if (countConflicts(g, i, DIGITS[d]) === 0) cands.push(DIGITS[d]);
        }
        if (cands.length < bestCount) { best = i; bestCount = cands.length; }
        if (bestCount <= 1) break;
      }
      if (best === -1) return g;
      if (bestCount === 0) return null;
      for (var d2 = 0; d2 < 9; d2++) {
        var v = DIGITS[d2];
        if (countConflicts(g, best, v) === 0) {
          g[best] = v;
          var res = dfs();
          if (res) return res;
          g[best] = 0;
        }
      }
      return null;
    }
    return dfs();
  }

  function shuffledDigits(rng) {
    var arr = DIGITS.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function generateFull(rng) {
    rng = rng || Math.random;
    var g = new Array(81).fill(0);
    function dfs(pos) {
      if (pos === 81) return true;
      var i = pos;
      var ds = shuffledDigits(rng);
      for (var d = 0; d < 9; d++) {
        if (countConflicts(g, i, ds[d]) === 0) {
          g[i] = ds[d];
          if (dfs(pos + 1)) return true;
          g[i] = 0;
        }
      }
      return false;
    }
    dfs(0);
    return g;
  }

  function difficultyClueCount(difficulty) {
    switch (difficulty) {
      case "facile": return 40;
      case "moyen": return 32;
      case "difficile": return 26;
      default: return 40;
    }
  }

  function generate(difficulty, rng) {
    rng = rng || Math.random;
    var full = generateFull(rng);
    var clues = difficultyClueCount(difficulty);
    var puzzle = full.slice();
    var order = [];
    for (var i = 0; i < 40; i++) order.push(i);
    for (var i2 = 39; i2 > 0; i2--) {
      var j = Math.floor(rng() * (i2 + 1));
      var t = order[i2]; order[i2] = order[j]; order[j] = t;
    }
    var removed = 0;
    for (var o = 0; o < order.length && removed < 81 - clues; o++) {
      var p = order[o];
      var mirror = 80 - p;
      var a = puzzle[p], b = puzzle[mirror];
      puzzle[p] = 0; puzzle[mirror] = 0;
      if (countSolutions(puzzle, 2) !== 1) {
        puzzle[p] = a; puzzle[mirror] = b;
      } else {
        removed += (p === mirror) ? 1 : 2;
      }
    }
    return {
      puzzle: puzzle,
      solution: full
    };
  }

  function findConflictingCells(grid) {
    var bad = {};
    for (var i = 0; i < 81; i++) {
      var v = grid[i];
      if (!v) continue;
      PEERS[i].forEach(function (j) {
        if (j > i && grid[j] === v) { bad[i] = true; bad[j] = true; }
      });
    }
    return bad;
  }

  function candidatesFor(grid, i) {
    if (grid[i]) return [];
    return DIGITS.filter(function (v) { return countConflicts(grid, i, v) === 0; });
  }

  function findBestHint(grid, solution) {
    var empties = [];
    for (var i = 0; i < 81; i++) if (!grid[i]) empties.push(i);
    if (!empties.length) return null;
    var best = null, bestN = 10;
    for (var e = 0; e < empties.length; e++) {
      var c = candidatesFor(grid, empties[e]);
      if (c.length > 0 && c.length < bestN) { best = empties[e]; bestN = c.length; }
      if (bestN === 1) break;
    }
    if (!best) return { index: empties[0], value: solution[empties[0]], candidates: [], reason: "parity" };
    return {
      index: best,
      value: solution ? solution[best] : candsBest(grid, best)[0],
      candidates: candidatesFor(grid, best),
      reason: bestN === 1 ? "seul candidat possible pour cette case" : "case avec le moins de candidats"
    };
  }

  function candsBest(grid, i) { return candidatesFor(grid, i); }

  function serialize(grid) {
    var s = "";
    for (var i = 0; i < 81; i++) s += grid[i] ? String(grid[i]) : ".";
    return s;
  }

  function deserialize(str) {
    var s = String(str || "").replace(/[^0-9.]/g, "");
    if (s.length !== 81) return null;
    return s.split("").map(function (ch) { return ch === "." ? 0 : parseInt(ch, 10); });
  }

  global.Sudoku = {
    SIZE: SIZE,
    BOX: BOX,
    rowOf: rowOf,
    colOf: colOf,
    boxOf: boxOf,
    peers: peers,
    cellIndex: cellIndex,
    generate: generate,
    generateFull: generateFull,
    solve: solve,
    countSolutions: countSolutions,
    isValidComplete: isValidComplete,
    findConflictingCells: findConflictingCells,
    candidatesFor: candidatesFor,
    findBestHint: findBestHint,
    serialize: serialize,
    deserialize: deserialize,
    difficultyClueCount: difficultyClueCount
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.Sudoku;
  }
})(typeof window !== "undefined" ? window : globalThis);
