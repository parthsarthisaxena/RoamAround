/* ─── RoamAround media.js — Voice Notes & Road Photos Engine ────────
 * Handles audio memo recording (MediaRecorder API + fallback synthesis),
 * in-chat voice playback, photo compression, and full-screen lightbox.
 ───────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  let mediaRecorder = null;
  let audioChunks = [];
  let recordTimer = null;
  let recordingSeconds = 0;
  let isRecording = false;
  let isSimulated = false;
  let activeAudio = null;
  let activePlayingId = null;

  // ── Voice Recording API ─────────────────────────────────────────
  async function startVoiceRecording(onTick, onComplete, onError) {
    if (isRecording) return;
    recordingSeconds = 0;
    audioChunks = [];
    isRecording = true;
    isSimulated = false;

    // Check if MediaRecorder is supported and available
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== "undefined") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => {
            if (onComplete) {
              onComplete({
                audioUrl: reader.result,
                durationSeconds: Math.max(recordingSeconds, 1),
                mimeType: mediaRecorder.mimeType || "audio/webm"
              });
            }
          };
          reader.readAsDataURL(blob);
        };

        mediaRecorder.start(100);
      } catch (err) {
        console.warn("[media] Microphone permission denied or unavailable, switching to simulated audio:", err.message);
        isSimulated = true;
      }
    } else {
      isSimulated = true;
    }

    // Start recording ticker
    recordTimer = setInterval(() => {
      recordingSeconds++;
      if (onTick) onTick(recordingSeconds);
      if (recordingSeconds >= 60) {
        // Max 60 seconds auto stop
        stopVoiceRecording();
      }
    }, 1000);

    if (onTick) onTick(0);
  }

  function stopVoiceRecording(onCompleteCb) {
    if (!isRecording) return;
    clearInterval(recordTimer);
    recordTimer = null;
    isRecording = false;

    if (isSimulated || !mediaRecorder || mediaRecorder.state === "inactive") {
      // Generate synthetic voice data URI (beep waveform for demo/testing environments)
      const simulatedAudio = createSimulatedVoiceNoteDataUrl(recordingSeconds);
      if (onCompleteCb) {
        onCompleteCb({
          audioUrl: simulatedAudio,
          durationSeconds: Math.max(recordingSeconds, 1),
          mimeType: "audio/wav"
        });
      }
    } else if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }

  function cancelVoiceRecording() {
    if (!isRecording) return;
    clearInterval(recordTimer);
    recordTimer = null;
    isRecording = false;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try {
        mediaRecorder.stop();
      } catch {}
    }
    audioChunks = [];
  }

  // Generate lightweight synthetic WAV audio for non-mic / fallback browsers
  function createSimulatedVoiceNoteDataUrl(durationSec = 3) {
    const dur = Math.max(durationSec, 1);
    const sampleRate = 8000;
    const numSamples = dur * sampleRate;
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + numSamples, true);
    writeString(view, 8, "WAVE");
    // FMT sub-chunk
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true); // byte rate
    view.setUint16(32, 1, true); // block align
    view.setUint16(34, 8, true); // 8-bit
    // Data sub-chunk
    writeString(view, 36, "data");
    view.setUint32(40, numSamples, true);

    // Write modulated radio frequency audio wave
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = 440 + Math.sin(t * 12) * 80;
      const sample = Math.sin(2 * Math.PI * freq * t) * Math.sin(t * 4);
      view.setUint8(44 + i, Math.floor((sample + 1) * 127.5));
    }

    const blob = new Blob([buffer], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // ── Voice Audio Player ──────────────────────────────────────────
  function togglePlayVoice(btnEl, audioUrl, msgId, totalDuration = 0) {
    if (!audioUrl) return;

    if (activePlayingId === msgId && activeAudio && !activeAudio.paused) {
      // Pause currently playing audio
      activeAudio.pause();
      updatePlayerUI(btnEl, false);
      return;
    }

    // Stop any previously playing audio
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      document.querySelectorAll(".voice-play-btn.playing").forEach((b) => updatePlayerUI(b, false));
    }

    activePlayingId = msgId;
    activeAudio = new Audio(audioUrl);
    updatePlayerUI(btnEl, true);

    const card = btnEl.closest(".chat-bubble.is-voice");
    const progressEl = card?.querySelector(".voice-progress-fill");
    const timeEl = card?.querySelector(".voice-time-curr");

    activeAudio.ontimeupdate = () => {
      if (!activeAudio) return;
      const cur = activeAudio.currentTime;
      const dur = activeAudio.duration || totalDuration || 1;
      const pct = Math.min((cur / dur) * 100, 100);
      if (progressEl) progressEl.style.width = `${pct}%`;
      if (timeEl) timeEl.textContent = formatAudioTime(cur);
    };

    activeAudio.onended = () => {
      updatePlayerUI(btnEl, false);
      if (progressEl) progressEl.style.width = "0%";
      if (timeEl) timeEl.textContent = formatAudioTime(0);
      activeAudio = null;
      activePlayingId = null;
    };

    activeAudio.onerror = (e) => {
      console.warn("[media] Audio playback failed:", e);
      updatePlayerUI(btnEl, false);
      activeAudio = null;
      activePlayingId = null;
    };

    activeAudio.play().catch((err) => {
      console.warn("[media] Playback error:", err.message);
      updatePlayerUI(btnEl, false);
    });
  }

  function updatePlayerUI(btnEl, isPlaying) {
    if (!btnEl) return;
    btnEl.classList.toggle("playing", isPlaying);
    const icon = btnEl.querySelector(".voice-play-icon");
    if (icon) {
      icon.innerHTML = isPlaying
        ? `<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>`
        : `<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>`;
    }
    const card = btnEl.closest(".chat-bubble.is-voice");
    if (card) {
      card.classList.toggle("is-playing", isPlaying);
    }
  }

  function formatAudioTime(secs) {
    const s = Math.floor(secs || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? "0" : ""}${rem}`;
  }

  // ── Roadside Photo Processor (Canvas Compression) ──────────────
  async function compressPhoto(file, maxWidth = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        return reject(new Error("File is not a valid image."));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;

          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);

          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve({
            dataUrl,
            width: w,
            height: h,
            originalName: file.name,
            sizeBytes: Math.round(dataUrl.length * 0.75)
          });
        };
        img.onerror = () => reject(new Error("Could not load image file."));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
  }

  // ── Photo Lightbox ──────────────────────────────────────────────
  function openLightbox(imgUrl, caption = "") {
    const modal = document.getElementById("photo-lightbox-modal");
    const imgEl = document.getElementById("photo-lightbox-img");
    const capEl = document.getElementById("photo-lightbox-caption");
    if (!modal || !imgEl) return;

    imgEl.src = imgUrl;
    if (capEl) capEl.textContent = caption || "Roadside Photo";
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    const modal = document.getElementById("photo-lightbox-modal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
    const imgEl = document.getElementById("photo-lightbox-img");
    if (imgEl) imgEl.src = "";
  }

  // ── Initialization & Event Wiring ─────────────────────────────
  function init() {
    // Lightbox close events
    const closeBtn = document.getElementById("photo-lightbox-close");
    const overlay = document.getElementById("photo-lightbox-overlay");
    if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
    if (overlay) overlay.addEventListener("click", closeLightbox);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.getElementById("photo-lightbox-modal")?.classList.contains("open")) {
        closeLightbox();
      }
    });

    // In-chat image click delegator for lightbox
    document.getElementById("chat-messages")?.addEventListener("click", (e) => {
      const imgCard = e.target.closest(".chat-photo-card");
      if (imgCard) {
        const img = imgCard.querySelector("img");
        const cap = imgCard.querySelector(".chat-photo-caption")?.textContent || "";
        if (img?.src) openLightbox(img.src, cap);
      }

      // Voice note play/pause button delegator
      const playBtn = e.target.closest(".voice-play-btn");
      if (playBtn) {
        const audioUrl = playBtn.dataset.audioUrl;
        const msgId = playBtn.dataset.msgId || audioUrl;
        const dur = parseFloat(playBtn.dataset.duration) || 5;
        togglePlayVoice(playBtn, audioUrl, msgId, dur);
      }
    });
  }

  // Export to global scope
  window.RC_media = {
    startVoiceRecording,
    stopVoiceRecording,
    cancelVoiceRecording,
    compressPhoto,
    togglePlayVoice,
    openLightbox,
    closeLightbox,
    formatAudioTime,
    init
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
