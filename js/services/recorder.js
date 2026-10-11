(function (global) {
  "use strict";

  function VoiceRecorder() {
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.onStateChange = null;
  }

  VoiceRecorder.prototype.isSupported = function () {
    return !!(global.window && global.window.navigator &&
      global.window.navigator.mediaDevices &&
      global.window.navigator.mediaDevices.getUserMedia &&
      global.window.MediaRecorder);
  };

  VoiceRecorder.prototype.start = function () {
    var self = this;
    if (!this.isSupported()) {
      return Promise.reject(new Error("Enregistrement audio non supporté par ce navigateur."));
    }
    if (this.mediaRecorder) return Promise.resolve();
    return global.window.navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      self.stream = stream;
      var mr = new global.window.MediaRecorder(stream);
      self.chunks = [];
      mr.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) self.chunks.push(e.data);
      };
      mr.start(250);
      self.mediaRecorder = mr;
      if (self.onStateChange) self.onStateChange(true);
    });
  };

  VoiceRecorder.prototype.stop = function () {
    var self = this;
    var mr = this.mediaRecorder;
    if (!mr) return Promise.resolve(null);
    return new Promise(function (resolve) {
      mr.onstop = function () {
        self._cleanup();
        if (self.onStateChange) self.onStateChange(false);
        if (self.chunks.length === 0) return resolve(null);
        resolve(new Blob(self.chunks, { type: mr.mimeType || "audio/webm" }));
      };
      try { mr.stop(); } catch (e) {
        self._cleanup();
        resolve(null);
      }
    });
  };

  VoiceRecorder.prototype._cleanup = function () {
    if (this.stream) {
      this.stream.getTracks().forEach(function (t) { t.stop(); });
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  };

  VoiceRecorder.prototype.cancel = function () {
    if (this.mediaRecorder) {
      try { this.mediaRecorder.onstop = null; this.mediaRecorder.stop(); } catch (e) {}
    }
    this._cleanup();
    if (this.onStateChange) this.onStateChange(false);
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = VoiceRecorder;
  } else {
    global.VoiceRecorder = VoiceRecorder;
  }
})(typeof window !== "undefined" ? window : globalThis);
