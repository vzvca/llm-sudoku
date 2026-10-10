(function (global) {
  "use strict";

  function SpeechService() {
    this.recognizer = null;
    this.onText = null;
    this.onError = null;
    this.onStateChange = null;
    this.listening = false;
  }

  SpeechService.prototype.isSupported = function () {
    var Ctor = global.window
      ? (global.window.SpeechRecognition || global.window.webkitSpeechRecognition)
      : null;
    return !!Ctor;
  };

  SpeechService.prototype.start = function (lang) {
    var Ctor = global.window
      ? (global.window.SpeechRecognition || global.window.webkitSpeechRecognition)
      : null;
    if (!Ctor) {
      if (this.onError) this.onError("Reconnaissance vocale non supportée par ce navigateur (essayez Chrome ou Edge).");
      return false;
    }
    if (this.listening) return true;
    var self = this;
    var rec = new Ctor();
    rec.lang = lang || "fr-FR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = function (event) {
      var text = "";
      for (var i = 0; i < event.results.length; i++) {
        var r = event.results[i];
        if (r.isFinal) text += r[0].transcript;
      }
      text = text.trim();
      if (text && self.onText) self.onText(text);
    };
    rec.onerror = function (event) {
      var msg = "Erreur de reconnaissance vocale";
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        msg = "Micro refusé ou indisponible";
      } else if (event.error === "no-speech") {
        msg = "Aucune parole détectée";
      } else if (event.error) {
        msg = "Reconnaissance vocale : " + event.error;
      }
      self._stop(msg);
      if (self.onError) self.onError(msg);
    };
    rec.onend = function () {
      if (self.listening) self._stop(null);
    };
    this.recognizer = rec;
    this.listening = true;
    if (this.onStateChange) this.onStateChange(true);
    rec.start();
    return true;
  };

  SpeechService.prototype._stop = function (err) {
    this.listening = false;
    if (this.recognizer) {
      try { this.recognizer.abort(); } catch (e) {}
      this.recognizer = null;
    }
    if (this.onStateChange) this.onStateChange(false, err);
  };

  SpeechService.prototype.stop = function () {
    this._stop(null);
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = SpeechService;
  } else {
    global.SpeechService = SpeechService;
  }
})(typeof window !== "undefined" ? window : globalThis);
