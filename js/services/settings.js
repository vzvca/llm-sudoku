(function (global) {
  "use strict";

  var KEY_API = "sudoku.settings.mistralApiKey";
  var KEY_MODEL = "sudoku.settings.mistralModel";
  var KEY_TICK = "sudoku.settings.transcribeTickMs";
  var DEFAULT_TICK_MS = 2000;
  var MIN_TICK_MS = 1000;
  var MAX_TICK_MS = 10000;

  function Settings(storage) {
    this.storage = storage || null;
  }

  Settings.prototype.getApiKey = function () {
    return this.storage ? this.storage.getItem(KEY_API) || "" : "";
  };

  Settings.prototype.setApiKey = function (key) {
    if (this.storage) this.storage.setItem(KEY_API, String(key || "").trim());
  };

  Settings.prototype.getModel = function () {
    return this.storage ? this.storage.getItem(KEY_MODEL) || "" : "";
  };

  Settings.prototype.setModel = function (model) {
    if (this.storage) this.storage.setItem(KEY_MODEL, String(model || "").trim());
  };

  Settings.prototype.getTranscribeTickMs = function () {
    var v = this.storage ? parseInt(this.storage.getItem(KEY_TICK), 10) : NaN;
    if (isNaN(v)) return DEFAULT_TICK_MS;
    return Math.min(MAX_TICK_MS, Math.max(MIN_TICK_MS, v));
  };

  Settings.prototype.setTranscribeTickMs = function (ms) {
    var v = parseInt(ms, 10);
    if (isNaN(v)) v = DEFAULT_TICK_MS;
    v = Math.min(MAX_TICK_MS, Math.max(MIN_TICK_MS, v));
    if (this.storage) this.storage.setItem(KEY_TICK, String(v));
    return v;
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Settings;
  } else {
    global.Settings = Settings;
  }
})(typeof window !== "undefined" ? window : globalThis);
