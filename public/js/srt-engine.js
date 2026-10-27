// =========================================================
// SKC DEFENCE ACADEMY - PHASE-II SRT INTERACTIVE SIMULATOR
// Tests Officer Like Qualities (OLQ), speed of decision & courage
// =========================================================

class SRTEngine {
  constructor(scenarios, onComplete) {
    this.scenarios = scenarios || [];
    this.onComplete = onComplete;
    this.currentIndex = 0;
    this.responses = {}; // { scenarioId: selectedOptionIndex }
    this.timeRemainingSeconds = 30 * 60; // 30 minutes official Airforce SRT standard
    this.timerInterval = null;
  }

  start() {
    this.renderLayout();
    this.startTimer();
    this.showScenario(0);
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.timeRemainingSeconds--;
      const el = document.getElementById('srt-timer');
      if (el) {
        const m = Math.floor(this.timeRemainingSeconds / 60);
        const s = this.timeRemainingSeconds % 60;
        el.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
      if (this.timeRemainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        alert('Time is up for Situation Reaction Test! Submitting reactions.');
        this.finish();
      }
    }, 1000);
  }

  renderLayout() {
    const container = document.getElementById('srt-viewport');
    if (!container) return;

    container.innerHTML = `
      <div class="cbt-container">
        <div class="cbt-top-bar" style="background:#0f172a; border-bottom:2px solid #ca8a04;">
          <div>
            <h3 style="color:#fef08a; font-weight:800; font-size:1.15rem;">Airforce Phase-II: Situation Reaction Test (SRT) Simulator</h3>
            <span style="font-size:0.8rem; color:#e2e8f0;">Official 30-Minute Psychological Reaction Test • 45 Situations</span>
          </div>
          <div style="display:flex; align-items:center; gap:1rem;">
            <div class="cbt-timer-box" style="border-color:#eab308; color:#fef08a; background:rgba(234,179,8,0.2);">
              <span>⏳ Time Left:</span>
              <span id="srt-timer">30:00</span>
            </div>
            <button class="btn btn-primary" onclick="window.srtEngineInstance.finish()">
              Complete SRT
            </button>
          </div>
        </div>

        <div style="padding:2rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
            <span class="batch-badge" style="background:#fef08a; color:#713f12;">
              Situation <span id="srt-current-num">1</span> of ${this.scenarios.length}
            </span>
            <span style="font-size:0.85rem; color:#64748b; font-weight:600;">
              Target: Fast Decision Making without second-guessing
            </span>
          </div>

          <div id="srt-situation-box" style="background:#f8fafc; border:2px solid #e2e8f0; border-radius:12px; padding:1.5rem; font-size:1.2rem; font-weight:700; color:#0f172a; margin-bottom:1.5rem; line-height:1.45;"></div>

          <div id="srt-options-box" style="display:flex; flex-direction:column; gap:0.85rem; margin-bottom:2rem;"></div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:1.25rem;">
            <button id="srt-prev-btn" class="btn btn-outline" onclick="window.srtEngineInstance.prev()">
              ← Previous Situation
            </button>
            <div style="display:flex; gap:0.5rem;" id="srt-dots-container"></div>
            <button id="srt-next-btn" class="btn btn-primary" onclick="window.srtEngineInstance.next()">
              Next Situation →
            </button>
          </div>
        </div>
      </div>
    `;
  }

  showScenario(index) {
    if (index < 0 || index >= this.scenarios.length) return;
    this.currentIndex = index;
    const item = this.scenarios[index];

    document.getElementById('srt-current-num').innerText = index + 1;
    document.getElementById('srt-situation-box').innerText = item.situation;

    const optBox = document.getElementById('srt-options-box');
    const chosen = this.responses[item.id];

    optBox.innerHTML = item.options.map((opt, i) => {
      const isSelected = chosen === i;
      return `
        <div class="cbt-option-item ${isSelected ? 'selected' : ''}" onclick="window.srtEngineInstance.chooseOption(${i})" style="padding:1rem 1.25rem; font-size:1.02rem;">
          <div class="cbt-option-radio">
            ${isSelected ? '<div style="width:8px; height:8px; border-radius:50%; background:#fff;"></div>' : ''}
          </div>
          <span><strong>Option ${String.fromCharCode(65 + i)}:</strong> ${opt}</span>
        </div>
      `;
    }).join('');

    document.getElementById('srt-prev-btn').disabled = index === 0;
    const nextBtn = document.getElementById('srt-next-btn');
    if (index === this.scenarios.length - 1) {
      nextBtn.innerText = 'Submit SRT Reactions';
    } else {
      nextBtn.innerText = 'Next Situation →';
    }

    this.renderDots();
  }

  chooseOption(optIdx) {
    const item = this.scenarios[this.currentIndex];
    this.responses[item.id] = optIdx;
    this.showScenario(this.currentIndex);
  }

  prev() {
    if (this.currentIndex > 0) this.showScenario(this.currentIndex - 1);
  }

  next() {
    if (this.currentIndex < this.scenarios.length - 1) {
      this.showScenario(this.currentIndex + 1);
    } else {
      this.finish();
    }
  }

  renderDots() {
    const container = document.getElementById('srt-dots-container');
    if (!container) return;
    container.innerHTML = this.scenarios.map((s, idx) => {
      const isAnswered = this.responses[s.id] !== undefined;
      const isCurrent = idx === this.currentIndex;
      return `
        <div onclick="window.srtEngineInstance.showScenario(${idx})" style="width:12px; height:12px; border-radius:50%; cursor:pointer; background:${isCurrent ? '#ca8a04' : (isAnswered ? '#10b981' : '#cbd5e1')};"></div>
      `;
    }).join('');
  }

  finish() {
    clearInterval(this.timerInterval);
    let bestCount = 0;
    let attempted = 0;

    this.scenarios.forEach(s => {
      const resp = this.responses[s.id];
      if (resp !== undefined) {
        attempted++;
        if (resp === s.bestAnswer) bestCount++;
      }
    });

    const olqScore = Math.min(100, Math.round((bestCount / (this.scenarios.length || 1)) * 100));

    const result = {
      total: this.scenarios.length,
      attempted,
      bestCount,
      olqScore,
      rating: olqScore >= 80 ? 'Exceptional (Officer Material)' : (olqScore >= 60 ? 'Good Potential' : 'Needs Practice in Decisiveness'),
      scenarios: this.scenarios,
      responses: this.responses
    };

    if (this.onComplete) {
      this.onComplete(result);
    }
  }
}

window.SRTEngine = SRTEngine;
