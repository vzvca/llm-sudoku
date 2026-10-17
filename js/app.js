(function (global) {
  "use strict";

  var m = global.m;

  var store = new global.GameStore(global.localStorage);
  global.AppStore = store;

  var settings = new global.Settings(global.localStorage);
  global.AppSettings = settings;

  var root = document.getElementById("app");
  m.route(root, "/game", {
    "/game": {
      render: function () {
        return m(global.Layout, { store: store }, m(global.Game, { store: store, settings: settings }));
      }
    },
    "/settings": {
      render: function () {
        return m(global.Layout, { store: store }, m(global.SettingsView, { store: store, settings: settings }));
      }
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
