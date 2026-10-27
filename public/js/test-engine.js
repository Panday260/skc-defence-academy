// =========================================================
// SKC DEFENCE ACADEMY - CBT ONLINE TEST ENGINE
// Real Exam Environment: Timer, Palette, Review, Instant Analytics
// =========================================================

class CBTTestEngine {
  constructor(testData, onComplete) {
    this.test = testData;
    this.onComplete = onComplete;
    this.currentIndex = 0;
    this.userAnswers = {}; // { questionId: selectedOptionIndex }
    this.reviewFlags = {}; // { questionId: boolean }
    this.visitedFlags = { 0: true };
    this.timeRemainingSeconds = (this.test.durationMinutes || 45) * 60;
    this.totalDurationSeconds = this.timeRemainingSeconds;
    this.timerInterval = null;
    this.startTime = Date.now();
  }

  start() {
    this.renderLayout();
    this.startTimer();
    this.showQuestion(0);
  }

  startTimer() {
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      this.timeRemainingSeconds--;
      this.updateTimerDisplay();
      if (this.timeRemainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        alert('Time is up! Your test is being automatically submitted.');
        this.submitTest();
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const el = document.getElementById('cbt-timer');
    if (!el) return;
    const minutes = Math.floor(this.timeRemainingSeconds / 60);
    const seconds = this.timeRemainingSeconds % 60;
    el.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (this.timeRemainingSeconds < 300) {
      el.style.color = '#ef4444';
      el.style.borderColor = '#ef4444';
    }
  }

  renderLayout() {
    const container = document.getElementById('cbt-viewport');
    if (!container) return;

    container.innerHTML = `
      <div class="cbt-container">
        <!-- Top Bar -->
        <div class="cbt-top-bar">
          <div>
            <h3 style="font-size:1.15rem; font-weight:800; color:#fff;">${this.test.title}</h3>
            <span style="font-size:0.8rem; color:#cbd5e1;">Exam: ${this.test.exam || 'Defence CBT'} • Total Marks: ${this.test.totalMarks}</span>
          </div>
          <div style="display:flex; align-items:center; gap:1rem;">
            <div class="cbt-timer-box">
              <span>⏱️</span>
              <span id="cbt-timer">00:00</span>
            </div>
            <button class="btn btn-primary" style="padding:0.45rem 1rem; font-size:0.85rem;" onclick="window.cbtEngineInstance.confirmSubmit()">
              Submit Test
            </button>
          </div>
        </div>

        <!-- Main Workspace -->
        <div class="cbt-main-grid">
          <!-- Question Pane -->
          <div class="cbt-question-pane">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.75rem;">
              <span id="cbt-section-name" class="cbt-section-badge">Section: General</span>
              <span style="font-size:0.82rem; color:#64748b; font-weight:600;">
                Question <strong id="cbt-q-number" style="color:#0f172a;">1</strong> of ${this.test.questions.length}
                <span style="margin-left:0.5rem; background:#dcfce7; color:#15803d; padding:0.15rem 0.5rem; border-radius:4px; font-size:0.75rem;">
                  +${this.test.positiveMarks || 1} / -${this.test.negativeMarks || 0.25}
                </span>
              </span>
            </div>

            <div id="cbt-question-body" class="cbt-question-text"></div>
            <div id="cbt-options-container" class="cbt-options-list"></div>

            <!-- Action Buttons -->
            <div class="cbt-actions-bar">
              <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-secondary" style="background:#f1f5f9; color:#475569;" onclick="window.cbtEngineInstance.clearResponse()">
                  Clear Response
                </button>
                <button class="btn btn-secondary" style="background:#ede9fe; color:#6d28d9; border-color:#ddd6fe;" onclick="window.cbtEngineInstance.markForReview()">
                  Mark for Review
                </button>
              </div>
              <div style="display:flex; gap:0.5rem;">
                <button id="cbt-prev-btn" class="btn btn-outline" onclick="window.cbtEngineInstance.prevQuestion()">
                  ← Previous
                </button>
                <button id="cbt-next-btn" class="btn btn-primary" onclick="window.cbtEngineInstance.nextQuestion()">
                  Save & Next →
                </button>
              </div>
            </div>
          </div>

          <!-- Palette Sidebar -->
          <div class="cbt-palette-sidebar">
            <h4 style="font-size:0.95rem; font-weight:700; color:#0f172a; margin-bottom:0.75rem;">Question Palette</h4>
            <div class="palette-status-legend">
              <div class="legend-item"><span class="legend-dot dot-answered"></span> Answered</div>
              <div class="legend-item"><span class="legend-dot dot-not-answered"></span> Unanswered</div>
              <div class="legend-item"><span class="legend-dot dot-review"></span> Review Later</div>
              <div class="legend-item"><span class="legend-dot dot-not-visited"></span> Not Visited</div>
            </div>
            <div id="cbt-palette-grid" class="palette-bubbles-grid"></div>
          </div>
        </div>
      </div>
    `;

    this.renderPalette();
  }

  showQuestion(index) {
    if (index < 0 || index >= this.test.questions.length) return;
    this.currentIndex = index;
    this.visitedFlags[index] = true;

    const q = this.test.questions[index];
    document.getElementById('cbt-q-number').innerText = index + 1;
    document.getElementById('cbt-section-name').innerText = `Section: ${q.section || 'General'}`;
    document.getElementById('cbt-question-body').innerHTML = q.question;

    const optionsContainer = document.getElementById('cbt-options-container');
    const selected = this.userAnswers[q.id];

    optionsContainer.innerHTML = q.options.map((opt, i) => {
      const isSelected = selected === i;
      return `
        <div class="cbt-option-item ${isSelected ? 'selected' : ''}" onclick="window.cbtEngineInstance.selectOption(${i})">
          <div class="cbt-option-radio">
            ${isSelected ? '<div style="width:8px; height:8px; border-radius:50%; background:#fff;"></div>' : ''}
          </div>
          <span><strong>(${String.fromCharCode(65 + i)})</strong> ${opt}</span>
        </div>
      `;
    }).join('');

    // Update Next/Prev buttons
    document.getElementById('cbt-prev-btn').disabled = index === 0;
    const nextBtn = document.getElementById('cbt-next-btn');
    if (index === this.test.questions.length - 1) {
      nextBtn.innerText = 'Review & Submit';
    } else {
      nextBtn.innerText = 'Save & Next →';
    }

    this.renderPalette();
  }

  selectOption(optionIndex) {
    const q = this.test.questions[this.currentIndex];
    this.userAnswers[q.id] = optionIndex;
    this.showQuestion(this.currentIndex);
  }

  clearResponse() {
    const q = this.test.questions[this.currentIndex];
    delete this.userAnswers[q.id];
    this.showQuestion(this.currentIndex);
  }

  markForReview() {
    const q = this.test.questions[this.currentIndex];
    this.reviewFlags[q.id] = !this.reviewFlags[q.id];
    this.nextQuestion();
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.showQuestion(this.currentIndex - 1);
    }
  }

