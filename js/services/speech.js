(function (global) {
  "use strict";

  function SpeechService() {
    this.recognizer = null;
    this.onText = null;
    this.onInterim = null;
    this.onError = null;
    this.onStateChange = null;
    this.listening = false;
    this._manualStop = false;
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
    this._manualStop = false;
    var self = this;
    var rec = new Ctor();
    rec.lang = lang || "fr-FR";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = true;
    rec.onresult = function (event) {
      var finalText = "";
      var interimText = "";
      for (var i = 0; i < event.results.length; i++) {
        var r = event.results[i];
        var t = r[0].transcript;
        if (r.isFinal) finalText += t;
        else interimText += t;
      }
      finalText = finalText.trim();
      interimText = interimText.trim();
      if (self.onInterim && interimText) self.onInterim(interimText);
      if (finalText && self.onText) self.onText(finalText);
    };
    rec.onerror = function (event) {
      var msg = null;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        msg = "Micro refusé : autorisez l'accès au microphone pour ce site puis rechargez la page.";
      } else if (event.error === "audio-capture") {
        msg = "Micro indisponible : vérifiez que le casque est bien branché et sélectionné.";
      } else if (event.error === "network") {
        msg = "Reconnaissance vocale : erreur réseau (la page doit être servie via http/https, pas file://).";
      }
      if (msg) {
        self._manualStop = true;
        self._stop();
        if (self.onError) self.onError(msg);
      }
    };
    rec.onend = function () {
      if (self.listening && !self._manualStop) {
        try { rec.start(); return; } catch (e) {}
      }
      self._stop();
    };
    this.recognizer = rec;
    this.listening = true;
    if (this.onStateChange) this.onStateChange(true);
    try { rec.start(); } catch (e) {
      this._stop();
      if (this.onError) this.onError("Impossible de démarrer la reconnaissance vocale.");
      return false;
    }
    return true;
  };

  SpeechService.prototype._stop = function () {
    this.listening = false;
    if (this.recognizer) {
      try { this.recognizer.onend = null; } catch (e) {}
      try { this.recognizer.abort(); } catch (e) {}
      this.recognizer = null;
    }
    if (this.onStateChange) this.onStateChange(false);
  };

  SpeechService.prototype.stop = function () {
    this._manualStop = true;
    this._stop();
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = SpeechService;
  } else {
    global.SpeechService = SpeechService;
  }
})(typeof window !== "undefined" ? window : globalThis);
