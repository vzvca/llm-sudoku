(function (global) {
  "use strict";

  var m = global.m;
  var Sudoku = global.Sudoku;
  var MistralClient = global.MistralClient;
  var SpeechService = global.SpeechService;
  var VoiceRecorder = global.VoiceRecorder;

  function micLabel(s) {
    if (s.transcribing) return "⏳ Transcription…";
    if (s.listening) return "● En écoute (cliquer pour arrêter et transcrire)";
    return "🎤 Micro";
  }

  function micTitle() {
    return "Dictée enregistrée puis transcrite par Mistral (Voxtral, français) : 1er clic = enregistrer, 2e clic = transcrire et envoyer";
  }

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
        case "fill_area":
          result = store.fillArea(args.area);
          label = result.ok ? "Remplissage de la zone sélectionnée" : "Remplissage impossible";
          break;
        case "clear_area":
          result = store.clearArea(args.area);
          label = result.ok ? "Effacement de la zone sélectionnée" : "Effacement impossible";
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
      s.interim = "";
      s.engine = "mistral";
      s.recorder = new VoiceRecorder();
      s.transcribed = "";
      s.transcribeTimer = null;
      s.transcribing = false;
      s.speech = new SpeechService();
      s.speech.onText = function (text) {
        s.input = text;
        m.redraw();
        Game.send(s);
      };
      s.speech.onInterim = function (text) {
        s.interim = text;
        s._scrollPending = true;
        m.redraw();
      };
      s.speech.onError = function (msg) {
        s.listening = false;
        if (/erreur réseau/.test(msg)) {
          s.error = "Moteur vocal du navigateur indisponible (Chromium sans clés API Google). Basculé sur la transcription Mistral — re-cliquez sur le micro pour dicter.";
          s.engine = "mistral";
        } else {
          s.error = msg;
        }
        m.redraw();
      };
      s.speech.onStateChange = function (on) {
        s.listening = on;
        if (!on) s.interim = "";
        m.redraw();
      };
      if (s.store.values.every(function (v) { return !v; }) &&
          s.store.puzzle.every(function (v) { return !v; })) {
        s.store.newGrid("facile");
      }
      s._scrollPending = true;
    },
    onremove: function (vnode) {
      var s = vnode.state;
      Game.stopTranscribeLoop(s);
      if (s.recorder) s.recorder.cancel();
    },
    transcribeAndSend: function (s) {
      if (s.transcribing) return;
      s.transcribing = true;
      s.error = "";
      s.listening = false;
      s.interim = "";
      Game.stopTranscribeLoop(s);
      m.redraw();
      s.recorder.stop().then(function (blob) {
        if (!blob) return null;
        var c;
        try { c = client(s); } catch (e) { throw e; }
        return c.transcribeAudio(blob);
      }).then(function (tailText) {
        var text = [s.transcribed, tailText]
          .filter(function (t) { return t && t.trim(); })
          .join(" ")
          .trim();
        if (!text) throw new Error("Aucune parole captée");
        s.input = "";
        s.transcribed = "";
        s.interim = "";
        m.redraw();
        Game.send(s, text);
      }).catch(function (e) {
        s.error = e.message || String(e);
      }).finally(function () {
        s.transcribing = false;
        Game.stopTranscribeLoop(s);
        m.redraw();
      });
    },
    transcribeTick: function (s) {
      if (!s.listening || s.transcribing) return;
      var c;
      try { c = client(s); } catch (e) { return; }
      s.recorder.cutSegment().then(function (blob) {
        if (!blob) return;
        return c.transcribeAudio(blob).then(function (text) {
          if (text) {
            s.transcribed = (s.transcribed ? s.transcribed + " " : "") + text;
            s.interim = s.transcribed;
            s._scrollPending = true;
            m.redraw();
          }
        });
      }).catch(function () {});
    },
    startTranscribeLoop: function (s) {
      Game.stopTranscribeLoop(s);
      s.transcribeTimer = setInterval(function () {
        if (s.listening && !s.transcribing) Game.transcribeTick(s);
      }, 4000);
    },
    stopTranscribeLoop: function (s) {
      if (s.transcribeTimer) {
        clearInterval(s.transcribeTimer);
        s.transcribeTimer = null;
      }
    },
    toggleMic: function (s) {
      if (s.busy || s.transcribing) return;
      if (s.engine === "mistral") {
        if (s.listening) { Game.transcribeAndSend(s); return; }
        s.error = "";
        s.interim = "";
        s.transcribed = "";
        s.recorder.start().then(function () {
          s.listening = true;
          Game.startTranscribeLoop(s);
          m.redraw();
        }).catch(function (e) {
          s.error = e.message || String(e);
          m.redraw();
        });
        return;
      }
      if (s.listening) { s.speech.stop(); return; }
      s.error = "";
      s.interim = "";
      s.speech.start("fr-FR");
    },
    send: function (s, directText) {
      if (s.busy) return;
      var text = directText ? String(directText).trim()
        : s.input.trim() || (s.interim || "").trim();
      if (!text) return;
      if (s.listening && s.engine !== "mistral") s.speech.stop();
      if (!directText) {
        s.input = "";
        s.interim = "";
      }
      s.busy = true;
      s.error = "";
      s._scrollPending = true;
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
          s._scrollPending = true;
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
          s._scrollPending = true;
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
            m("div.chat-messages", {
              id: "chat-messages",
              oncreate: function (e) { e.dom.scrollTop = e.dom.scrollHeight; },
              onupdate: function (e) {
                if (s._scrollPending || s.busy) {
                  s._scrollPending = false;
                  e.dom.scrollTop = e.dom.scrollHeight;
                }
              }
            }, s.messages.map(function (msg, idx) {
              return m("div.chat-msg." + msg.role, { key: idx }, msg.text);
            })),
            s.listening && s.interim ? m("div.chat-msg.system", "… « " + s.interim + " »") : null,
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
              class: s.listening || s.transcribing ? "listening" : "",
              title: micTitle(s),
              disabled: s.busy || (s.engine !== "mistral" && !s.speech.isSupported()) ||
                (s.engine === "mistral" && !s.recorder.isSupported()),
              onclick: function () { Game.toggleMic(s); }
            }, micLabel(s)),
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
