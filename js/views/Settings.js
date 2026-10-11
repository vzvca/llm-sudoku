(function (global) {
  "use strict";

  var m = global.m;
  var MistralClient = global.MistralClient;

  var SettingsView = {
    oninit: function (vnode) {
      var s = vnode.state;
      s.settings = vnode.attrs.settings;
      s.store = vnode.attrs.store;
      s.apiKey = s.settings.getApiKey();
      s.model = s.settings.getModel() || MistralClient.DEFAULT_MODEL;
      s.keyVisible = false;
      s.saved = false;
      s.mic = { testing: false, level: 0, stream: null, ctx: null, raf: null, error: "" };
      s.tickSeconds = s.settings.getTranscribeTickMs() / 1000;
      s.savedTick = false;
    },
    micSupported: function () {
      return !!(global.window && global.window.navigator &&
        global.window.navigator.mediaDevices &&
        global.window.navigator.mediaDevices.getUserMedia && global.window.AudioContext);
    },
    stopMicTest: function (s) {
      var mic = s.mic;
      mic.testing = false;
      if (mic.raf) { global.cancelAnimationFrame(mic.raf); mic.raf = null; }
      if (mic.stream) {
        mic.stream.getTracks().forEach(function (t) { t.stop(); });
        mic.stream = null;
      }
      if (mic.ctx) { try { mic.ctx.close(); } catch (e) {} mic.ctx = null; }
      mic.level = 0;
      m.redraw();
    },
    toggleMicTest: function (s) {
      var mic = s.mic;
      if (mic.testing) { SettingsView.stopMicTest(s); return; }
      mic.error = "";
      global.window.navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        mic.stream = stream;
        mic.ctx = new global.window.AudioContext();
        var src = mic.ctx.createMediaStreamSource(stream);
        var analyser = mic.ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        mic.testing = true;
        var buf = new Uint8Array(analyser.fftSize);
        function tick() {
          if (!mic.testing) return;
          analyser.getByteTimeDomainData(buf);
          var sum = 0;
          for (var i = 0; i < buf.length; i++) {
            var v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          var rms = Math.sqrt(sum / buf.length);
          mic.level = Math.min(1, rms * 4);
          mic.raf = global.requestAnimationFrame(tick);
          m.redraw();
        }
        tick();
      }).catch(function (e) {
        mic.error = (e && e.name === "NotAllowedError")
          ? "Accès au micro refusé : autorisez-le pour ce site."
          : "Micro indisponible : " + ((e && e.message) || e);
        m.redraw();
      });
    },
    onremove: function (vnode) {
      SettingsView.stopMicTest(vnode.state);
    },
    view: function (vnode) {
      var s = vnode.state;
      return m("div.settings", [
        m("h2", "Réglages"),
        m("div.settings-card", [
          m("h3", "Clé API Mistral"),
          m("p.hint", "La clé est stockée uniquement dans le localStorage de ce navigateur et utilisée directement depuis le navigateur vers l'API Mistral."),
          m("div.row", [
            m("input", {
              type: s.keyVisible ? "text" : "password",
              value: s.apiKey,
              placeholder: "Clé API Mistral (ex. …)",
              oninput: function (e) { s.apiKey = e.target.value; s.saved = false; }
            }),
            m("button", {
              onclick: function () { s.keyVisible = !s.keyVisible; }
            }, s.keyVisible ? "Masquer" : "Afficher")
          ]),
          m("div.row", [
            m("label", "Modèle :"),
            m("input", {
              type: "text",
              value: s.model,
              placeholder: MistralClient.DEFAULT_MODEL,
              oninput: function (e) { s.model = e.target.value; s.saved = false; }
            })
          ]),
          m("div.row", [
            m("button.primary", {
              onclick: function () {
                s.settings.setApiKey(s.apiKey);
                s.settings.setModel(s.model);
                s.saved = true;
                s.store.toast = "Réglages enregistrés dans ce navigateur";
                s.store.toastKey = Date.now();
                clearTimeout(s.store._toastTimer);
                s.store._toastTimer = setTimeout(function () {
                  s.store.toast = null;
                  m.redraw();
                }, 2600);
              }
            }, "Enregistrer"),
            s.saved ? m("span.saved", "Enregistré ✓") : null
          ])
        ]),
        m("div.settings-card", [
          m("h3", "Reconnaissance vocale"),
          m("p.hint", "Le micro est enregistré dans le navigateur puis transcrit par Mistral (Voxtral, français). Utilisez le test ci-dessous pour vérifier que le son du micro est bien capté."),
          m("div.mic-test", [
            m("button", {
              disabled: !SettingsView.micSupported(),
              onclick: function () { SettingsView.toggleMicTest(s); }
            }, s.mic.testing ? "Arrêter le test" : "Tester le micro"),
            m("div.mic-meter", [
              m("div.mic-meter-bar", {
                style: "width: " + Math.round(s.mic.level * 100) + "%"
              }),
              m("span.mic-level", s.mic.testing
                ? (s.mic.level > 0.02 ? "Son détecté ✓" : "Silence… parlez dans le micro")
                : "")
            ]),
            s.mic.error ? m("div.chat-error", s.mic.error) : null
          ]),
          m("div.row", [
            m("label", "Transcription live toutes les"),
            m("input[type=number]", {
              min: 1, max: 10, step: 1,
              value: s.tickSeconds,
              oninput: function (e) {
                s.tickSeconds = e.target.value;
                var v = s.settings.setTranscribeTickMs(
                  (parseFloat(e.target.value) || 2) * 1000);
                s.tickSeconds = v / 1000;
                s.savedTick = true;
                clearTimeout(s._tickSavedTimer);
                s._tickSavedTimer = setTimeout(function () {
                  s.savedTick = false;
                  m.redraw();
                }, 1500);
              }
            }),
            m("span", "secondes"),
            s.savedTick ? m("span.saved", "✓") : null
          ]),
          m("p.hint", "Intervalle d'envoi des segments audio à Voxtral pendant la dictée (1 à 10 s). Plus court = texte plus réactif, mais davantage de requêtes API."),
          m("div.usage", (function () {
            var u = s.settings.getVoiceUsage();
            var mins = Math.floor(u.seconds / 60);
            var secs = Math.round(u.seconds % 60);
            var time = mins > 0 ? mins + " min " + secs + " s" : secs + " s";
            var cost = u.costUsd < 0.01 && u.costUsd > 0
              ? u.costUsd.toFixed(4)
              : u.costUsd.toFixed(2);
            return [
              m("strong", "Consommation vocale (ce navigateur) : "),
              time + " de dictée, " + u.requests + " requête(s) Voxtral",
              m("span.usage-cost", "≈ " + cost + " $ (voxtral-mini-latest, " +
                global.Settings.VOXTRAL_USD_PER_MIN + " $/min)"),
              m("button.small", {
                onclick: function () {
                  s.settings.resetVoiceUsage();
                  m.redraw();
                }
              }, "Remettre à zéro")
            ];
          })())
        ]),
        m("div.settings-card", [
          m("h3", "Exemples de commandes"),
          m("ul", [
            m("li", "« prépare une nouvelle grille »"),
            m("li", "« une grille moyenne s'il te plaît »"),
            m("li", "« mets un 5 ligne 2 colonne 7 »"),
            m("li", "« vérifie ma grille »"),
            m("li", "« donne-moi un indice »"),
            m("li", "« résous la grille »")
          ])
        ])
      ]);
    }
  };

  global.SettingsView = SettingsView;
})(typeof window !== "undefined" ? window : globalThis);
