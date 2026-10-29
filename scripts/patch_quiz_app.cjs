const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let code = fs.readFileSync(appJsPath, 'utf8');

// 1. Replace the srt-pdfs tab in openPhase2Viewer
const oldTabStart = "<!-- 2. TAB: SRT CLASS LECTURE PDFS (PW NOTES REPOSITORY FORMAT) -->";
const oldTabEnd = "<!-- 3. TAB: YOUTUBE VIDEO CLASSES -->";

const srtPdfsTabIdx = code.indexOf(oldTabStart);
const ytTabIdx = code.indexOf(oldTabEnd, srtPdfsTabIdx);

if (srtPdfsTabIdx === -1 || ytTabIdx === -1) {
  console.error("Could not find srt-pdfs tab boundaries!");
  process.exit(1);
}

const newSrtTabContent = `<!-- 2. TAB: SRT CLASS QUIZZES & LECTURE PDFS (PW DPP & NOTES FORMAT) -->
        \${activeFolder === 'srt-pdfs' ? \`
          <div class="folder-view-pane">
            <div class="folder-breadcrumb">
              <span>📁 Classroom_Vault</span>
              <span>›</span>
              <span>\${batch.title.replace(/\\s+/g, '_')}</span>
              <span>›</span>
              <span style="color:#f59e0b; font-weight:700;">📑 SRT_Class_Quizzes_&_PDFs/</span>
              <span class="crumb-count">\${srtPdfs.length} Classes (27 Quizzes & PDFs)</span>
            </div>

            <!-- Search Bar -->
            <div class="pw-search-box">
              <span>🔍</span>
              <input type="text" placeholder="Search 27 Class Quizzes & PDFs (e.g. Class 05, Fire, Disaster, Weapon, Leadership)..." oninput="App.filterCards(this.value, 'srt-pdfs-list')">
            </div>

            <div id="srt-pdfs-list" style="display:flex; flex-direction:column; gap:0.95rem;">
              \${srtPdfs.map(p => \`
                <div class="pw-lecture-card" data-title="\${p.title.toLowerCase()} class \${p.classNo} quiz test">
                  <div style="display:flex; align-items:center; gap:0.85rem; flex:1; min-width:240px;">
                    <span class="pw-class-index-tag">CLASS \${String(p.classNo).padStart(2, '0')}</span>
                    <div style="overflow:hidden;">
                      <strong style="color:#0f172a; font-size:1rem; display:block; line-height:1.4;">\${p.title}</strong>
                      <div style="display:flex; gap:0.4rem; font-size:0.75rem; color:#64748b; margin-top:0.35rem; flex-wrap:wrap;">
                        <span class="pw-meta-pill pw-pill-green">🎯 15 Scenarios Quiz</span>
                        <span class="pw-meta-pill pw-pill-blue">⏱️ 15 Mins Timed</span>
                        <span class="pw-meta-pill pw-pill-rose">📄 \${p.size} PDF</span>
                        <span class="pw-meta-pill pw-pill-amber">📑 \${p.pages} Pages</span>
                        <span class="pw-meta-pill pw-pill-purple">🛡️ Watermarked</span>
                      </div>
                    </div>
                  </div>

                  <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                    <button class="btn btn-primary" style="padding:0.5rem 1.15rem; font-size:0.85rem; font-weight:800; background:#10b981; border:none; box-shadow:0 2px 8px rgba(16,185,129,0.3);" onclick="App.launchClassQuiz('\${batch.id}', \${p.classNo})">
                      🎯 Start Class Quiz
                    </button>
                    <button class="btn btn-outline" style="padding:0.45rem 0.85rem; font-size:0.82rem;" onclick="App.previewPdf('\${p.url}')">
                      👁️ Preview PDF
                    </button>
                    <button class="btn btn-defence" style="padding:0.45rem 0.95rem; font-size:0.82rem; font-weight:700;" onclick="App.downloadWatermarkedPdf('\${p.url}')">
                      📥 Download PDF
                    </button>
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        \` : ''}

        `;