  nextQuestion() {
    if (this.currentIndex < this.test.questions.length - 1) {
      this.showQuestion(this.currentIndex + 1);
    } else {
      this.confirmSubmit();
    }
  }

  renderPalette() {
    const paletteGrid = document.getElementById('cbt-palette-grid');
    if (!paletteGrid) return;

    paletteGrid.innerHTML = this.test.questions.map((q, idx) => {
      let statusClass = 'not-visited';
      if (this.userAnswers[q.id] !== undefined) {
        statusClass = 'answered';
      } else if (this.reviewFlags[q.id]) {
        statusClass = 'review';
      } else if (this.visitedFlags[idx]) {
        statusClass = 'not-answered';
      }

      const isActive = idx === this.currentIndex ? 'active' : '';
      return `
        <button class="palette-num-btn ${statusClass} ${isActive}" onclick="window.cbtEngineInstance.showQuestion(${idx})">
          ${idx + 1}
        </button>
      `;
    }).join('');
  }

  confirmSubmit() {
    const answeredCount = Object.keys(this.userAnswers).length;
    const totalCount = this.test.questions.length;
    const unattempted = totalCount - answeredCount;

    if (confirm(`Are you sure you want to submit?\n\n• Attempted: ${answeredCount}\n• Unattempted: ${unattempted}\n• Total: ${totalCount}`)) {
      this.submitTest();
    }
  }

  submitTest() {
    clearInterval(this.timerInterval);

    const timeSpentSeconds = this.totalDurationSeconds - this.timeRemainingSeconds;
    let correctCount = 0;
    let incorrectCount = 0;
    const posMark = this.test.positiveMarks || 1.0;
    const negMark = this.test.negativeMarks || 0.25;

    this.test.questions.forEach(q => {
      const ans = this.userAnswers[q.id];
      if (ans !== undefined) {
        if (ans === q.answer) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
    });

    const attempted = correctCount + incorrectCount;
    const rawScore = (correctCount * posMark) - (incorrectCount * negMark);
    const finalScore = Math.max(0, Number(rawScore.toFixed(2)));
    const maxMarks = this.test.totalMarks || (this.test.questions.length * posMark);
    const accuracy = attempted > 0 ? ((correctCount / attempted) * 100).toFixed(1) : 0;
    const percentile = (88 + (finalScore / (maxMarks || 1)) * 11).toFixed(1);
    const simulatedRank = Math.max(1, Math.floor(450 - (finalScore / (maxMarks || 1)) * 430));

    const result = {
      testId: this.test.id,
      title: this.test.title,
      exam: this.test.exam,
      totalQuestions: this.test.questions.length,
      attempted,
      correctCount,
      incorrectCount,
      skipped: this.test.questions.length - attempted,
      finalScore,
      maxMarks,
      accuracy,
      percentile,
      rank: simulatedRank,
      timeSpentFormatted: `${Math.floor(timeSpentSeconds / 60)}m ${timeSpentSeconds % 60}s`,
      userAnswers: this.userAnswers,
      questions: this.test.questions
    };

    if (this.onComplete) {
      this.onComplete(result);
    }
  }
}

window.CBTTestEngine = CBTTestEngine;
