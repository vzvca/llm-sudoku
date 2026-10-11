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
    if (this.stream) return Promise.resolve();
    return global.window.navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      self.stream = stream;
      self.chunks = [];
      self._startSegment();
      if (self.onStateChange) self.onStateChange(true);
    });
  };

  VoiceRecorder.prototype._startSegment = function () {
    var self = this;
    var mr = new global.window.MediaRecorder(this.stream);
    this.chunks = [];
    mr.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) self.chunks.push(e.data);
    };
    mr.start(250);
    this.mediaRecorder = mr;
  };

  VoiceRecorder.prototype.cutSegment = function () {
    var self = this;
    var mr = this.mediaRecorder;
    if (!mr || mr.state !== "recording") return Promise.resolve(null);
    return new Promise(function (resolve) {
      mr.onstop = function () {
        var chunks = self.chunks;
        self.chunks = [];
        self.mediaRecorder = null;
        if (self.stream) self._startSegment();
        if (chunks.length === 0) return resolve(null);
        resolve(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
      };
      try { mr.stop(); } catch (e) {
        self.mediaRecorder = null;
        resolve(null);
      }
    });
  };

  VoiceRecorder.prototype.stop = function () {
    var self = this;
    var mr = this.mediaRecorder;
    if (!mr) return this._cleanupAndResolve(null);
    return new Promise(function (resolve) {
      mr.onstop = function () {
        var chunks = self.chunks;
        self._cleanup();
        if (self.onStateChange) self.onStateChange(false);
        if (chunks.length === 0) return resolve(null);
        resolve(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
      };
      try { mr.stop(); } catch (e) {
        self._cleanup();
        resolve(null);
      }
    });
  };

  VoiceRecorder.prototype._cleanupAndResolve = function (value) {
    this._cleanup();
    if (this.onStateChange) this.onStateChange(false);
    return Promise.resolve(value);
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
