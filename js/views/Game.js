(function (global) {
  "use strict";

  var m = global.m;
  var Sudoku = global.Sudoku;
  var MistralClient = global.MistralClient;
  var SpeechService = global.SpeechService;

  function client(s) {
    if (!s.settings.getApiKey().trim()) {
      throw new Error("Renseignez votre clé API Mistral (onglet Réglages).");
    }
    return new MistralClient(
      s.settings.getApiKey().trim(),
      s.settings.getModel().trim() || undefined
    );
  }

  function addMessage(s, role, text) {
    s.messages.push({ role: role, text: text });
    if (s.messages.length > 100) s.messages.shift();
  }

  function applyToolCalls(s, store, toolCalls) {
    toolCalls.forEach(function (tc) {
      var args = tc.arguments || {};
      var result;
      var label;
      switch (tc.name) {
        case "new_grid":
          var d = args.difficulty || "facile";
          result = store.newGrid(d);
          label = "Nouvelle grille (" + d + ")";
          break;
        case "check_grid":
          result = store.checkGrid();
          label = "Vérification de la grille";
          break;
        case "place_value":
          var i = Sudoku.cellIndex((args.row || 1) - 1, (args.column || 1) - 1);
          var ok = store.setCellValue(i, args.value || 0);
          result = ok
            ? { ok: true, message: "Valeur " + args.value + " placée en (" + args.row + "," + args.column + ")" }
            : { ok: false, message: "Case occupée par un indice de départ" };
          label = result.message;
          break;
        case "clear_cell":
          var j = Sudoku.cellIndex((args.row || 1) - 1, (args.column || 1) - 1);
          var ok2 = store.setCellValue(j, 0);
          result = ok2
            ? { ok: true, message: "Case (" + args.row + "," + args.column + ") effacée" }
            : { ok: false, message: "Case occupée par un indice de départ" };
          label = result.message;
          break;
        case "get_hint":
          result = store.getHint();
          label = "Indice";
          break;
        case "solve_grid":
          result = store.solveGrid();
          label = "Résolution automatique";
          break;
        case "reset_grid":
          result = store.resetGrid();
          label = "Grille réinitialisée";
          break;
        default:
          result = { ok: false, message: "Fonction inconnue : " + tc.name };
          label = result.message;
      }
      addMessage(s, "action", label + (result && result.message ? " — " + result.message : ""));
    });
  }

  var Game = {
    oninit: function (vnode) {
      var s = vnode.state;
      s.store = vnode.attrs.store;
      s.settings = vnode.attrs.settings;
      s.messages = [];
      s.input = "";
      s.busy = false;
      s.error = "";
      s.listening = false;
      s.speech = new SpeechService();
      s.speech.onText = function (text) {
        s.input = text;
        m.redraw();
        Game.send(s);
      };
      s.speech.onError = function (msg) {
        s.error = msg;
        s.listening = false;
        m.redraw();
      };
      s.speech.onStateChange = function (on) {
        s.listening = on;
        m.redraw();
      };
      if (s.store.values.every(function (v) { return !v; }) &&
          s.store.puzzle.every(function (v) { return !v; })) {
        s.store.newGrid("facile");
      }
    },
    send: function (s) {
      if (s.busy) return;
      var text = s.input.trim();
      if (!text) return;
      s.input = "";
      s.busy = true;
      s.error = "";
      addMessage(s, "user", text);
      var c;
      try {
        c = client(s);
      } catch (e) {
        s.busy = false;
        s.error = e.message;
        return;
      }
      c.interpret(text, s.store.context())
        .then(function (msg) {
          if (msg.content) addMessage(s, "assistant", msg.content);
          if (msg.toolCalls && msg.toolCalls.length) {
            addMessage(s, "tool", "Appels : " + msg.toolCalls.map(function (tc) {
              return tc.name + "(" + JSON.stringify(tc.arguments) + ")";
            }).join(", "));
            applyToolCalls(s, s.store, msg.toolCalls);
          }
          if (!msg.content && (!msg.toolCalls || !msg.toolCalls.length)) {
            addMessage(s, "assistant", "Je n'ai pas compris la demande.");
          }
        })
        .catch(function (e) {
          s.error = e.message || String(e);
        })
        .finally(function () {
          s.busy = false;
          m.redraw();
        });
    },
    view: function (vnode) {
      var s = vnode.state;
      var store = s.store;
      var status = store.checkGrid();
      return m("div.game", [
        m("div.game-left", [
          m("div.game-status", [
            m("span.badge.difficulty", "Difficulté : " + store.difficulty),
            m("span.badge", status.complete
              ? (status.correct ? "Grille résolue ✔" : "Complète mais incorrecte")
              : status.emptyCells + " cases vides")
          ]),
          m(global.Board, { store: store }),
          m("div.board-actions", [
            m("button", {
              onclick: function () { store.newGrid(store.difficulty); m.redraw(); }
            }, "Nouvelle grille"),
            m("button", {
              onclick: function () { store.resetGrid(); m.redraw(); }
            }, "Réinitialiser"),
            m("button", {
              onclick: function () {
                var h = store.getHint();
                addMessage(s, "action", "Indice — " + h.message);
                m.redraw();
              }
            }, "Indice"),
            m("button", {
              onclick: function () {
                var r = store.solveGrid();
                addMessage(s, "action", r.message);
                m.redraw();
              }
            }, "Résoudre"),
            m("button", {
              onclick: function () {
                var chk = store.checkGrid();
                addMessage(s, "action", "Vérification — " + chk.message);
                m.redraw();
              }
            }, "Vérifier")
          ]),
          m("div.difficulty-picker", MistralClient.DIFFICULTIES.map(function (d) {
            return m("button", {
              class: d === store.difficulty ? "active" : "",
              onclick: function () { store.newGrid(d); m.redraw(); }
            }, d);
          }))
        ]),
        m("div.game-right", [
          m("div.chat", [
            m("div.chat-messages", s.messages.map(function (msg, idx) {
              return m("div.chat-msg." + msg.role, { key: idx }, msg.text);
            })),
            s.busy ? m("div.chat-msg.system", "L'IA réfléchit…") : null,
            s.error ? m("div.chat-error", s.error) : null
          ]),
          m("div.chat-input", [
            m("input[type=text]", {
              value: s.input,
              placeholder: "Ex. « prépare une nouvelle grille difficile »",
              oninput: function (e) { s.input = e.target.value; },
              onkeydown: function (e) {
                if (e.key === "Enter") { e.preventDefault(); Game.send(s); }
              }
            }),
            m("button.mic", {
              class: s.listening ? "listening" : "",
              title: s.speech.isSupported() ? "Parler (français)" : "Reconnaissance vocale non supportée",
              disabled: !s.speech.isSupported(),
              onclick: function () {
                if (s.listening) { s.speech.stop(); return; }
                s.error = "";
                s.speech.start("fr-FR");
              }
            }, s.listening ? "● En écoute" : "🎤 Micro"),
            m("button.send", {
              disabled: s.busy,
              onclick: function () { Game.send(s); }
            }, "Envoyer")
          ])
        ])
      ]);
    }
  };

  global.Game = Game;
})(typeof window !== "undefined" ? window : globalThis);
