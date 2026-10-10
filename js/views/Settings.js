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
          m("p.hint", "Le micro utilise la reconnaissance vocale du navigateur en français (fr-FR), puis le texte est envoyé à Mistral. Fonctionne au mieux sous Chrome ou Edge.")
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
