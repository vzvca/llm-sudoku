(function (global) {
  "use strict";

  var m = global.m;

  var Layout = {
    view: function (vnode) {
      var store = vnode.attrs.store;
      return m("div.layout", [
        m("header.topbar", [
          m("h1", "Sudoku IA"),
          m("nav", [
            m(m.route.Link, { href: "/game", class: "navlink" }, "Jeu"),
            m(m.route.Link, { href: "/settings", class: "navlink" }, "Réglages")
          ]),
          store && store.toast
            ? m("div.toast", { key: store.toastKey }, store.toast)
            : null
        ]),
        m("main", vnode.children)
      ]);
    }
  };

  global.Layout = Layout;
})(typeof window !== "undefined" ? window : globalThis);