code = code.substring(0, srtPdfsTabIdx) + newSrtTabContent + code.substring(ytTabIdx);

// 2. Add Quiz Runner methods to App object right before filterCards
const filterCardsTarget = "  filterCards(query, containerId) {";
const filterCardsIdx = code.indexOf(filterCardsTarget);

if (filterCardsIdx === -1) {
  console.error("Could not find filterCards method in app.js!");
  process.exit(1);
}

const quizRunnerCode = `  // ==================== INTERACTIVE CLASS QUIZ ENGINE ====================
  quizState: {
    batchId: null,
    classNo: null,
    quiz: null,
    currentQ: 0,
    answers: {},
    timeRemaining: 900,
    intervalId: null,
    lang: 'bilingual',
    submitted: false
  },

  launchClassQuiz(batchId, classNo) {
    const batch = (this.state.phase2Batches || []).find(b => b.id === batchId) || (this.state.phase2Batches || [])[0];
    if (!batch) return;
    const classItem = (batch.srtClassPdfs || []).find(p => p.classNo === classNo);
    if (!classItem || !classItem.quiz) {
      alert('Quiz not found for this class.');
      return;
    }

    if (this.quizState.intervalId) clearInterval(this.quizState.intervalId);

    const quiz = classItem.quiz;
    this.quizState = {
      batchId: batchId,
      classNo: classNo,
      classItem: classItem,
      quiz: quiz,
      currentQ: 0,
      answers: {},
      timeRemaining: (quiz.durationMinutes || 15) * 60,
      intervalId: null,
      lang: 'bilingual',
      submitted: false
    };

    // Start timer
    this.quizState.intervalId = setInterval(() => {
      if (this.quizState.timeRemaining > 0) {
        this.quizState.timeRemaining--;
        this.updateQuizTimerDisplay();
      } else {
        clearInterval(this.quizState.intervalId);
        this.finishClassQuiz(true);
      }
    }, 1000);

    this.renderClassQuizView();
  },

  updateQuizTimerDisplay() {
    const el = document.getElementById('class-quiz-timer');
    if (!el) return;
    const m = Math.floor(this.quizState.timeRemaining / 60);
    const s = this.quizState.timeRemaining % 60;
    el.textContent = \`⏱️ \${String(m).padStart(2, '0')}:\${String(s).padStart(2, '0')}\`;
    if (this.quizState.timeRemaining < 120) {
      el.classList.add('urgent');
    } else {
      el.classList.remove('urgent');
    }
  },

  renderClassQuizView() {
    const modalBody = document.getElementById('generic-modal-body');
    const qState = this.quizState;
    const quiz = qState.quiz;
    const questions = quiz.questions || [];
    const q = questions[qState.currentQ];
    if (!q) return;

    document.getElementById('generic-modal-title').innerText = \`Class \${String(qState.classNo).padStart(2, '0')} Quiz: \${quiz.title}\`;

    const m = Math.floor(qState.timeRemaining / 60);
    const s = qState.timeRemaining % 60;
    const isUrgent = qState.timeRemaining < 120;
    const selectedOpt = qState.answers[qState.currentQ];

    modalBody.innerHTML = \`
      <div class="quiz-container">
        <!-- Header Bar -->
        <div class="quiz-header-bar">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.25rem;">
              <span style="background:#ff9933; color:#0b2a5b; font-weight:800; font-size:0.75rem; padding:0.2rem 0.55rem; border-radius:4px; text-transform:uppercase;">
                🎯 CLASS \${String(qState.classNo).padStart(2, '0')} QUIZ
              </span>
              <span style="background:rgba(255,255,255,0.18); color:#fff; font-size:0.75rem; font-weight:700; padding:0.2rem 0.5rem; border-radius:4px;">
                Question \${qState.currentQ + 1} of \${questions.length}
              </span>
            </div>
            <strong style="font-size:0.95rem; color:#fff; display:block;">\${quiz.title}</strong>
          </div>

          <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
            <!-- Language Switcher -->
            <div class="quiz-lang-selector">
              <button class="quiz-lang-btn \${qState.lang === 'bilingual' ? 'active' : ''}" onclick="App.setQuizLang('bilingual')">Both (द्विभाषी)</button>
              <button class="quiz-lang-btn \${qState.lang === 'en' ? 'active' : ''}" onclick="App.setQuizLang('en')">English</button>
              <button class="quiz-lang-btn \${qState.lang === 'hi' ? 'active' : ''}" onclick="App.setQuizLang('hi')">हिंदी</button>
            </div>

            <!-- Timer Pill -->
            <div id="class-quiz-timer" class="quiz-timer-pill \${isUrgent ? 'urgent' : ''}">
              ⏱️ \${String(m).padStart(2, '0')}:\${String(s).padStart(2, '0')}
            </div>

            <button type="button" class="btn btn-outline" style="color:#fca5a5; border-color:#fca5a5; padding:0.25rem 0.6rem; font-size:0.78rem;" onclick="App.exitQuizConfirm()">✕ Exit</button>
          </div>
        </div>

        <!-- Question Palette Strip (1 to 15) -->
        <div class="quiz-palette-strip">
          \${questions.map((_, idx) => {
            const isAns = qState.answers[idx] !== undefined;
            const isCur = idx === qState.currentQ;
            let cls = 'quiz-q-num-btn';
            if (isCur) cls += ' active';
            else if (isAns) cls += ' answered';
            return \`<button class="\${cls}" onclick="App.jumpQuizQ(\${idx})">\${idx + 1}</button>\`;
          }).join('')}
        </div>

        <!-- Question & Options Body -->
        <div class="quiz-card-body">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <span style="font-weight:700; color:#0284c7; font-size:0.85rem;">
              SCENARIO \${qState.currentQ + 1}
            </span>
            <span style="font-size:0.75rem; background:#e0f2fe; color:#0369a1; padding:0.15rem 0.45rem; border-radius:4px; font-weight:700;">
              OLQ Focus: \${q.olqAttribute || 'Crisis Reaction'}
            </span>
          </div>

          <!-- Situation Box -->
          <div class="quiz-situation-box">
            \${qState.lang !== 'hi' ? \`
              <p style="font-size:1.05rem; font-weight:700; color:#0f172a; margin:0 0 0.5rem; line-height:1.45;">
                \${q.situationEn}
              </p>
            \` : ''}
            \${qState.lang !== 'en' ? \`
              <p style="font-size:1rem; font-weight:600; color:#334155; margin:0; line-height:1.45;">
                \${q.situationHi}
              </p>
            \` : ''}
          </div>

          <!-- Options List -->
          <div class="quiz-options-list">
            \${q.options.map((opt, oIdx) => {
              const isSel = selectedOpt === oIdx;
              const letter = ['A', 'B', 'C', 'D'][oIdx];
              return \`
                <div class="quiz-option-item \${isSel ? 'selected' : ''}" onclick="App.selectQuizOption(\${oIdx})">
                  <div class="quiz-option-badge">\${letter}</div>
                  <div style="flex:1;">
                    \${qState.lang !== 'hi' ? \`
                      <div style="font-size:0.95rem; font-weight:600; color:#0f172a; margin-bottom:0.25rem; line-height:1.4;">
                        \${opt.textEn}
                      </div>
                    \` : ''}
                    \${qState.lang !== 'en' ? \`
                      <div style="font-size:0.9rem; color:#475569; line-height:1.4;">
                        \${opt.textHi}
                      </div>
                    \` : ''}
                  </div>
                  \${isSel ? '<span style="color:#0284c7; font-weight:800; font-size:1.2rem;">✔</span>' : ''}
                </div>
              \`;
            }).join('')}
          </div>
        </div>

        <!-- Bottom Actions Footer -->
        <div class="quiz-actions-footer">
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-outline" style="padding:0.5rem 1rem; font-size:0.85rem;" \${qState.currentQ === 0 ? 'disabled' : ''} onclick="App.prevQuizQ()">
              ⬅ Previous
            </button>
            <button class="btn btn-secondary" style="padding:0.5rem 0.85rem; font-size:0.82rem; background:#f1f5f9; color:#475569;" onclick="App.clearQuizAnswer()">
              🧹 Clear Choice
            </button>
          </div>

          <div style="display:flex; gap:0.5rem; align-items:center;">
            \${qState.currentQ < questions.length - 1 ? \`
              <button class="btn btn-primary" style="padding:0.5rem 1.25rem; font-size:0.88rem; font-weight:800;" onclick="App.nextQuizQ()">
                Next ➡
              </button>
            \` : \`
              <button class="btn btn-primary" style="padding:0.55rem 1.4rem; font-size:0.9rem; font-weight:800; background:#10b981; border:none; box-shadow:0 2px 10px rgba(16,185,129,0.35);" onclick="App.finishClassQuiz()">
                🏁 Submit Quiz
              </button>
            \`}
          </div>
        </div>
      </div>
    \`;

    this.openModal('generic-modal');
  },

  setQuizLang(lang) {
    this.quizState.lang = lang;
    this.renderClassQuizView();
  },

  selectQuizOption(optIdx) {
    this.quizState.answers[this.quizState.currentQ] = optIdx;
    this.renderClassQuizView();
  },

  clearQuizAnswer() {
    delete this.quizState.answers[this.quizState.currentQ];
    this.renderClassQuizView();
  },

  jumpQuizQ(qIdx) {
    this.quizState.currentQ = qIdx;
    this.renderClassQuizView();
  },

  prevQuizQ() {
    if (this.quizState.currentQ > 0) {
      this.quizState.currentQ--;
      this.renderClassQuizView();
    }
  },

  nextQuizQ() {
    if (this.quizState.currentQ < this.quizState.quiz.questions.length - 1) {
      this.quizState.currentQ++;
      this.renderClassQuizView();
    }
  },

  exitQuizConfirm() {
    if (confirm('Are you sure you want to exit this quiz? Your current progress will be lost.')) {
      if (this.quizState.intervalId) clearInterval(this.quizState.intervalId);
      this.openPhase2Viewer(this.quizState.batchId, 'srt-pdfs');
    }
  },

  finishClassQuiz(autoSubmitted = false) {
    if (!autoSubmitted) {
      const answered = Object.keys(this.quizState.answers).length;
      const total = this.quizState.quiz.questions.length;
      if (answered < total) {
        if (!confirm(\`You have answered \${answered} out of \${total} situations. Are you sure you want to submit?\`)) {
          return;
        }
      }
    }

    if (this.quizState.intervalId) clearInterval(this.quizState.intervalId);
    this.quizState.submitted = true;

    // Calculate score
    const questions = this.quizState.quiz.questions;
    let correct = 0;
    let wrong = 0;
    questions.forEach((q, idx) => {
      const userAns = this.quizState.answers[idx];
      if (userAns !== undefined) {
        if (userAns === q.correct) correct++;
        else wrong++;
      }
    });

    const attempted = correct + wrong;
    const skipped = questions.length - attempted;
    const scorePercent = Math.round((correct / questions.length) * 100);

    let olqRating = '⭐⭐⭐⭐ Good OLQ Fit (Recommended)';
    let badgeColor = '#10b981';
    let assessmentMsg = 'Your decisions reflect strong officer-like qualities, effective intelligence, and prompt crisis reaction.';

    if (scorePercent >= 85) {
      olqRating = '⭐⭐⭐⭐⭐ Outstanding (Cleared - Top 5% Merit)';
      badgeColor = '#059669';
      assessmentMsg = 'Exceptional leadership, speed of decision, and moral courage. Ready for Airforce Phase-II!';
    } else if (scorePercent >= 50) {
      olqRating = '⭐⭐⭐ Average (Needs Speed & Practical Sense)';
      badgeColor = '#f59e0b';
      assessmentMsg = 'Good logical reactions, but focus on taking more decisive initiative without hesitation.';
    } else {
      olqRating = '⚠️ Needs Improvement in Psychological Readiness';
      badgeColor = '#ef4444';
      assessmentMsg = 'Review the psychologist\\'s explanations below and practice positive reaction formulation.';
    }

    const modalBody = document.getElementById('generic-modal-body');
    document.getElementById('generic-modal-title').innerText = \`Result: Class \${this.quizState.classNo} Practice Quiz\`;

    modalBody.innerHTML = \`
      <div style="background:#ffffff; border-radius:12px; overflow:hidden;">
        <!-- Hero Score Banner -->
        <div style="background:linear-gradient(135deg, #0b2a5b 0%, #1e3a8a 100%); color:#fff; padding:1.75rem 1.25rem; text-align:center; border-bottom:4px solid #ff9933;">
          <span style="background:\${badgeColor}; color:#fff; font-weight:800; font-size:0.8rem; padding:0.25rem 0.75rem; border-radius:20px; text-transform:uppercase; display:inline-block; margin-bottom:0.6rem;">
            \${olqRating}
          </span>
          <h2 style="font-size:1.6rem; margin:0 0 0.5rem; color:#fff;">Psychological Response Scorecard</h2>
          <div style="font-size:3rem; font-weight:900; color:#ff9933; margin:0.3rem 0; line-height:1;">
            \${scorePercent}%
          </div>
          <p style="font-size:1rem; color:#cbd5e1; margin:0 auto; max-width:500px;">
            \${assessmentMsg}
          </p>
        </div>

        <!-- Metrics Grid -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:0.75rem; padding:1.25rem; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
          <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:0.65rem; text-align:center;">
            <strong style="color:#0f172a; font-size:1.3rem; display:block;">\${questions.length}</strong>
            <span style="font-size:0.75rem; color:#64748b;">Total Scenarios</span>
          </div>
          <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:0.65rem; text-align:center;">
            <strong style="color:#0284c7; font-size:1.3rem; display:block;">\${attempted}</strong>
            <span style="font-size:0.75rem; color:#64748b;">Attempted</span>
          </div>
          <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:0.65rem; text-align:center;">
            <strong style="color:#10b981; font-size:1.3rem; display:block;">\${correct}</strong>
            <span style="font-size:0.75rem; color:#64748b;">Optimal OLQ (✔)</span>
          </div>
          <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:0.65rem; text-align:center;">
            <strong style="color:#ef4444; font-size:1.3rem; display:block;">\${wrong}</strong>
            <span style="font-size:0.75rem; color:#64748b;">Sub-Optimal (✘)</span>
          </div>
          <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:0.65rem; text-align:center;">
            <strong style="color:#64748b; font-size:1.3rem; display:block;">\${skipped}</strong>
            <span style="font-size:0.75rem; color:#64748b;">Skipped</span>
          </div>
        </div>

        <!-- Action Row -->
        <div style="padding:1.25rem; display:flex; gap:0.6rem; flex-wrap:wrap; justify-content:center; background:#fff; border-bottom:1px solid #e2e8f0;">
          <button class="btn btn-primary" style="padding:0.6rem 1.4rem; font-weight:800; background:#0284c7;" onclick="App.toggleQuizReview()">
            📖 View Detailed Solutions & Explanations
          </button>
          <button class="btn btn-outline" style="padding:0.6rem 1.25rem;" onclick="App.launchClassQuiz('\${this.quizState.batchId}', \${this.quizState.classNo})">
            🔄 Retake Quiz
          </button>
          <button class="btn btn-defence" style="padding:0.6rem 1.25rem;" onclick="App.downloadWatermarkedPdf('\${this.quizState.classItem.url}')">
            📥 Download Class Notes PDF
          </button>
          <button class="btn btn-secondary" style="padding:0.6rem 1.25rem; background:#f1f5f9;" onclick="App.openPhase2Viewer('\${this.quizState.batchId}', 'srt-pdfs')">
            🔙 Back to Classes
          </button>
        </div>

        <!-- Detailed Solutions Review (Collapsible) -->
        <div id="quiz-review-container" style="display:none; padding:1.25rem; background:#f8fafc; max-height:480px; overflow-y:auto;">
          <h4 style="color:#0f172a; margin:0 0 1rem; font-size:1.1rem; border-bottom:2px solid #0284c7; padding-bottom:0.4rem;">
            Psychological Breakdown of All 15 Situations
          </h4>
          <div style="display:flex; flex-direction:column; gap:1rem;">
            \${questions.map((q, idx) => {
              const userAns = this.quizState.answers[idx];
              const isCorrect = userAns === q.correct;
              const isSkipped = userAns === undefined;
              const statusCls = isCorrect ? 'color:#10b981;' : (isSkipped ? 'color:#64748b;' : 'color:#ef4444;');
              const statusBadge = isCorrect ? '✔ Optimal Response' : (isSkipped ? '⚠️ Skipped' : '✘ Sub-Optimal Decision');

              return \`
                <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:1rem;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.4rem;">
                    <span style="font-weight:800; font-size:0.85rem; color:#0f172a;">Scenario \${idx + 1}</span>
                    <span style="font-weight:800; font-size:0.78rem; \${statusCls}">\${statusBadge}</span>
                  </div>
                  <p style="font-size:0.95rem; font-weight:700; color:#1e293b; margin:0 0 0.35rem;">\${q.situationEn}</p>
                  <p style="font-size:0.88rem; color:#475569; margin:0 0 0.75rem;">\${q.situationHi}</p>
                  
                  <div style="display:flex; flex-direction:column; gap:0.4rem; margin-bottom:0.75rem;">
                    \${q.options.map((opt, oIdx) => {
                      const isOptCorrect = oIdx === q.correct;
                      const isUserChoice = oIdx === userAns;
                      let bg = '#f8fafc';
                      let bd = '#e2e8f0';
                      if (isOptCorrect) { bg = '#dcfce7'; bd = '#86efac'; }
                      else if (isUserChoice && !isOptCorrect) { bg = '#fee2e2'; bd = '#fca5a5'; }

                      return \`
                        <div style="padding:0.5rem 0.75rem; background:\${bg}; border:1px solid \${bd}; border-radius:6px; font-size:0.85rem;">
                          <strong>\${['A','B','C','D'][oIdx]}.</strong> \${opt.textEn}
                          \${isOptCorrect ? '<span style="color:#15803d; font-weight:800; margin-left:0.5rem;">(✔ Optimal Response)</span>' : ''}
                          \${isUserChoice && !isOptCorrect ? '<span style="color:#dc2626; font-weight:800; margin-left:0.5rem;">(Your Choice)</span>' : ''}
                        </div>
                      \`;
                    }).join('')}
                  </div>

                  <div style="background:#eff6ff; border-left:3px solid #0284c7; padding:0.6rem 0.85rem; border-radius:4px; font-size:0.82rem; color:#1e3a8a;">
                    <strong>🧠 Psychologist's Assessment (\${q.olqAttribute}):</strong>
                    <div>\${q.explanationEn}</div>
                    <div style="color:#3b82f6; margin-top:0.2rem;">\${q.explanationHi}</div>
                  </div>
                </div>
              \`;
            }).join('')}
          </div>
        </div>
      </div>
    \`;

    this.openModal('generic-modal');
  },

  toggleQuizReview() {
    const el = document.getElementById('quiz-review-container');
    if (el) {
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
      if (el.style.display === 'block') {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  },

`;

code = code.substring(0, filterCardsIdx) + quizRunnerCode + code.substring(filterCardsIdx);

fs.writeFileSync(appJsPath, code, 'utf8');
console.log('Successfully patched public/js/app.js with full Class Quiz Engine and updated srt-pdfs tab!');
