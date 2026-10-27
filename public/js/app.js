// =========================================================
// SKC DEFENCE ACADEMY - MAIN APPLICATION CONTROLLER
// Complete SPA Logic: Navigation, Slideshow, Auth, Checkout, Admin
// =========================================================

const App = {
  state: {
    academy: {},
    user: null,
    courses: [],
    freeTests: [],
    paidTestSeries: [],
    selectedPtsCategory: 'Airforce',
    ebooks: [],
    pyqs: [],
    syllabus: [],
    phase2Batches: [],
    srtScenarios: [],
    currentAffairs: { weekly: [], monthly: [] },
    selections: [],
    users: [],
    orders: [],
    activeView: 'home',
    slideshowIndex: 0,
    slideshowInterval: null,
    digitalBoardMode: false,
    selectedPdfPreview: null
  },

  async init() {
    this.bindEvents();
    await this.fetchAppData();
    this.restoreSession();
    this.initSlideshow();
    this.renderActiveView();
  },

  // 1. Fetch initial data from backend API
  async fetchAppData() {
    try {
      const [acadRes, crsRes, ftRes, ptsRes, ebRes, pyqRes, sylRes, p2Res, caRes, selRes] = await Promise.all([
        fetch('/api/academy').then(r => r.json()),
        fetch('/api/courses').then(r => r.json()),
        fetch('/api/free-tests').then(r => r.json()),
        fetch('/api/paid-test-series').then(r => r.json()),
        fetch('/api/ebooks').then(r => r.json()),
        fetch('/api/pyqs').then(r => r.json()),
        fetch('/api/syllabus').then(r => r.json()),
        fetch('/api/phase2').then(r => r.json()),
        fetch('/api/current-affairs').then(r => r.json()),
        fetch('/api/selections').then(r => r.json())
      ]);

      if (acadRes.success) this.state.academy = acadRes.data;
      if (crsRes.success) this.state.courses = crsRes.data;
      if (ftRes.success) this.state.freeTests = ftRes.data;
      if (ptsRes.success) this.state.paidTestSeries = ptsRes.data;
      if (ebRes.success) this.state.ebooks = ebRes.data;
      if (pyqRes.success) this.state.pyqs = pyqRes.data;
      if (sylRes.success) this.state.syllabus = sylRes.data;
      if (p2Res.success) {
        this.state.phase2Batches = p2Res.batches;
        this.state.srtScenarios = p2Res.srtScenarios;
      }
      if (caRes.success) this.state.currentAffairs = caRes.data;
      if (selRes.success) this.state.selections = selRes.data;

      this.renderBrandInfo();
      this.renderOurSelectionsSlideshow();
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  },

  // 2. User Session & Onboarding Management
  restoreSession() {
    const saved = localStorage.getItem('skc_active_user');
    if (saved) {
      try {
        this.state.user = JSON.parse(saved);
      } catch (e) {
        this.state.user = null;
      }
    }
    const savedExam = localStorage.getItem('skc_target_exam');
    if (savedExam) {
      this.state.targetExam = savedExam;
    }

    this.updateUserUI();
    this.applyTargetExamFilter();

    // If student/visitor has not registered or logged in, show onboarding modal
    if (!this.state.user) {
      setTimeout(() => {
        this.openLoginModal();
      }, 700);
    }
  },

  getAdminPin() {
    return localStorage.getItem('skc_admin_pin') || (this.state.user && this.state.user.adminPin) || 'skcadmin2026';
  },

  updateUserUI() {
    const userContainer = document.getElementById('user-header-area');
    if (!userContainer) return;

    if (this.state.user) {
      if (this.state.user.role === 'admin') {
        // Only visible when logged in with secret admin code
        userContainer.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <button class="btn btn-primary" style="background:#dc2626; border:none; padding:0.4rem 0.85rem; font-size:0.82rem; font-weight:800; border-radius:6px; box-shadow:0 2px 8px rgba(220,38,38,0.4);" onclick="App.navigateTo('admin-panel')">
              🛡️ Admin Panel
            </button>
            <button class="btn btn-outline" style="padding:0.4rem 0.65rem; font-size:0.75rem; border-color:#94a3b8; color:#cbd5e1;" onclick="App.logout()">
              Logout
            </button>
          </div>
        `;
      } else {
        // Normal student view: only their name/initials, no admin buttons
        userContainer.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <div class="user-profile-badge" onclick="App.openOnboardingModal()" title="Click to view details or change target exam">
              <div class="user-avatar-circle" style="background:#10b981; color:#fff;">${(this.state.user.name || 'S').charAt(0).toUpperCase()}</div>
              <span class="user-name-text">${(this.state.user.name || 'Student').split(' ')[0]}</span>
              <span class="user-role-badge" style="background:#10b981;">STUDENT</span>
            </div>
            <button class="btn btn-outline" style="padding:0.35rem 0.55rem; font-size:0.75rem; border-color:#cbd5e1; color:#94a3b8;" onclick="App.logout()" title="Logout / Switch Account">
              🚪 Logout
            </button>
          </div>
        `;
      }
    } else {
      userContainer.innerHTML = `
        <button class="btn btn-primary" style="padding:0.45rem 1rem; font-size:0.85rem; font-weight:700;" onclick="App.openLoginModal()">
          Student Login
        </button>
      `;
    }
  },

  openOnboardingModal() {
    this.openLoginModal();
  },

  openLoginModal() {
    if (this.state.user && this.state.user.role !== 'admin') {
      const nameInput = document.getElementById('auth-name-input');
      const phoneInput = document.getElementById('auth-phone-input');
      const examSelect = document.getElementById('auth-exam-select');
      if (nameInput) nameInput.value = this.state.user.name || '';
      if (phoneInput) phoneInput.value = this.state.user.phone || '';
      if (examSelect && this.state.targetExam) examSelect.value = this.state.targetExam;
    }
    this.openModal('login-modal');
  },

  async handleUserAuthSubmit(e) {
    if (e) e.preventDefault();
    const nameInput = document.getElementById('auth-name-input');
    const phoneInput = document.getElementById('auth-phone-input');
    const examSelect = document.getElementById('auth-exam-select');

    const rawName = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const targetExam = examSelect ? examSelect.value : 'airforce';

    if (!rawName) {
      alert('Please enter your full name / कृपया अपना पूरा नाम दर्ज करें');
      return;
    }

    // SECRET ADMIN VERIFICATION:
    // If the name entered is "skcadmin2026", grant full admin permissions immediately!
    if (rawName.toLowerCase() === 'skcadmin2026') {
      this.state.user = {
        id: 'usr_admin',
        name: 'SKC Admin',
        phone: '9876543210',
        email: 'Skcdefenceacademy@gmail.com',
        role: 'admin',
        adminPin: 'skcadmin2026',
        purchasedCourses: ['course_1', 'course_2', 'course_3', 'phase2_1', 'phase2_2', 'ebook_1'],
        purchasedTests: ['pts_airforce', 'pts_navy', 'pts_icg', 'pts_army']
      };
      localStorage.setItem('skc_active_user', JSON.stringify(this.state.user));
      localStorage.setItem('skc_admin_pin', 'skcadmin2026');
      this.closeModal('login-modal');
      this.updateUserUI();
      alert('🛡️ Access Granted: Logged in as SKC Coaching Admin!\n\nFull management and editing features are now available.');
      this.navigateTo('admin-panel');
      return;
    }

    // Normal Student Registration / Login
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      alert('Please enter your 10-digit mobile number / कृपया 10 अंकों का मोबाइल नंबर दर्ज करें');
      return;
    }

    try {
      const res = await fetch('/api/users/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: rawName, phone, targetExam })
      }).then(r => r.json());

      if (res.success && res.user) {
        this.state.user = res.user;
        this.state.targetExam = targetExam;
        localStorage.setItem('skc_active_user', JSON.stringify(this.state.user));
        localStorage.setItem('skc_target_exam', targetExam);
        localStorage.removeItem('skc_admin_pin');

        this.closeModal('login-modal');
        this.updateUserUI();
        this.applyTargetExamFilter();

        alert(`🎉 Welcome to SKC Defence Academy, ${this.state.user.name}!\n\nTarget Exam: ${this.getExamLabel(targetExam)}\nYour course content and test series have been tailored.`);

        if (targetExam === 'phase2') {
          this.navigateTo('phase2');
        } else {
          this.navigateTo('home');
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      this.state.user = { id: 'usr_' + Date.now(), name: rawName, phone, role: 'student', targetExam };
      this.state.targetExam = targetExam;
      localStorage.setItem('skc_active_user', JSON.stringify(this.state.user));
      localStorage.setItem('skc_target_exam', targetExam);
      this.closeModal('login-modal');
      this.updateUserUI();
      this.applyTargetExamFilter();
    }
  },

  logout() {
    if (confirm('Are you sure you want to log out?')) {
      localStorage.removeItem('skc_active_user');
      localStorage.removeItem('skc_admin_pin');
      this.state.user = null;
      this.updateUserUI();
      this.navigateTo('home');
      setTimeout(() => this.openLoginModal(), 400);
    }
  },

  getExamLabel(key) {
    const map = {
      'airforce': '✈️ Indian Airforce (Agniveer Vayu)',
      'phase2': '🎯 Airforce Phase-II (GD & SRT Special)',
      'navy': '⚓ Indian Navy (SSR / MR)',
      'army': '🎖️ Indian Army (Agniveer GD / Tech)',
      'icg': '🛡️ Indian Coast Guard (ICG Navik)'
    };
    return map[key] || '✈️ Indian Airforce (Agniveer Vayu)';
  },

  applyTargetExamFilter() {
    const exam = this.state.targetExam || 'airforce';
    const bar = document.getElementById('target-exam-bar');
    const label = document.getElementById('target-exam-label');
    if (bar && label) {
      label.innerText = this.getExamLabel(exam);
      bar.style.display = 'flex';
    }
  },

  // 3. Navigation between Views
  navigateTo(viewName) {
    this.state.activeView = viewName;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Highlight button in 10-button grid if applicable
    document.querySelectorAll('.home-btn-card').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    this.renderActiveView();
  },

  renderActiveView() {
    const view = this.state.activeView;

    // Toggle view sections
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const activeEl = document.getElementById(`view-${view}`);
    if (activeEl) {
      activeEl.classList.add('active');
    }

    // Specific View Renderers
    if (view === 'paid-courses') this.renderPaidCourses();
    if (view === 'free-test-series') this.renderFreeTests();
    if (view === 'paid-test-series') this.renderPaidTestSeries();
    if (view === 'ebooks') this.renderEbooks();
    if (view === 'pyq-pdfs') this.renderPyqs();
    if (view === 'syllabus') this.renderSyllabus();
    if (view === 'social-links') this.renderSocialLinks();
    if (view === 'phase2') this.renderPhase2();
    if (view === 'current-affairs') this.renderCurrentAffairs();
    if (view === 'my-courses') this.renderMyCourses();
    if (view === 'admin-panel') this.renderAdminPanel();
  },

  // 4. Brand & Logo Rendering
  renderBrandInfo() {
    const logoImg = document.getElementById('academy-logo-img');
    if (logoImg) logoImg.src = this.state.academy.logo || '/uploads/logo.png';

    const brandTitle = document.getElementById('academy-brand-title');
    if (brandTitle) brandTitle.innerText = this.state.academy.name || 'SKC DEFENCE ACADEMY';

    const brandTagline = document.getElementById('academy-brand-tagline');
    if (brandTagline) brandTagline.innerText = this.state.academy.tagline || 'IAF • Navy • Army • ICG';
  },

  // 5. OUR SELECTIONS SLIDESHOW CAROUSEL
  // "OUR Selections:-not in whole page we adjust all in slideshow"
  initSlideshow() {
    if (this.state.slideshowInterval) clearInterval(this.state.slideshowInterval);
    this.state.slideshowInterval = setInterval(() => {
      this.slideNext();
    }, 3500);
  },

  slideNext() {
    const total = this.state.selections.length;
    if (total === 0) return;
    const cardsPerView = window.innerWidth < 768 ? 1 : (window.innerWidth < 1024 ? 2 : 4);
    const maxIndex = Math.max(0, total - cardsPerView);
    this.state.slideshowIndex = this.state.slideshowIndex >= maxIndex ? 0 : this.state.slideshowIndex + 1;
    this.updateSlideshowPosition();
  },

  slidePrev() {
    const total = this.state.selections.length;
    if (total === 0) return;
    const cardsPerView = window.innerWidth < 768 ? 1 : (window.innerWidth < 1024 ? 2 : 4);
    const maxIndex = Math.max(0, total - cardsPerView);
    this.state.slideshowIndex = this.state.slideshowIndex <= 0 ? maxIndex : this.state.slideshowIndex - 1;
    this.updateSlideshowPosition();
  },

  updateSlideshowPosition() {
    const track = document.getElementById('selections-carousel-track');
    if (!track) return;
    const cardsPerView = window.innerWidth < 768 ? 1 : (window.innerWidth < 1024 ? 2 : 4);
    const stepPercent = 100 / cardsPerView;
    track.style.transform = `translateX(-${this.state.slideshowIndex * stepPercent}%)`;
  },

  renderOurSelectionsSlideshow() {
    const track = document.getElementById('selections-carousel-track');
    if (!track) return;

    if (!this.state.selections || this.state.selections.length === 0) {
      track.innerHTML = `<div style="padding:2rem; color:#cbd5e1;">Loading selection heroes...</div>`;
      return;
    }

    track.innerHTML = this.state.selections.map((sel, idx) => `
      <div class="selection-slide-card" onclick="App.openSelectionModal(${idx})">
        <div class="selection-img-wrapper">
          <div class="selection-badge-corner">${sel.intake || 'Intake 02/2026'}</div>
          <img src="${sel.image}" alt="${sel.name}" loading="lazy" onerror="this.src='/uploads/logo.png'">
        </div>
        <h4>${sel.name}</h4>
        <span class="exam-pill">${sel.exam}</span>
        <div class="roll-text">Roll No: <strong>${sel.rollNo}</strong></div>
      </div>
    `).join('');
  },

  openSelectionModal(idx) {
    const sel = this.state.selections[idx];
    if (!sel) return;
    const modalBody = document.getElementById('selection-modal-body');
    modalBody.innerHTML = `
      <div style="text-align:center;">
        <img src="${sel.image}" style="max-width:100%; max-height:420px; border-radius:10px; margin-bottom:1rem; border:2px solid #ca8a04; box-shadow:0 8px 25px rgba(0,0,0,0.25);" onerror="this.src='/uploads/logo.png'">
        <h3 style="font-size:1.4rem; color:#0a192f; margin-bottom:0.3rem;">${sel.name}</h3>
        <p style="color:#0284c7; font-weight:700; margin-bottom:0.5rem;">${sel.exam} • ${sel.post || 'Airmen'}</p>
        <div style="background:#f1f5f9; padding:0.75rem; border-radius:8px; display:inline-block; margin-bottom:1rem;">
          <span style="font-size:0.85rem; color:#475569;">Roll Number: <strong>${sel.rollNo}</strong></span> •
          <span style="font-size:0.85rem; color:#475569;">Batch: <strong>${sel.intake}</strong></span>
        </div>
        <p style="font-style:italic; color:#475569; font-size:0.95rem;">"${sel.quote || 'Hard work with SKC Defence Academy makes impossible selections possible!'}"</p>
      </div>
    `;
    this.openModal('selection-modal');
  },

  // 6. Section Renderers

  // 1. Paid Courses
  renderPaidCourses() {
    const container = document.getElementById('paid-courses-list');
    if (!container) return;

    container.innerHTML = this.state.courses.map(course => {
      const isEnrolled = this.state.user && (this.state.user.purchasedCourses || []).includes(course.id);
      return `
        <div class="content-card">
          <img src="${course.thumbnail || '/uploads/banner.png'}" class="content-card-thumb" alt="${course.title}">
          <div class="content-card-body">
            <span class="batch-badge" style="background:#e0f2fe; color:#0369a1;">${course.category} • ${course.badge}</span>
            <h3>${course.title}</h3>
            <p>${course.description}</p>
            <ul class="card-meta-list">
              ${course.features.map(f => `<li><span style="color:#10b981;">✓</span> ${f}</li>`).join('')}
              <li><span style="color:#0284c7;">🎥</span> ${course.videos ? course.videos.length : 0} Video Lectures Included</li>
              <li><span style="color:#f59e0b;">📝</span> HTML & CBT Practice Tests Included</li>
            </ul>
            <div class="card-pricing-row">
              <div class="price-box">
                <span class="current-price">₹${course.price}</span>
                <span class="original-price">₹${course.originalPrice}</span>
              </div>
              ${isEnrolled ? `
                <button class="btn btn-defence" onclick="App.openCourseViewer('${course.id}')">
                  ▶ Open Course
                </button>
              ` : `
                <button class="btn btn-primary" onclick="App.openCheckoutModal('course', '${course.id}', '${course.title}', ${course.price})">
                  Enroll Now
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  openCourseViewer(courseId) {
    const course = this.state.courses.find(c => c.id === courseId);
    if (!course) return;

    const modalBody = document.getElementById('generic-modal-body');
    document.getElementById('generic-modal-title').innerText = course.title;

    modalBody.innerHTML = `
      <div>
        <p style="color:#64748b; font-size:0.9rem; margin-bottom:1.5rem;">${course.description}</p>
        
        <h4 style="font-size:1.05rem; color:#0a192f; margin-bottom:0.75rem; border-bottom:2px solid #e2e8f0; padding-bottom:0.5rem;">
          🎥 Video Lessons (YouTube High Quality)
        </h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:1.75rem;">
          ${(course.videos || []).map(v => `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
              <div>
                <strong style="color:#0f172a; font-size:0.95rem; display:block;">${v.title}</strong>
                <span style="font-size:0.8rem; color:#64748b;">Duration: ${v.duration || '45 mins'}</span>
              </div>
              <button class="btn btn-primary" style="padding:0.35rem 0.85rem; font-size:0.8rem;" onclick="App.playVideoModal('${v.youtubeId || 'ysz5S6PUM-U'}', '${v.title}')">
                ▶ Watch Lecture
              </button>
            </div>
          `).join('')}
        </div>

        <h4 style="font-size:1.05rem; color:#0a192f; margin-bottom:0.75rem; border-bottom:2px solid #e2e8f0; padding-bottom:0.5rem;">
          📑 Class Notes & Formula PDFs (Watermark Enabled)
        </h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:1.75rem;">
          ${(course.pdfs || []).map(p => `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
              <div>
                <strong style="color:#0f172a; font-size:0.95rem; display:block;">📄 ${p.title}</strong>
                <span style="font-size:0.8rem; color:#64748b;">Pages: ${p.pages || 30} • Size: ${p.size || '3.2 MB'}</span>
              </div>
              <div style="display:flex; gap:0.4rem;">
                <button class="btn btn-outline" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="App.previewPdf('${p.url}')">
                  Preview
                </button>
                <button class="btn btn-defence" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="App.downloadWatermarkedPdf('${p.url}')">
                  ⬇ Download (Watermarked)
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <h4 style="font-size:1.05rem; color:#0a192f; margin-bottom:0.75rem; border-bottom:2px solid #e2e8f0; padding-bottom:0.5rem;">
          🖥️ Interactive HTML Mock Tests
        </h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${(course.htmlMocks || []).map(hm => `
            <div style="background:#fffbeb; border:1px solid #fef08a; border-radius:8px; padding:0.85rem; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:#713f12; font-size:0.95rem; display:block;">📝 ${hm.title}</strong>
                <span style="font-size:0.8rem; color:#854d0e;">Questions: ${hm.questions} • Time: ${hm.timeMinutes} Mins</span>
              </div>
              <button class="btn btn-primary" style="padding:0.35rem 0.85rem; font-size:0.8rem;" onclick="App.startHtmlMock('${hm.title}')">
                Start Test
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.openModal('generic-modal');
  },

  // 2. Free Test Series
  renderFreeTests() {
    const container = document.getElementById('free-tests-list');
    if (!container) return;

    container.innerHTML = this.state.freeTests.map(test => `
      <div class="content-card">
        <div class="content-card-body">
          <span class="batch-badge" style="background:#dcfce7; color:#15803d;">Free Access • ${test.exam}</span>
          <h3>${test.title}</h3>
          <p>${test.instructions}</p>
          <ul class="card-meta-list">
            <li><span>📊</span> Total Questions: <strong>${test.questions ? test.questions.length : 30}</strong></li>
            <li><span>⏱️</span> Duration: <strong>${test.durationMinutes} Minutes</strong></li>
            <li><span>🎯</span> Marking: <strong>+${test.positiveMarks} / -${test.negativeMarks}</strong></li>
            <li><span>📄</span> PDF Mode Enabled (Download Question Paper with Watermark)</li>
          </ul>
          <div style="display:flex; gap:0.5rem; margin-top:1rem; flex-wrap:wrap;">
            <button class="btn btn-primary" style="flex:1;" onclick="App.launchTest('${test.id}')">
              ▶ Start Online CBT
            </button>
            <button class="btn btn-outline" style="padding:0.6rem 0.85rem;" title="Download PDF Question Paper" onclick="App.downloadWatermarkedPdf('/uploads/pdfs/airforce_intake_02_2025_group_x.pdf')">
              ⬇ PDF Paper
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  launchTest(testId) {
    const test = this.state.freeTests.find(t => t.id === testId) ||
                 this.state.paidTestSeries.flatMap(s => s.tests || []).find(t => t.id === testId);
    if (!test) return alert('Test paper not found');

    this.navigateTo('test-viewport');
    window.cbtEngineInstance = new CBTTestEngine(test, (result) => {
      App.showScorecard(result);
    });
    window.cbtEngineInstance.start();
  },

  showScorecard(result) {
    const container = document.getElementById('cbt-viewport') || document.getElementById('view-test-viewport');
    if (!container) return;

    container.innerHTML = `
      <div class="analytics-card">
        <div class="score-hero-banner">
          <span style="text-transform:uppercase; font-size:0.8rem; font-weight:700; letter-spacing:1px; color:#f59e0b;">
            Official CBT Performance Report
          </span>
          <h2 style="font-size:1.8rem; margin:0.35rem 0 1.25rem; color:#fff;">${result.title}</h2>
          
          <div class="score-big-circle">
            <strong>${result.finalScore}</strong>
            <span>out of ${result.maxMarks}</span>
          </div>
          <p style="color:#e2e8f0; font-size:0.95rem;">
            Estimated All-India Rank: <strong style="color:#f59e0b;">#${result.rank}</strong> • Percentile: <strong style="color:#38bdf8;">${result.percentile}%</strong>
          </p>
        </div>

        <div class="analytics-kpi-grid">
          <div class="kpi-tile">
            <strong>${result.totalQuestions}</strong>
            <span>Total Qs</span>
          </div>
          <div class="kpi-tile" style="border-bottom:3px solid #10b981;">
            <strong style="color:#10b981;">${result.correctCount}</strong>
            <span>Correct</span>
          </div>
          <div class="kpi-tile" style="border-bottom:3px solid #ef4444;">
            <strong style="color:#ef4444;">${result.incorrectCount}</strong>
            <span>Incorrect</span>
          </div>
          <div class="kpi-tile" style="border-bottom:3px solid #94a3b8;">
            <strong style="color:#64748b;">${result.skipped}</strong>
            <span>Unattempted</span>
          </div>
          <div class="kpi-tile">
            <strong style="color:#0284c7;">${result.accuracy}%</strong>
            <span>Accuracy</span>
          </div>
          <div class="kpi-tile">
            <strong style="color:#d97706;">${result.timeSpentFormatted}</strong>
            <span>Time Spent</span>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
          <h3 style="font-size:1.3rem; color:#0a192f; font-weight:800;">Detailed Answer Key & Explanations</h3>
          <button class="btn btn-defence" onclick="App.downloadWatermarkedPdf('/uploads/pdfs/airforce_intake_02_2025_group_x.pdf')">
            ⬇ Download Solved Paper with Watermark
          </button>
        </div>

        <div class="answer-key-box">
          ${result.questions.map((q, idx) => {
            const userChoice = result.userAnswers[q.id];
            const isCorrect = userChoice === q.answer;
            const isSkipped = userChoice === undefined;
            const statusClass = isSkipped ? 'skipped' : (isCorrect ? 'correct' : 'incorrect');

            return `
              <div class="solution-accordion-item ${statusClass}">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.85rem; font-weight:700;">
                  <span style="color:#0284c7;">Question ${idx + 1} (${q.section || 'General'})</span>
                  <span>
                    ${isSkipped ? '<span style="color:#64748b;">Skipped (0.00)</span>' : (isCorrect ? '<span style="color:#15803d;">+1.00 Correct</span>' : '<span style="color:#dc2626;">-0.25 Incorrect</span>')}
                  </span>
                </div>
                <p style="font-weight:600; color:#0f172a; margin-bottom:0.75rem;">${q.question}</p>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.9rem; margin-bottom:0.75rem;">
                  ${q.options.map((opt, i) => {
                    const isRight = i === q.answer;
                    const isUserPick = i === userChoice;
                    let style = 'padding:0.4rem 0.6rem; border-radius:6px; border:1px solid #e2e8f0;';
                    if (isRight) style += 'background:#dcfce7; border-color:#86efac; font-weight:700; color:#15803d;';
                    else if (isUserPick) style += 'background:#fee2e2; border-color:#fca5a5; color:#b91c1c;';
                    return `<div style="${style}">(${String.fromCharCode(65 + i)}) ${opt} ${isRight ? '✓ (Correct)' : (isUserPick ? '✗ (Your Choice)' : '')}</div>`;
                  }).join('')}
                </div>
                <div style="background:#f8fafc; border-radius:6px; padding:0.6rem 0.85rem; font-size:0.85rem; color:#334155;">
                  <strong>Explanation:</strong> ${q.explanation || 'Refer to standard defence concepts.'}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="text-align:center; margin-top:2rem;">
          <button class="btn btn-primary" onclick="App.navigateTo('home')">
            ← Back to Home Dashboard
          </button>
        </div>
      </div>
    `;
  },

  // 4. Paid Test Series
  // "add only Airforce,Navy,ICG& Army(don't create by default mocks in this)"
  renderPaidTestSeries() {
    const tabsContainer = document.getElementById('pts-tabs-container');
    const contentContainer = document.getElementById('pts-content-area');
    if (!tabsContainer || !contentContainer) return;

    const categories = ['Airforce', 'Navy', 'ICG', 'Army'];

    tabsContainer.innerHTML = categories.map(cat => `
      <button class="pts-tab-btn ${this.state.selectedPtsCategory === cat ? 'active' : ''}" onclick="App.selectPtsCategory('${cat}')">
        ${cat === 'Airforce' ? '✈️ Indian Airforce' : (cat === 'Navy' ? '⚓ Indian Navy' : (cat === 'ICG' ? '🛡️ Coast Guard' : '🎖️ Indian Army'))}
      </button>
    `).join('');

    const currentSeries = this.state.paidTestSeries.find(s => s.name.toLowerCase() === this.state.selectedPtsCategory.toLowerCase()) || {
      name: this.state.selectedPtsCategory,
      title: `${this.state.selectedPtsCategory} Paid Test Series`,
      price: 349,
      originalPrice: 799,
      description: `Official test series for ${this.state.selectedPtsCategory} examination.`,
      tests: []
    };

    const isPurchased = this.state.user && (this.state.user.purchasedTests || []).includes(currentSeries.id || `pts_${this.state.selectedPtsCategory.toLowerCase()}`);

    contentContainer.innerHTML = `
      <div class="content-card" style="margin-bottom:1.5rem;">
        <div class="content-card-body">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
            <div>
              <span class="batch-badge" style="background:#fee2e2; color:#b91c1c;">Target Selection Series</span>
              <h3 style="font-size:1.35rem; margin:0.35rem 0;">${currentSeries.title}</h3>
              <p style="color:#64748b;">${currentSeries.description || 'Simulates official online test interface with sectional cut-offs and detailed analysis.'}</p>
            </div>
            <div style="text-align:right;">
              <div class="price-box" style="justify-content:flex-end;">
                <span class="current-price">₹${currentSeries.price}</span>
                <span class="original-price">₹${currentSeries.originalPrice}</span>
              </div>
              ${isPurchased ? `
                <span style="background:#dcfce7; color:#15803d; font-weight:700; font-size:0.85rem; padding:0.35rem 0.85rem; border-radius:20px; display:inline-block; margin-top:0.5rem;">
                  ✓ Series Unlocked
                </span>
              ` : `
                <button class="btn btn-primary" style="margin-top:0.5rem;" onclick="App.openCheckoutModal('test', '${currentSeries.id || 'pts_' + this.state.selectedPtsCategory.toLowerCase()}', '${currentSeries.title}', ${currentSeries.price})">
                  Unlock Test Series
                </button>
              `}
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h4 style="font-size:1.15rem; color:#0a192f; font-weight:700;">
          Available Full Length Mocks (${currentSeries.tests ? currentSeries.tests.length : 0})
        </h4>
        ${this.state.user && this.state.user.role === 'admin' ? `
          <button class="btn btn-secondary" style="background:#0a192f; color:#fff; font-size:0.82rem;" onclick="App.openAddTestModal('${this.state.selectedPtsCategory}')">
            + Add New Mock Test (Admin)
          </button>
        ` : ''}
      </div>

      ${(!currentSeries.tests || currentSeries.tests.length === 0) ? `
        <div style="background:#fff; border:2px dashed #cbd5e1; border-radius:12px; padding:3rem 1.5rem; text-align:center; color:#64748b;">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">🎯</div>
          <h4 style="color:#0f172a; margin-bottom:0.3rem;">No default mock tests in this section</h4>
          <p style="font-size:0.88rem; max-width:480px; margin:0 auto 1.25rem;">
            As requested, by default mocks are not added. The coaching staff/admin can upload verified high-yield mock tests anytime.
          </p>
          ${this.state.user && this.state.user.role === 'admin' ? `
            <button class="btn btn-primary" onclick="App.openAddTestModal('${this.state.selectedPtsCategory}')">
              Create First ${this.state.selectedPtsCategory} Mock Test
            </button>
          ` : `
            <span style="font-size:0.8rem; background:#f1f5f9; padding:0.35rem 0.85rem; border-radius:20px;">
              Mock tests are scheduled and added regularly by faculty
            </span>
          `}
        </div>
      ` : `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1rem;">
          ${currentSeries.tests.map(t => `
            <div class="content-card">
              <div class="content-card-body">
                <h4>${t.title}</h4>
                <p>Total Questions: ${t.questions ? t.questions.length : 50} • ${t.durationMinutes} Mins</p>
                ${isPurchased ? `
                  <button class="btn btn-primary" onclick="App.launchTest('${t.id}')">
                    Attempt Mock
                  </button>
                ` : `
                  <button class="btn btn-outline" onclick="App.openCheckoutModal('test', '${currentSeries.id}', '${currentSeries.title}', ${currentSeries.price})">
                    🔒 Locked (Buy Series)
                  </button>
                `}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  },

  selectPtsCategory(cat) {
    this.state.selectedPtsCategory = cat;
    this.renderPaidTestSeries();
  },

  // 5. E-Books
  // "E-Books: this is also our paid section I have one e-book"
  renderEbooks() {
    const container = document.getElementById('ebooks-list');
    if (!container) return;

    container.innerHTML = this.state.ebooks.map(eb => {
      const isPurchased = this.state.user && (this.state.user.purchasedEbooks || []).includes(eb.id);
      return `
        <div class="content-card" style="max-width:880px; margin:0 auto; flex-direction:row; flex-wrap:wrap;">
          <img src="${eb.coverImage || '/uploads/banner.png'}" style="width:260px; object-fit:cover; min-height:300px;" alt="${eb.title}">
          <div class="content-card-body" style="flex:1; min-width:280px;">
            <span class="batch-badge" style="background:#ede9fe; color:#6d28d9;">Exclusive E-Book • ${eb.pages} Pages</span>
            <h3 style="font-size:1.35rem;">${eb.title}</h3>
            <p style="color:#64748b; font-size:0.9rem;">Author: <strong>${eb.author}</strong></p>
            <p>${eb.description}</p>
            <ul class="card-meta-list">
              ${(eb.features || []).map(f => `<li><span style="color:#7c3aed;">★</span> ${f}</li>`).join('')}
            </ul>
            <div class="card-pricing-row">
              <div class="price-box">
                <span class="current-price">₹${eb.price}</span>
                <span class="original-price">₹${eb.originalPrice}</span>
              </div>
              <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-outline" onclick="App.readEbookPreview('${eb.id}')">
                  👁️ Read Free Sample
                </button>
                ${isPurchased ? `
                  <button class="btn btn-defence" onclick="App.downloadWatermarkedPdf('${eb.pdfUrl}')">
                    ⬇ Download (Watermarked)
                  </button>
                ` : `
                  <button class="btn btn-primary" onclick="App.openCheckoutModal('ebook', '${eb.id}', '${eb.title}', ${eb.price})">
                    Buy Complete E-Book
                  </button>
                `}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  readEbookPreview(ebookId) {
    const eb = this.state.ebooks.find(e => e.id === ebookId);
    if (!eb) return;

    const modalBody = document.getElementById('generic-modal-body');
    document.getElementById('generic-modal-title').innerText = `Preview: ${eb.title}`;

    modalBody.innerHTML = `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1.5rem; max-height:400px; overflow-y:auto; line-height:1.6; white-space:pre-wrap; font-family:Georgia, serif; font-size:1rem; color:#1e293b;">
${eb.previewText || 'Sample preview chapter...'}
      </div>
      <div style="margin-top:1.5rem; text-align:right;">
        <button class="btn btn-primary" onclick="App.closeModal('generic-modal'); App.openCheckoutModal('ebook', '${eb.id}', '${eb.title}', ${eb.price});">
          Unlock Full 184-Page Book (₹${eb.price})
        </button>
      </div>
    `;
    this.openModal('generic-modal');
  },

  // 6. PYQ PDFs
  // "PYQ PDFs: (also pdf upload enable)"
  renderPyqs() {
    const container = document.getElementById('pyqs-list');
    if (!container) return;

    container.innerHTML = this.state.pyqs.map(p => `
      <div class="content-card">
        <div class="content-card-body">
          <span class="batch-badge" style="background:#ffedd5; color:#c2410c;">${p.exam} • Year ${p.year}</span>
          <h3>${p.title}</h3>
          <p>Official Memory-Based Question Paper with 100% verified solution explanations.</p>
          <ul class="card-meta-list">
            <li><span>📄</span> Pages: <strong>${p.pages}</strong></li>
            <li><span>💾</span> Size: <strong>${p.size}</strong></li>
            <li><span>🛡️</span> Watermark Protected</li>
          </ul>
          <div style="display:flex; gap:0.5rem; margin-top:auto;">
            <button class="btn btn-outline" style="flex:1;" onclick="App.previewPdf('${p.url}')">
              Preview
            </button>
            <button class="btn btn-defence" style="flex:1;" onclick="App.downloadWatermarkedPdf('${p.url}')">
              ⬇ Download
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  // 7. Syllabus
  // "Syllabus: this section pdf enable (i have syllabus pdfs)"
  renderSyllabus() {
    const container = document.getElementById('syllabus-list');
    if (!container) return;

    container.innerHTML = this.state.syllabus.map(s => `
      <div class="content-card">
        <div class="content-card-body">
          <span class="batch-badge" style="background:#e0e7ff; color:#3730a3;">${s.exam} Official</span>
          <h3>${s.title}</h3>
          <p>Complete topic-wise marks distribution, negative marking rules, and physical fitness criteria.</p>
          <ul class="card-meta-list">
            <li><span>📑</span> Exam Pattern & Marks Weightage</li>
            <li><span>📥</span> Downloadable Official PDF</li>
          </ul>
          <div style="display:flex; gap:0.5rem; margin-top:auto;">
            <button class="btn btn-outline" style="flex:1;" onclick="App.previewPdf('${s.url}')">
              Read Online
            </button>
            <button class="btn btn-primary" style="flex:1;" onclick="App.downloadWatermarkedPdf('${s.url}')">
              ⬇ Download PDF
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  // 8. Social Links
  // "Social Links: YouTube चैनल, Telegram ग्रुप और Instagram के डायरेक्ट लिंक साथ में other registration sites के लिंक"
  renderSocialLinks() {
    const container = document.getElementById('social-links-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1.25rem; margin-bottom:2.5rem;">
        <!-- YouTube -->
        <a href="https://www.youtube.com/@skcdefenceacademy" target="_blank" class="home-btn-card" style="text-decoration:none; border-color:#fee2e2;">
          <div class="card-icon-bubble" style="background:#fee2e2; color:#ef4444;">▶</div>
          <h3 style="color:#ef4444;">YouTube Official Channel</h3>
          <p>Daily live classes, GD preparation sessions, and exam strategy.</p>
          <span class="btn btn-primary" style="background:#ef4444; color:#fff; margin-top:0.75rem; font-size:0.8rem;">
            Subscribe Channel →
          </span>
        </a>

        <!-- Telegram -->
        <a href="https://t.me/skcdefenceacademy" target="_blank" class="home-btn-card" style="text-decoration:none; border-color:#e0f2fe;">
          <div class="card-icon-bubble" style="background:#e0f2fe; color:#0284c7;">✈</div>
          <h3 style="color:#0284c7;">Telegram Discussion Group</h3>
          <p>Instant PDF notes, daily quiz, and selection updates directly on Telegram.</p>
          <span class="btn btn-primary" style="background:#0284c7; color:#fff; margin-top:0.75rem; font-size:0.8rem;">
            Join Telegram →
          </span>
        </a>

        <!-- Instagram -->
        <a href="https://instagram.com/skcdefenceacademy" target="_blank" class="home-btn-card" style="text-decoration:none; border-color:#fce7f3;">
          <div class="card-icon-bubble" style="background:#fce7f3; color:#db2777;">📷</div>
          <h3 style="color:#db2777;">Instagram Official Page</h3>
          <p>Photos of selected heroes, motivational reels, and academy campus life.</p>
          <span class="btn btn-primary" style="background:#db2777; color:#fff; margin-top:0.75rem; font-size:0.8rem;">
            Follow Instagram →
          </span>
        </a>
      </div>

      <div class="view-header">
        <h2>🛡️ Official Armed Forces Registration & Candidate Portals</h2>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:1rem;">
        <a href="https://agnipathvayu.cdac.in" target="_blank" class="content-card" style="text-decoration:none; padding:1.25rem;">
          <h4 style="color:#0a192f; margin-bottom:0.3rem;">✈️ Indian Airforce Portal</h4>
          <p style="font-size:0.85rem; color:#64748b;">agnipathvayu.cdac.in</p>
          <span style="font-size:0.8rem; color:#0284c7; font-weight:700; margin-top:0.5rem; display:inline-block;">Visit Official Portal →</span>
        </a>

        <a href="https://www.joinindiannavy.gov.in" target="_blank" class="content-card" style="text-decoration:none; padding:1.25rem;">
          <h4 style="color:#0a192f; margin-bottom:0.3rem;">⚓ Join Indian Navy</h4>
          <p style="font-size:0.85rem; color:#64748b;">joinindiannavy.gov.in</p>
          <span style="font-size:0.8rem; color:#0284c7; font-weight:700; margin-top:0.5rem; display:inline-block;">Visit Official Portal →</span>
        </a>

        <a href="https://joinindianarmy.nic.in" target="_blank" class="content-card" style="text-decoration:none; padding:1.25rem;">
          <h4 style="color:#0a192f; margin-bottom:0.3rem;">🎖️ Join Indian Army</h4>
          <p style="font-size:0.85rem; color:#64748b;">joinindianarmy.nic.in</p>
          <span style="font-size:0.8rem; color:#0284c7; font-weight:700; margin-top:0.5rem; display:inline-block;">Visit Official Portal →</span>
        </a>

        <a href="https://joinindiancoastguard.cdac.in" target="_blank" class="content-card" style="text-decoration:none; padding:1.25rem;">
          <h4 style="color:#0a192f; margin-bottom:0.3rem;">🧭 Indian Coast Guard</h4>
          <p style="font-size:0.85rem; color:#64748b;">joinindiancoastguard.cdac.in</p>
          <span style="font-size:0.8rem; color:#0284c7; font-weight:700; margin-top:0.5rem; display:inline-block;">Visit Official Portal →</span>
        </a>
      </div>
    `;
  },

  // 9. Phase-II (GD & SRT) - Priority Section
  // "Phase-II (GD & SRT): Our main Section on priority (in this we includes 02 Batches first one is Airforce GD +SRT & Second is AIRFORCE SRT Batch)"
  renderPhase2() {
    const container = document.getElementById('phase2-container');
    if (!container) return;

    const bGD = this.state.phase2Batches.find(b => b.id === 'phase2_gd_yt');
    const b1 = this.state.phase2Batches.find(b => b.id === 'phase2_1') || this.state.phase2Batches[0];
    const b2 = this.state.phase2Batches.find(b => b.id === 'phase2_2') || this.state.phase2Batches[1];

    const gdCount = (bGD && bGD.gdClasses) ? bGD.gdClasses.length : 3;
    const isB1Purchased = this.state.user && (this.state.user.purchasedCourses || []).includes('phase2_1');
    const isB2Purchased = this.state.user && (this.state.user.purchasedCourses || []).includes('phase2_2');

    container.innerHTML = `
      <div class="phase2-hero-card">
        <span class="batch-badge" style="background:#fef08a; color:#713f12;">TOP PRIORITY SECTION</span>
        <h3>Airforce Phase-II (GD & SRT) Intensive Mastery Program</h3>
        <p style="color:#cbd5e1; max-width:760px; font-size:0.95rem;">
          Phase-II is the crucial gateway to the final merit list! Master Group Discussion (GD) speaking fluency, English presentation, and conquer 45 Situation Reaction Test (SRT) problems under pressure.
        </p>
      </div>

      <div class="phase2-batches-grid">
        <!-- Dedicated Batch: Airforce GD YouTube Special Batch -->
        <div class="batch-box highlight" style="border: 2px solid #f59e0b; background: linear-gradient(180deg, #fffdf5 0%, #ffffff 100%);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span class="batch-badge" style="background:#f59e0b; color:#0a192f; font-weight:800;">
              ⭐ Daily YouTube Classes
            </span>
            <span style="font-size:0.75rem; background:#fee2e2; color:#dc2626; font-weight:700; padding:0.15rem 0.5rem; border-radius:12px;">
              ▶ ${gdCount} Lectures & PDFs
            </span>
          </div>
          <h3 style="font-size:1.3rem; color:#0a192f; margin:0.35rem 0;">AIRFORCE GD SPECIAL BATCH</h3>
          <p style="color:#475569; font-size:0.88rem; margin-bottom:1rem;">
            Special dedicated batch for Airforce Phase-II Group Discussion (GD). Watch daily YouTube lecture classes, follow speaking frameworks, and download official topic PDFs.
          </p>
          <ul class="card-meta-list" style="margin-bottom:1.5rem;">
            <li><span>✓</span> Daily YouTube Video Lectures & Live GD Demonstrations</li>
            <li><span>✓</span> Downloadable Class Notes & Speaking Phrasebook PDFs</li>
            <li><span>✓</span> Top 30+ Trending Defence GD Topics with English Scripts</li>
            <li><span>✓</span> 100% Free & Open Access to All Registered Students</li>
          </ul>
          <div class="card-pricing-row">
            <div class="price-box">
              <span class="current-price" style="color:#10b981;">FREE ACCESS</span>
              <span class="original-price">₹999</span>
            </div>
            <button class="btn btn-primary" style="background:#f59e0b; color:#0a192f; border:none; font-weight:800;" onclick="App.openGdBatchViewer()">
              📹 Open GD Classes & PDFs
            </button>
          </div>
        </div>

        <!-- Batch 1: Airforce GD + SRT Master Course -->
        <div class="batch-box highlight" style="border: 2px solid #0284c7; background: linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span class="batch-badge" style="background:#0284c7; color:#fff; font-weight:800;">
              ⭐ Flagship Program • Dual Folders
            </span>
            <span style="font-size:0.75rem; background:#e0f2fe; color:#0369a1; font-weight:700; padding:0.15rem 0.5rem; border-radius:12px;">
              📁 ${(b1 && b1.youtubeVideos ? b1.youtubeVideos.length : 3)} Videos • ${(b1 && b1.classPdfs ? b1.classPdfs.length : 2)} PDFs
            </span>
          </div>
          <h3 style="font-size:1.3rem; color:#0a192f; margin:0.35rem 0;">Airforce GD + SRT Special Batch</h3>
          <p style="color:#475569; font-size:0.88rem; margin-bottom:1rem;">
            Comprehensive Phase-II master program organized into dedicated folders: daily YouTube video classes, lecture PDF notes, top GD scripts, and interactive SRT simulator.
          </p>
          <ul class="card-meta-list" style="margin-bottom:1.5rem;">
            <li><span>✓</span> 📁 Separate Folder: Daily YouTube Video Classes & Strategy</li>
            <li><span>✓</span> 📁 Separate Folder: Downloadable Class Notes & Speaking PDFs</li>
            <li><span>✓</span> 🎯 Interactive HTML SRT Simulator (45 Situations in 30 Mins)</li>
            <li><span>✓</span> 🗣️ Top 30+ Trending Defence GD Topics with English Scripts</li>
          </ul>
          <div class="card-pricing-row">
            <div class="price-box">
              <span class="current-price">₹${b1 ? b1.price : 99}</span>
              <span class="original-price">₹${b1 ? b1.originalPrice : 499}</span>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button class="btn btn-primary" style="background:#0284c7; border:none; font-weight:800;" onclick="App.openPhase2Viewer('phase2_1')">
                📁 Open GD + SRT Folders
              </button>
              ${isB1Purchased ? `
                <button class="btn btn-defence" onclick="App.openPhase2Viewer('phase2_1')">
                  ▶ Enrolled
                </button>
              ` : `
                <button class="btn btn-outline" onclick="App.openCheckoutModal('course', 'phase2_1', 'Airforce GD + SRT Special Batch', ${b1 ? b1.price : 99})">
                  Enroll
                </button>
              `}
            </div>
          </div>
        </div>

        <!-- Batch 2: AIRFORCE SRT Batch -->
        <div class="batch-box">
          <span class="batch-badge" style="background:#e0f2fe; color:#0369a1;">Batch 02 • HTML Enabled</span>
          <h3 style="font-size:1.3rem; color:#0a192f; margin:0.35rem 0;">AIRFORCE SRT Batch (Situation Reaction Test)</h3>
          <p style="color:#64748b; font-size:0.88rem; margin-bottom:1rem;">
            Dedicated interactive HTML SRT simulator. Complete 45 Situations in 30 minutes with instant psychological score and OLQ rating.
          </p>
          <ul class="card-meta-list" style="margin-bottom:1.5rem;">
            <li><span>✓</span> Interactive HTML SRT Simulator (Time-Pressure Mode)</li>
            <li><span>✓</span> Psychological Scoring & Officer-Like-Qualities Analysis</li>
            <li><span>✓</span> Class PDFs: SRT 100 Solved Situations & Golden Rules</li>
            <li><span>✓</span> YouTube Strategy Videos for Fast Response Formulation</li>
          </ul>
          <div class="card-pricing-row">
            <div class="price-box">
              <span class="current-price">₹${b2 ? b2.price : 49}</span>
              <span class="original-price">₹${b2 ? b2.originalPrice : 199}</span>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-primary" onclick="App.launchSrtSimulator()">
                🚀 Launch SRT
              </button>
              ${isB2Purchased || isB1Purchased ? '' : `
                <button class="btn btn-outline" onclick="App.openCheckoutModal('course', 'phase2_2', 'AIRFORCE SRT Batch', ${b2 ? b2.price : 49})">
                  Enroll
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  openGdBatchViewer() {
    const bGD = (this.state.phase2Batches || []).find(b => b.id === 'phase2_gd_yt');
    const classes = (bGD && bGD.gdClasses) ? bGD.gdClasses : [];
    const modalBody = document.getElementById('generic-modal-body');
    const isAdmin = this.state.user && this.state.user.role === 'admin';
    document.getElementById('generic-modal-title').innerText = 'AIRFORCE GD SPECIAL BATCH • Daily Classes & PDFs';

    modalBody.innerHTML = `
      <div class="gd-batch-viewer">
        <!-- Top Info Header -->
        <div style="background:linear-gradient(135deg, #0a192f 0%, #1e3a8a 100%); color:#fff; padding:1.25rem; border-radius:12px; margin-bottom:1.25rem; border:1.5px solid #f59e0b;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem;">
            <div>
              <span style="background:#f59e0b; color:#0a192f; font-weight:800; font-size:0.72rem; padding:0.2rem 0.5rem; border-radius:4px; text-transform:uppercase;">
                OFFICIAL YOUTUBE BATCH
              </span>
              <h3 style="font-size:1.25rem; margin:0.35rem 0 0.2rem; color:#fff;">Airforce Phase-II Group Discussion (GD) Classes</h3>
              <p style="font-size:0.85rem; color:#cbd5e1; margin:0;">Daily YouTube video lectures by SKC Defence Academy instructors with official lecture notes and speaking PDFs.</p>
            </div>
            ${isAdmin ? `
              <button class="btn btn-primary" style="font-size:0.82rem; background:#f59e0b; color:#0a192f; font-weight:800;" onclick="App.closeModal('generic-modal'); App.switchAdminTab('gd-classes'); App.navigateTo('admin-panel');">
                + Upload New Class
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Published Classes List or Clean Empty State -->
        <div style="display:flex; flex-direction:column; gap:1.15rem;">
          ${classes.length === 0 ? `
            <div class="empty-folder-box">
              <div style="font-size:2.5rem; margin-bottom:0.5rem;">📹</div>
              <h4 style="font-size:1.15rem; color:#0a192f; margin-bottom:0.35rem;">No GD Classes Uploaded Yet</h4>
              <p style="color:#64748b; font-size:0.88rem; max-width:440px; margin:0 auto 1.25rem;">
                Coaching Admin will upload daily YouTube video lectures and study notes here. All published classes will appear here instantly.
              </p>
              ${isAdmin ? `
                <button class="btn btn-primary" style="padding:0.6rem 1.25rem; font-weight:700;" onclick="App.closeModal('generic-modal'); App.switchAdminTab('gd-classes'); App.navigateTo('admin-panel');">
                  + Upload First GD Class
                </button>
              ` : ''}
            </div>
          ` : classes.map((c, idx) => `
            <div class="gd-class-card">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                  <span style="background:#ef4444; color:#fff; font-weight:800; font-size:0.72rem; padding:0.2rem 0.5rem; border-radius:4px; display:inline-flex; align-items:center; gap:0.25rem;">
                    ▶ YouTube Class
                  </span>
                  <span style="background:#e0f2fe; color:#0369a1; font-weight:700; font-size:0.72rem; padding:0.2rem 0.5rem; border-radius:4px;">
                    ${c.topic || 'GD Topic'}
                  </span>
                </div>
                <span style="font-size:0.75rem; color:#64748b;">📅 Uploaded: ${c.date || 'Recent'}</span>
              </div>

              <!-- Responsive Media Layout (200px on desktop, 1-col on mobile) -->
              <div class="gd-card-media-layout">
                <!-- Thumbnail -->
                <div class="gd-card-thumb-container" onclick="App.playVideoModal('${c.youtubeId}', '${c.title.replace(/'/g, "\\'")}')">
                  <img src="https://img.youtube.com/vi/${c.youtubeId}/mqdefault.jpg" onerror="this.src='/uploads/banner.png'">
                  <div class="gd-card-thumb-overlay">
                    <div class="gd-card-play-icon">▶</div>
                  </div>
                </div>

                <!-- Info -->
                <div style="width:100%;">
                  <h4 style="font-size:1.05rem; color:#0a192f; margin-bottom:0.4rem; font-weight:700; line-height:1.35;">${c.title}</h4>
                  <p style="font-size:0.85rem; color:#475569; margin-bottom:0.6rem; line-height:1.4;">${c.notes || 'Official discussion points, speaking framework, and arguments.'}</p>
                  
                  <div style="display:inline-flex; align-items:center; gap:0.5rem; font-size:0.82rem; color:#1e293b; background:#f1f5f9; padding:0.35rem 0.65rem; border-radius:6px; flex-wrap:wrap;">
                    <span>📄 <strong>PDF Notes:</strong> ${c.pdfTitle || 'Class Lecture Notes.pdf'}</span>
                    <span style="color:#64748b;">(${c.pdfSize || '3.5 MB'})</span>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="gd-card-actions-row">
                <button class="btn btn-secondary" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; font-size:0.82rem;" onclick="App.playVideoModal('${c.youtubeId}', '${c.title.replace(/'/g, "\\'")}')">
                  ▶ Watch Class on YouTube
                </button>
                <button class="btn btn-defence" style="font-size:0.82rem;" onclick="App.downloadWatermarkedPdf('${c.pdfUrl || '/uploads/pdfs/phase2_gd_guide.pdf'}')">
                  📥 Download Class PDF Notes
                </button>
                ${isAdmin ? `
                  <button class="btn btn-outline" style="color:#ef4444; border-color:#fca5a5; font-size:0.82rem;" onclick="App.deleteGdClass('${c.id}')">
                    🗑️ Delete
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.openModal('generic-modal');
  },

  openPhase2Viewer(batchId = 'phase2_1', activeFolder = 'youtube') {
    const batch = (this.state.phase2Batches || []).find(b => b.id === batchId) || (this.state.phase2Batches || [])[0];
    if (!batch) return;
    const modalBody = document.getElementById('generic-modal-body');
    const isAdmin = this.state.user && this.state.user.role === 'admin';
    document.getElementById('generic-modal-title').innerText = `${batch.title} • Batch Folders`;

    const videos = batch.youtubeVideos || [];
    const pdfs = batch.classPdfs || [];
    const topics = batch.gdTopics || [];

    modalBody.innerHTML = `
      <div class="phase2-folder-viewer">
        <!-- Banner Header -->
        <div style="background:linear-gradient(135deg, #0a192f 0%, #1e3a8a 100%); color:#fff; padding:1.25rem; border-radius:12px; margin-bottom:1.25rem; border:1.5px solid #38bdf8;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
            <div>
              <span style="background:#38bdf8; color:#0a192f; font-weight:800; font-size:0.72rem; padding:0.2rem 0.55rem; border-radius:4px; text-transform:uppercase;">
                OFFICIAL GD + SRT SPECIAL BATCH
              </span>
              <h3 style="font-size:1.25rem; margin:0.35rem 0 0.2rem; color:#fff;">${batch.title}</h3>
              <p style="font-size:0.85rem; color:#cbd5e1; margin:0;">
                Organized separate folders for YouTube video classes, lecture PDF notes, SRT simulator, and GD speaking scripts.
              </p>
            </div>
            ${isAdmin ? `
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button class="btn btn-primary" style="font-size:0.8rem; background:#38bdf8; color:#0a192f; font-weight:800;" onclick="App.toggleBatchUpload('video')">
                  + 📹 Add Video to YouTube Folder
                </button>
                <button class="btn btn-primary" style="font-size:0.8rem; background:#f59e0b; color:#0a192f; font-weight:800;" onclick="App.toggleBatchUpload('pdf')">
                  + 📑 Upload to PDF Folder
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Admin Inline Upload Container for Video (Only rendered for Admin) -->
        ${isAdmin ? `
          <div id="batch-yt-upload-panel" style="display:none; background:#ffffff; border:1.5px solid #38bdf8; border-radius:10px; padding:1.25rem; margin-bottom:1.25rem; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
              <h4 style="color:#0a192f; margin:0; font-size:1.05rem;">📹 Add New Video Link to YouTube Classes Folder</h4>
              <button type="button" class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="App.toggleBatchUpload('video')">✕ Close</button>
            </div>
            <form id="form-batch-video" onsubmit="App.handleBatchUploadVideo(event, '${batch.id}')">
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:0.75rem; margin-bottom:0.75rem;">
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:700; color:#334155; margin-bottom:0.25rem;">Video Title *</label>
                  <input type="text" id="batch-yt-title" required placeholder="e.g. Airforce GD Class 05: Cyber Warfare in Armed Forces" style="width:100%; padding:0.5rem 0.75rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;">
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:700; color:#334155; margin-bottom:0.25rem;">GD / SRT Topic Name *</label>
                  <input type="text" id="batch-yt-topic" required placeholder="e.g. Technology & Security" style="width:100%; padding:0.5rem 0.75rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;">
                </div>
              </div>
              <div style="margin-bottom:0.75rem;">
                <label style="display:block; font-size:0.8rem; font-weight:700; color:#334155; margin-bottom:0.25rem;">YouTube URL / Video Link *</label>
                <input type="text" id="batch-yt-url" required placeholder="e.g. https://www.youtube.com/watch?v=... or https://youtu.be/..." style="width:100%; padding:0.5rem 0.75rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;">
              </div>
              <div style="margin-bottom:0.75rem;">
                <label style="display:block; font-size:0.8rem; font-weight:700; color:#334155; margin-bottom:0.25rem;">Discussion Summary / Speaking Notes (Optional)</label>
                <textarea id="batch-yt-notes" rows="2" placeholder="Key speaking arguments, framework, and discussion tips for students..." style="width:100%; padding:0.5rem 0.75rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;"></textarea>
              </div>
              <button type="submit" id="btn-submit-batch-video" class="btn btn-primary" style="background:#0284c7; font-weight:700; padding:0.55rem 1.25rem; font-size:0.88rem;">
                💾 Save Video to Folder (Permanent)
              </button>
            </form>
          </div>

          <!-- Admin Inline Upload Container for PDF (Only rendered for Admin) -->
          <div id="batch-pdf-upload-panel" style="display:none; background:#ffffff; border:1.5px solid #f59e0b; border-radius:10px; padding:1.25rem; margin-bottom:1.25rem; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
              <h4 style="color:#0a192f; margin:0; font-size:1.05rem;">📑 Upload New Notes PDF to Study Materials Folder</h4>
              <button type="button" class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="App.toggleBatchUpload('pdf')">✕ Close</button>
            </div>
            <form id="form-batch-pdf" onsubmit="App.handleBatchUploadPdf(event, '${batch.id}')">
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:0.75rem; margin-bottom:0.75rem;">
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:700; color:#334155; margin-bottom:0.25rem;">PDF Document Title *</label>
                  <input type="text" id="batch-pdf-title" required placeholder="e.g. Airforce GD Speaking Script & 50 Solved Topics.pdf" style="width:100%; padding:0.5rem 0.75rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;">
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:700; color:#334155; margin-bottom:0.25rem;">Topic / Subject</label>
                  <input type="text" id="batch-pdf-topic" placeholder="e.g. Phase-II GD Speaking Notes" style="width:100%; padding:0.5rem 0.75rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;">
                </div>
              </div>
              <div style="margin-bottom:0.75rem;">
                <label style="display:block; font-size:0.8rem; font-weight:700; color:#334155; margin-bottom:0.25rem;">Select PDF File from Device</label>
                <input type="file" id="batch-pdf-file" accept=".pdf" style="width:100%; padding:0.45rem; border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc; font-size:0.85rem;">
                <span style="font-size:0.75rem; color:#64748b;">Leave file empty to attach standard Phase-II GD Speaking Guide PDF.</span>
              </div>
              <button type="submit" id="btn-submit-batch-pdf" class="btn btn-primary" style="background:#f59e0b; color:#0a192f; font-weight:800; padding:0.55rem 1.25rem; font-size:0.88rem;">
                💾 Save PDF to Folder (Permanent)
              </button>
            </form>
          </div>
        ` : ''}

        <!-- Folder Navigation Tabs -->
        <div class="folder-nav-tabs">
          <button class="folder-tab-btn ${activeFolder === 'youtube' ? 'active' : ''}" onclick="App.openPhase2Viewer('${batch.id}', 'youtube')">
            📁 YouTube Video Classes Folder (${videos.length})
          </button>
          <button class="folder-tab-btn ${activeFolder === 'pdf' ? 'active' : ''}" onclick="App.openPhase2Viewer('${batch.id}', 'pdf')">
            📁 Class PDFs & Study Materials Folder (${pdfs.length})
          </button>
          <button class="folder-tab-btn ${activeFolder === 'srt' ? 'active' : ''}" onclick="App.openPhase2Viewer('${batch.id}', 'srt')">
            🎯 Interactive HTML SRT Simulator
          </button>
          <button class="folder-tab-btn ${activeFolder === 'topics' ? 'active' : ''}" onclick="App.openPhase2Viewer('${batch.id}', 'topics')">
            🗣️ Top GD Topics & Scripts (${topics.length})
          </button>
        </div>

        <!-- FOLDER CONTENT: YOUTUBE VIDEO CLASSES -->
        ${activeFolder === 'youtube' ? `
          <div class="folder-view-pane">
            <div class="folder-breadcrumb">
              <span>📁 Batch_Root</span>
              <span>›</span>
              <span>Airforce_GD_SRT_Batch</span>
              <span>›</span>
              <span style="color:#0284c7; font-weight:700;">📹 YouTube_Video_Classes/</span>
              <span style="margin-left:auto; font-size:0.75rem; color:#64748b;">${videos.length} videos stored</span>
            </div>

            ${videos.length === 0 ? `
              <div class="empty-folder-box">
                <div style="font-size:2.5rem; margin-bottom:0.5rem;">📹</div>
                <h4 style="font-size:1.15rem; color:#0a192f; margin-bottom:0.35rem;">YouTube Video Classes Folder is Empty</h4>
                <p style="color:#64748b; font-size:0.88rem; max-width:440px; margin:0 auto 1.25rem;">
                  No video classes added yet. Coaching Admin can click "+ Add Video to YouTube Folder" above to add official class links.
                </p>
                ${isAdmin ? `
                  <button class="btn btn-primary" style="padding:0.6rem 1.25rem; font-weight:700;" onclick="App.toggleBatchUpload('video')">
                    + Add Video to YouTube Folder
                  </button>
                ` : ''}
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:1.15rem;">
                ${videos.map(v => `
                  <div class="folder-item-card">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
                      <span style="background:#ef4444; color:#fff; font-size:0.72rem; font-weight:800; padding:0.15rem 0.45rem; border-radius:4px;">▶ YouTube Class</span>
                      <span style="background:#e0f2fe; color:#0369a1; font-size:0.72rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:4px;">${v.topic || 'GD Strategy'}</span>
                      <span style="font-size:0.75rem; color:#64748b; margin-left:auto;">📅 ${v.date || 'Official Lecture'}</span>
                    </div>

                    <!-- Responsive Media Layout (210px on desktop, 1-col on mobile) -->
                    <div class="gd-card-media-layout">
                      <!-- Thumbnail -->
                      <div class="gd-card-thumb-container" onclick="App.playVideoModal('${v.youtubeId}', '${v.title.replace(/'/g, "\\'")}')">
                        <img src="https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg" onerror="this.src='/uploads/banner.png'">
                        <div class="gd-card-thumb-overlay">
                          <div class="gd-card-play-icon">▶</div>
                        </div>
                      </div>

                      <!-- Details -->
                      <div style="width:100%;">
                        <h4 style="font-size:1.02rem; color:#0a192f; margin-bottom:0.35rem; font-weight:700; line-height:1.35;">${v.title}</h4>
                        <p style="font-size:0.83rem; color:#475569; margin-bottom:0.65rem; line-height:1.4;">${v.notes || 'Official discussion points, speaking framework, and arguments.'}</p>
                      </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="gd-card-actions-row">
                      <button class="btn btn-secondary" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; font-size:0.8rem; padding:0.45rem 0.85rem;" onclick="App.playVideoModal('${v.youtubeId}', '${v.title.replace(/'/g, "\\'")}')">
                        ▶ Watch Class Video
                      </button>
                      ${isAdmin ? `
                        <button class="btn btn-outline" style="color:#ef4444; border-color:#fca5a5; font-size:0.8rem; padding:0.45rem 0.75rem;" onclick="App.deleteBatchVideo('${batch.id}', '${v.id}')">
                          🗑️ Delete
                        </button>
                      ` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        ` : ''}

        <!-- FOLDER CONTENT: PDF NOTES & MATERIALS -->
        ${activeFolder === 'pdf' ? `
          <div class="folder-view-pane">
            <div class="folder-breadcrumb">
              <span>📁 Batch_Root</span>
              <span>›</span>
              <span>Airforce_GD_SRT_Batch</span>
              <span>›</span>
              <span style="color:#0284c7; font-weight:700;">📑 PDF_Study_Materials/</span>
              <span style="margin-left:auto; font-size:0.75rem; color:#64748b;">${pdfs.length} files stored</span>
            </div>

            ${pdfs.length === 0 ? `
              <div class="empty-folder-box">
                <div style="font-size:2.5rem; margin-bottom:0.5rem;">📄</div>
                <h4 style="font-size:1.15rem; color:#0a192f; margin-bottom:0.35rem;">PDF Study Materials Folder is Empty</h4>
                <p style="color:#64748b; font-size:0.88rem; max-width:440px; margin:0 auto 1.25rem;">
                  No PDF files uploaded yet. Coaching Admin can click "+ Upload to PDF Folder" above to add official notes.
                </p>
                ${isAdmin ? `
                  <button class="btn btn-primary" style="padding:0.6rem 1.25rem; font-weight:700;" onclick="App.toggleBatchUpload('pdf')">+ Upload to PDF Folder</button>
                ` : ''}
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:0.85rem;">
                ${pdfs.map(p => `
                  <div class="folder-item-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                    <div style="display:flex; align-items:center; gap:0.85rem; flex:1; min-width:220px;">
                      <div style="width:42px; height:42px; border-radius:8px; background:#fee2e2; color:#dc2626; display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:800; flex-shrink:0;">
                        📄
                      </div>
                      <div style="overflow:hidden;">
                        <strong style="color:#0f172a; font-size:0.95rem; display:block; word-break:break-word;">${p.title}</strong>
                        <div style="display:flex; gap:0.5rem; font-size:0.76rem; color:#64748b; margin-top:0.2rem; flex-wrap:wrap;">
                          <span>📊 ${p.size || '3.5 MB'}</span>
                          <span>•</span>
                          <span>📑 ${p.pages || 25} Pages</span>
                          <span>•</span>
                          <span>🏷️ ${p.topic || 'Study Notes'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div class="gd-card-actions-row" style="border:none; padding:0; margin:0;">
                      <button class="btn btn-defence" style="padding:0.45rem 0.9rem; font-size:0.82rem;" onclick="App.downloadWatermarkedPdf('${p.url}')">
                        📥 Download PDF
                      </button>
                      ${isAdmin ? `
                        <button class="btn btn-outline" style="color:#ef4444; border-color:#fca5a5; padding:0.45rem 0.75rem; font-size:0.82rem;" onclick="App.deleteBatchPdf('${batch.id}', '${p.id}')">
                          🗑️ Delete
                        </button>
                      ` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        ` : ''}

        <!-- FOLDER CONTENT: SRT SIMULATOR -->
        ${activeFolder === 'srt' ? `
          <div class="folder-view-pane" style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:1.5rem; text-align:center;">
            <div style="max-width:620px; margin:0 auto;">
              <span style="font-size:2.5rem; display:block; margin-bottom:0.5rem;">🎯</span>
              <h3 style="font-size:1.35rem; color:#0a192f; margin-bottom:0.5rem;">Situation Reaction Test (SRT) Simulator</h3>
              <p style="color:#475569; font-size:0.9rem; line-height:1.5; margin-bottom:1.25rem;">
                Simulate the real IAF Airmen selection test under strict 30-minute exam pressure. Solve 45 military & everyday emergency situations with instant Psychological Profiling and OLQ Assessment.
              </p>
              <div style="display:flex; justify-content:center; gap:1.5rem; margin-bottom:1.5rem; flex-wrap:wrap;">
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem 1.25rem;">
                  <strong style="color:#0284c7; font-size:1.2rem; display:block;">45</strong>
                  <span style="font-size:0.75rem; color:#64748b;">Total Situations</span>
                </div>
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem 1.25rem;">
                  <strong style="color:#ef4444; font-size:1.2rem; display:block;">30 Mins</strong>
                  <span style="font-size:0.75rem; color:#64748b;">Time Pressure</span>
                </div>
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem 1.25rem;">
                  <strong style="color:#10b981; font-size:1.2rem; display:block;">15 OLQs</strong>
                  <span style="font-size:0.75rem; color:#64748b;">Officer Rating</span>
                </div>
              </div>
              <button class="btn btn-primary" style="font-size:1rem; padding:0.75rem 2rem; font-weight:800; background:#0284c7; border:none; box-shadow:0 4px 14px rgba(2, 132, 199, 0.35);" onclick="App.launchSrtSimulator()">
                🚀 Launch Interactive HTML SRT Simulator
              </button>
            </div>
          </div>
        ` : ''}

        <!-- FOLDER CONTENT: GD TOPICS & SCRIPTS -->
        ${activeFolder === 'topics' ? `
          <div class="folder-view-pane">
            <div class="folder-breadcrumb">
              <span>📁 Batch_Root</span>
              <span>›</span>
              <span>Airforce_GD_SRT_Batch</span>
              <span>›</span>
              <span style="color:#0284c7; font-weight:700;">🗣️ Top_GD_Topics_and_Scripts/</span>
              <span style="margin-left:auto; font-size:0.75rem; color:#64748b;">${topics.length} topics</span>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.85rem;">
              ${topics.map(g => `
                <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:10px; padding:1.15rem; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                    <span style="font-size:0.72rem; font-weight:800; color:#0284c7; background:#e0f2fe; padding:0.15rem 0.45rem; border-radius:4px; text-transform:uppercase;">
                      ${g.category || 'Defence Policy'}
                    </span>
                  </div>
                  <h4 style="color:#0f172a; margin:0 0 0.45rem; font-size:1.05rem;">${g.title}</h4>
                  <p style="font-size:0.86rem; color:#475569; margin-bottom:0.5rem; background:#f8fafc; padding:0.6rem; border-left:3px solid #0284c7; border-radius:4px;">
                    <strong>Opening Speech Script:</strong> "${g.introduction}"
                  </p>
                  <div style="font-size:0.82rem; color:#1e293b; margin-bottom:0.5rem;">
                    <strong style="color:#16a34a;">Key Points FOR:</strong>
                    <ul style="margin-left:1.25rem; margin-top:0.25rem;">
                      ${(g.pros || []).map(p => `<li>${p}</li>`).join('')}
                    </ul>
                  </div>
                  ${g.conclusion ? `
                    <p style="font-size:0.82rem; color:#334155; margin:0;">
                      <strong style="color:#0284c7;">Balanced Conclusion:</strong> ${g.conclusion}
                    </p>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    this.openModal('generic-modal');
  },

  toggleBatchUpload(type) {
    if (type === 'video') {
      const p = document.getElementById('batch-yt-upload-panel');
      if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
    } else if (type === 'pdf') {
      const p = document.getElementById('batch-pdf-upload-panel');
      if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
    }
  },

  async handleBatchUploadVideo(event, batchId) {
    event.preventDefault();
    const btn = document.getElementById('btn-submit-batch-video');
    const title = document.getElementById('batch-yt-title').value.trim();
    const topic = document.getElementById('batch-yt-topic').value.trim();
    const youtubeUrl = document.getElementById('batch-yt-url').value.trim();
    const notes = document.getElementById('batch-yt-notes').value.trim();

    if (!title || !youtubeUrl) return alert('Please enter video title and YouTube URL.');

    try {
      if (btn) { btn.disabled = true; btn.innerText = '⏳ Saving Permanently...'; }

      const res = await fetch(`/api/phase2/${batchId}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Role': 'admin',
          'X-Admin-Pin': this.getAdminPin()
        },
        body: JSON.stringify({ title, topic, youtubeUrl, notes })
      });
      const data = await res.json();

      if (data.success) {
        alert('✅ Video class added permanently to YouTube folder! All users can now view it.');
        const p2Res = await fetch('/api/phase2').then(r => r.json());
        if (p2Res.success) this.state.phase2Batches = p2Res.batches;
        this.openPhase2Viewer(batchId, 'youtube');
        this.renderPhase2();
      } else {
        alert('Failed: ' + (data.message || 'Error adding video'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = '💾 Save Video to Folder (Permanent)'; }
    }
  },

  async handleBatchUploadPdf(event, batchId) {
    event.preventDefault();
    const btn = document.getElementById('btn-submit-batch-pdf');
    const title = document.getElementById('batch-pdf-title').value.trim();
    const topic = document.getElementById('batch-pdf-topic').value.trim();
    const fileInput = document.getElementById('batch-pdf-file');

    if (!title) return alert('Please enter PDF document title.');

    try {
      if (btn) { btn.disabled = true; btn.innerText = '⏳ Uploading & Saving...'; }

      const formData = new FormData();
      formData.append('title', title);
      formData.append('topic', topic || 'Phase-II Notes');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        formData.append('pdfFile', fileInput.files[0]);
      } else {
        formData.append('existingPdfUrl', '/uploads/pdfs/phase2_gd_guide.pdf');
      }

      const res = await fetch(`/api/phase2/${batchId}/pdfs`, {
        method: 'POST',
        headers: {
          'X-Admin-Role': 'admin',
          'X-Admin-Pin': this.getAdminPin()
        },
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        alert('✅ PDF study material uploaded permanently to PDF folder! All users can now view it.');
        const p2Res = await fetch('/api/phase2').then(r => r.json());
        if (p2Res.success) this.state.phase2Batches = p2Res.batches;
        this.openPhase2Viewer(batchId, 'pdf');
        this.renderPhase2();
      } else {
        alert('Failed: ' + (data.message || 'Error uploading PDF'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = '💾 Save PDF to Folder (Permanent)'; }
    }
  },

  async deleteBatchVideo(batchId, videoId) {
    if (!confirm('Are you sure you want to delete this YouTube video from the folder? It will be permanently removed for all users.')) return;
    try {
      const res = await fetch(`/api/phase2/${batchId}/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
          'X-Admin-Role': 'admin',
          'X-Admin-Pin': this.getAdminPin()
        }
      });
      const data = await res.json();
      if (data.success) {
        alert('Video removed successfully.');
        const p2Res = await fetch('/api/phase2').then(r => r.json());
        if (p2Res.success) this.state.phase2Batches = p2Res.batches;
        this.openPhase2Viewer(batchId, 'youtube');
        this.renderPhase2();
      } else {
        alert('Failed: ' + (data.message || 'Could not delete video'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  async deleteBatchPdf(batchId, pdfId) {
    if (!confirm('Are you sure you want to delete this PDF file from the folder? It will be permanently removed for all users.')) return;
    try {
      const res = await fetch(`/api/phase2/${batchId}/pdfs/${pdfId}`, {
        method: 'DELETE',
        headers: {
          'X-Admin-Role': 'admin',
          'X-Admin-Pin': this.getAdminPin()
        }
      });
      const data = await res.json();
      if (data.success) {
        alert('PDF removed successfully.');
        const p2Res = await fetch('/api/phase2').then(r => r.json());
        if (p2Res.success) this.state.phase2Batches = p2Res.batches;
        this.openPhase2Viewer(batchId, 'pdf');
        this.renderPhase2();
      } else {
        alert('Failed: ' + (data.message || 'Could not delete PDF'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  launchSrtSimulator() {
    this.closeModal('generic-modal');
    this.navigateTo('srt-viewport');
    window.srtEngineInstance = new SRTEngine(this.state.srtScenarios, (result) => {
      App.showSrtResult(result);
    });
    window.srtEngineInstance.start();
  },

  showSrtResult(result) {
    const container = document.getElementById('srt-viewport');
    if (!container) return;

    container.innerHTML = `
      <div class="analytics-card">
        <div class="score-hero-banner" style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border:2px solid #ca8a04;">
          <span style="color:#facc15; font-weight:800; text-transform:uppercase; font-size:0.85rem;">
            Psychological Response Report
          </span>
          <h2 style="font-size:1.8rem; margin:0.35rem 0 1rem; color:#fff;">Airforce Situation Reaction Test (SRT) Result</h2>
          <div class="score-big-circle" style="border-color:#facc15;">
            <strong style="color:#facc15;">${result.olqScore}%</strong>
            <span>OLQ Match</span>
          </div>
          <p style="color:#e2e8f0; font-size:1.05rem;">
            Psychological Recommendation: <strong style="color:#34d399;">${result.rating}</strong>
          </p>
        </div>

        <div class="analytics-kpi-grid">
          <div class="kpi-tile">
            <strong>${result.total}</strong>
            <span>Total Situations</span>
          </div>
          <div class="kpi-tile">
            <strong style="color:#0284c7;">${result.attempted}</strong>
            <span>Reacted In Time</span>
          </div>
          <div class="kpi-tile">
            <strong style="color:#10b981;">${result.bestCount}</strong>
            <span>Optimal Decision</span>
          </div>
        </div>

        <h3 style="font-size:1.25rem; color:#0a192f; margin-bottom:1rem; font-weight:800;">
          Situation-by-Situation Psychological Evaluation
        </h3>

        <div>
          ${result.scenarios.map((s, idx) => {
            const userPick = result.responses[s.id];
            const isBest = userPick === s.bestAnswer;
            return `
              <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:1.25rem; margin-bottom:1rem; border-left:5px solid ${isBest ? '#10b981' : '#f59e0b'};">
                <p style="font-weight:700; color:#0f172a; margin-bottom:0.5rem;">${s.situation}</p>
                <div style="font-size:0.9rem; margin-bottom:0.5rem;">
                  <strong>Your Selected Reaction:</strong> ${userPick !== undefined ? s.options[userPick] : '<span style="color:#ef4444;">No reaction in time</span>'}
                </div>
                <div style="font-size:0.85rem; color:#166534; background:#f0fdf4; padding:0.5rem 0.75rem; border-radius:6px; margin-bottom:0.4rem;">
                  <strong>Officer Like Qualities Assessed:</strong> ${s.olq}
                </div>
                <div style="font-size:0.85rem; color:#475569;">
                  <strong>Psychologist Insight:</strong> ${s.explanation}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="text-align:center; margin-top:2rem;">
          <button class="btn btn-primary" onclick="App.navigateTo('phase2')">
            ← Back to Phase-II Portal
          </button>
        </div>
      </div>
    `;
  },

  // 10. Current Affairs
  // "Current Affairs: In this we have 02 section First :weekly Second: Monthly"
  renderCurrentAffairs() {
    const weeklyContainer = document.getElementById('ca-weekly-list');
    const monthlyContainer = document.getElementById('ca-monthly-list');

    if (weeklyContainer) {
      weeklyContainer.innerHTML = (this.state.currentAffairs.weekly || []).map(w => `
        <div class="content-card" style="margin-bottom:1rem;">
          <div class="content-card-body">
            <span class="batch-badge" style="background:#ccfbf1; color:#0f766e;">Weekly Defence Capsule • ${w.date}</span>
            <h3>${w.title}</h3>
            <p>${w.summary}</p>
            <div style="background:#f8fafc; border-radius:8px; padding:0.75rem; margin-bottom:1rem;">
              <strong style="font-size:0.85rem; color:#0f172a;">Key Defence Highlights:</strong>
              <ul style="font-size:0.82rem; color:#475569; margin-left:1.25rem; margin-top:0.35rem;">
                ${(w.highlights || []).map(h => `<li>${h}</li>`).join('')}
              </ul>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-defence" style="flex:1;" onclick="App.downloadWatermarkedPdf('${w.pdfUrl}')">
                ⬇ Download Weekly PDF (Watermarked)
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }

    if (monthlyContainer) {
      monthlyContainer.innerHTML = (this.state.currentAffairs.monthly || []).map(m => `
        <div class="content-card" style="margin-bottom:1rem;">
          <div class="content-card-body">
            <span class="batch-badge" style="background:#e0f2fe; color:#0369a1;">Monthly E-Magazine • ${m.pages} Pages</span>
            <h3>${m.title}</h3>
            <p>${m.summary}</p>
            <div class="card-pricing-row" style="margin-top:auto;">
              <span style="font-size:0.85rem; color:#64748b;">Includes 200+ Practice MCQs</span>
              <button class="btn btn-primary" onclick="App.downloadWatermarkedPdf('${m.pdfUrl}')">
                ⬇ Download Magazine
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }
  },

  // 11. My Courses / Student Library
  // "My Courses / My Library: जहाँ स्टूडेंट अपने खरीदे हुए 'Paid Courses' और 'Paid Test Series' देख सकें"
  renderMyCourses() {
    const coursesCont = document.getElementById('my-enrolled-courses');
    const testsCont = document.getElementById('my-enrolled-tests');

    const user = this.state.user;
    if (!user) {
      if (coursesCont) coursesCont.innerHTML = `<p>Please log in to view your library.</p>`;
      return;
    }

    const myCourses = this.state.courses.filter(c => (user.purchasedCourses || []).includes(c.id));
    const myTests = this.state.paidTestSeries.filter(s => (user.purchasedTests || []).includes(s.id));

    if (coursesCont) {
      if (myCourses.length === 0) {
        coursesCont.innerHTML = `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:2rem; text-align:center; color:#64748b;">
            <p>You have not enrolled in any paid course yet.</p>
            <button class="btn btn-primary" style="margin-top:0.75rem;" onclick="App.navigateTo('paid-courses')">Browse Paid Courses</button>
          </div>
        `;
      } else {
        coursesCont.innerHTML = myCourses.map(c => `
          <div class="content-card">
            <div class="content-card-body">
              <span class="batch-badge" style="background:#dcfce7; color:#15803d;">Active Enrollment</span>
              <h3>${c.title}</h3>
              <p>${c.description}</p>
              <div style="margin-top:auto; padding-top:1rem;">
                <button class="btn btn-defence" style="width:100%;" onclick="App.openCourseViewer('${c.id}')">
                  ▶ Open Course Classroom
                </button>
              </div>
            </div>
          </div>
        `).join('');
      }
    }

    if (testsCont) {
      if (myTests.length === 0) {
        testsCont.innerHTML = `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:2rem; text-align:center; color:#64748b;">
            <p>You have not unlocked any paid test series yet.</p>
            <button class="btn btn-primary" style="margin-top:0.75rem;" onclick="App.navigateTo('paid-test-series')">View Test Series</button>
          </div>
        `;
      } else {
        testsCont.innerHTML = myTests.map(s => `
          <div class="content-card">
            <div class="content-card-body">
              <span class="batch-badge" style="background:#dcfce7; color:#15803d;">Series Unlocked</span>
              <h3>${s.title}</h3>
              <p>Includes all upcoming mocks added by faculty.</p>
              <button class="btn btn-primary" style="margin-top:auto;" onclick="App.navigateTo('paid-test-series'); App.selectPtsCategory('${s.name}');">
                Take Mock Tests
              </button>
            </div>
          </div>
        `).join('');
      }
    }
  },

  // 12. ADMIN PANEL
  // "3. Admin Panel (For Coaching Owner/Staff)"
  // "Separate User and Admin Interface"
  async renderAdminPanel() {
    if (!this.state.user || this.state.user.role !== 'admin') {
      const pin = prompt('Enter Coaching Admin Passcode / Secret Name:');
      if (pin && (pin.toLowerCase() === 'skcadmin2026' || pin === 'skcadmin@2026' || pin === 'admin123')) {
        this.state.user = {
          id: 'usr_admin',
          name: 'SKC Admin',
          phone: '9876543210',
          email: 'Skcdefenceacademy@gmail.com',
          role: 'admin',
          adminPin: 'skcadmin2026',
          purchasedCourses: ['course_1', 'course_2', 'course_3', 'phase2_1', 'phase2_2', 'ebook_1'],
          purchasedTests: ['pts_airforce', 'pts_navy', 'pts_icg', 'pts_army']
        };
        localStorage.setItem('skc_active_user', JSON.stringify(this.state.user));
        localStorage.setItem('skc_admin_pin', 'skcadmin2026');
        this.updateUserUI();
      } else {
        alert('Access Denied: Only Coaching Owner/Admin is authorized.');
        this.navigateTo('home');
        return;
      }
    }

    // Fetch live users and orders
    try {
      const [uRes, oRes] = await Promise.all([
        fetch('/api/users').then(r => r.json()),
        fetch('/api/orders').then(r => r.json())
      ]);
      if (uRes.success) this.state.users = uRes.data;
      if (oRes.success) this.state.orders = oRes.data;
    } catch (e) {}

    this.switchAdminTab('overview');
  },

  switchAdminTab(tabName) {
    document.querySelectorAll('.admin-menu-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const pane = document.getElementById('admin-pane-container');
    if (!pane) return;

    if (tabName === 'overview') {
      const totalRevenue = (this.state.orders || []).reduce((acc, o) => acc + (o.amount || 0), 0);
      const allUsers = (this.state.users || []).filter(u => u.role !== 'admin');
      const gdSrtStudents = allUsers.filter(u => (u.purchasedCourses || []).includes('phase2_1')).length;
      const srtOnlyStudents = allUsers.filter(u => (u.purchasedCourses || []).includes('phase2_2')).length;
      pane.innerHTML = `
        <h3 style="font-size:1.35rem; color:#0a192f; margin-bottom:1.25rem;">Coaching Overview & Real-Time Statistics</h3>
        <div class="analytics-kpi-grid">
          <div class="kpi-tile" style="border-top:3px solid #0a192f;">
            <strong>${allUsers.length}</strong>
            <span>Total Students</span>
          </div>
          <div class="kpi-tile" style="border-top:3px solid #0284c7;">
            <strong style="color:#0284c7;">${gdSrtStudents}</strong>
            <span>GD + SRT (₹99)</span>
          </div>
          <div class="kpi-tile" style="border-top:3px solid #10b981;">
            <strong style="color:#10b981;">${srtOnlyStudents}</strong>
            <span>Only SRT (₹49)</span>
          </div>
          <div class="kpi-tile" style="border-top:3px solid #16a34a;">
            <strong style="color:#16a34a;">₹${totalRevenue.toLocaleString()}</strong>
            <span>Total Revenue</span>
          </div>
          <div class="kpi-tile" style="border-top:3px solid #6366f1;">
            <strong style="color:#6366f1;">${this.state.courses ? this.state.courses.length : 3}</strong>
            <span>Active Courses</span>
          </div>
          <div class="kpi-tile" style="border-top:3px solid #f59e0b;">
            <strong style="color:#f59e0b;">${this.state.selections ? this.state.selections.length : 19}</strong>
            <span>Selection Heroes</span>
          </div>
        </div>

        <div style="margin-top:2rem;">
          <h4 style="font-size:1.1rem; color:#0a192f; margin-bottom:0.75rem;">Recent Enrolled Student Orders</h4>
          <div class="custom-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Student Name</th>
                  <th>Purchased Item</th>
                  <th>Amount</th>
                  <th>Gateway</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${(this.state.orders || []).map(o => `
                  <tr>
                    <td><strong>${o.id}</strong></td>
                    <td>${o.studentName}</td>
                    <td>${o.item}</td>
                    <td><strong style="color:#10b981;">₹${o.amount}</strong></td>
                    <td>${o.gateway}</td>
                    <td><span style="background:#dcfce7; color:#15803d; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem;">SUCCESS</span></td>
                    <td>${o.date}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (tabName === 'gd-classes') {
      const bGD = (this.state.phase2Batches || []).find(b => b.id === 'phase2_gd_yt');
      const classes = (bGD && bGD.gdClasses) ? bGD.gdClasses : [];

      pane.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <h3 style="font-size:1.35rem; color:#0a192f; margin-bottom:0.25rem;">📹 Airforce GD YouTube Classes & PDFs Manager</h3>
            <p style="color:#64748b; font-size:0.88rem;">Upload YouTube GD class links and lecture PDFs here. Anything you upload is permanently saved in the database and instantly visible to all users.</p>
          </div>
          <button class="btn btn-outline" onclick="App.openGdBatchViewer()">👁️ Preview Public Student View</button>
        </div>

        <!-- Upload Form -->
        <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; padding:1.5rem; margin-bottom:2rem; box-shadow:var(--shadow);">
          <h4 style="font-size:1.1rem; color:#0a192f; margin-bottom:1rem; display:flex; align-items:center; gap:0.4rem;">
            <span>📤 Upload & Publish New GD YouTube Class</span>
          </h4>
          <div id="gd-form-alert" style="display:none; margin-bottom:1rem; padding:0.75rem 1rem; border-radius:8px; font-weight:700;"></div>
          <form id="admin-gd-class-form" onsubmit="App.handleUploadGdClass(event)">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1rem; margin-bottom:1rem;">
              <div>
                <label style="display:block; font-size:0.85rem; font-weight:700; color:#334155; margin-bottom:0.35rem;">Class / Lecture Title *</label>
                <input type="text" id="gd-form-title" class="form-control" placeholder="e.g. Airforce Phase-II GD Class 04: One Nation One Election Debate" required style="width:100%; padding:0.55rem 0.75rem; border:1px solid #cbd5e1; border-radius:8px;">
              </div>
              <div>
                <label style="display:block; font-size:0.85rem; font-weight:700; color:#334155; margin-bottom:0.35rem;">GD Topic Name *</label>
                <input type="text" id="gd-form-topic" class="form-control" placeholder="e.g. Electoral Reforms & Governance" required style="width:100%; padding:0.55rem 0.75rem; border:1px solid #cbd5e1; border-radius:8px;">
              </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1rem; margin-bottom:1rem;">
              <div>
                <label style="display:block; font-size:0.85rem; font-weight:700; color:#334155; margin-bottom:0.35rem;">YouTube Video Link / URL *</label>
                <input type="text" id="gd-form-yturl" class="form-control" placeholder="e.g. https://www.youtube.com/watch?v=... or https://youtu.be/..." required style="width:100%; padding:0.55rem 0.75rem; border:1px solid #cbd5e1; border-radius:8px;">
              </div>
              <div>
                <label style="display:block; font-size:0.85rem; font-weight:700; color:#334155; margin-bottom:0.35rem;">Upload Class Notes PDF File</label>
                <input type="file" id="gd-form-pdffile" accept=".pdf" style="width:100%; padding:0.45rem; border:1px solid #cbd5e1; border-radius:8px; background:#f8fafc;">
                <span style="font-size:0.75rem; color:#64748b;">Optional: select a PDF file, or leave empty to use default GD guide.</span>
              </div>
            </div>

            <div style="margin-bottom:1.25rem;">
              <label style="display:block; font-size:0.85rem; font-weight:700; color:#334155; margin-bottom:0.35rem;">Discussion Summary & Speaking Notes (Optional)</label>
              <textarea id="gd-form-notes" class="form-control" rows="2" placeholder="Key arguments, opening statement, and concluding remarks for students..." style="width:100%; padding:0.55rem 0.75rem; border:1px solid #cbd5e1; border-radius:8px;"></textarea>
            </div>

            <button type="submit" id="gd-upload-submit-btn" class="btn btn-primary" style="padding:0.65rem 1.5rem; font-size:0.92rem; font-weight:700;">
              🚀 Upload & Publish GD Class to All Users
            </button>
          </form>
        </div>

        <!-- Real-time List of Uploaded Classes -->
        <h4 style="font-size:1.15rem; color:#0a192f; margin-bottom:1rem;">📋 Currently Published GD Classes (${classes.length})</h4>
        <div class="custom-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Video</th>
                <th>Lecture Title</th>
                <th>Topic</th>
                <th>PDF Notes</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${classes.map(c => `
                <tr>
                  <td>
                    <div style="position:relative; width:80px; height:45px; border-radius:4px; overflow:hidden; cursor:pointer;" onclick="App.playVideoModal('${c.youtubeId}', '${c.title.replace(/'/g, "\\'")}')">
                      <img src="https://img.youtube.com/vi/${c.youtubeId}/mqdefault.jpg" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='/uploads/banner.png'">
                      <div style="position:absolute; inset:0; background:rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.75rem;">▶</div>
                    </div>
                  </td>
                  <td><strong>${c.title}</strong></td>
                  <td><span style="background:#e0f2fe; color:#0369a1; padding:0.15rem 0.45rem; border-radius:4px; font-size:0.75rem;">${c.topic}</span></td>
                  <td>
                    <a href="javascript:void(0)" onclick="App.downloadWatermarkedPdf('${c.pdfUrl || '/uploads/pdfs/phase2_gd_guide.pdf'}')" style="color:#0284c7; font-size:0.82rem; text-decoration:none; font-weight:600;">
                      📄 ${c.pdfTitle || 'Notes.pdf'}
                    </a>
                  </td>
                  <td><span style="font-size:0.8rem; color:#64748b;">${c.date}</span></td>
                  <td>
                    <div style="display:flex; gap:0.4rem;">
                      <button class="btn btn-outline" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="App.playVideoModal('${c.youtubeId}', '${c.title.replace(/'/g, "\\'")}')">▶ Play</button>
                      <button class="btn btn-secondary" style="background:#fee2e2; color:#ef4444; padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="App.deleteGdClass('${c.id}')">🗑️ Delete</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (tabName === 'courses') {
      pane.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
          <h3 style="font-size:1.35rem; color:#0a192f;">Manage Paid Courses</h3>
          <button class="btn btn-primary" onclick="App.openAddCourseModal()">+ Create New Course</button>
        </div>
        <div class="custom-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Course Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Videos</th>
                <th>PDFs</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.state.courses.map(c => `
                <tr>
                  <td><strong>${c.title}</strong></td>
                  <td>${c.category}</td>
                  <td>₹${c.price}</td>
                  <td>${c.videos ? c.videos.length : 0}</td>
                  <td>${c.pdfs ? c.pdfs.length : 0}</td>
                  <td>
                    <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="App.openCourseViewer('${c.id}')">Manage Content</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (tabName === 'test-series') {
      pane.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
          <h3 style="font-size:1.35rem; color:#0a192f;">Test Series Content Manager</h3>
        </div>
        <p style="color:#64748b; font-size:0.9rem; margin-bottom:1.25rem;">
          Add mock test papers to official categories (Airforce, Navy, ICG, Army) or Free Tests.
        </p>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem;">
          ${['Airforce', 'Navy', 'ICG', 'Army'].map(cat => `
            <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; padding:1.25rem;">
              <h4 style="color:#0a192f; margin-bottom:0.5rem;">${cat} Test Series</h4>
              <button class="btn btn-primary" style="width:100%; font-size:0.82rem;" onclick="App.openAddTestModal('${cat}')">
                + Add ${cat} Mock Test
              </button>
            </div>
          `).join('')}
        </div>
      `;
    } else if (tabName === 'users') {
      const allStudents = (this.state.users || []).filter(u => u.role !== 'admin');
      const paidStudents = allStudents.filter(u => (u.purchasedCourses || []).length > 0);
      const gdSrtStudents = allStudents.filter(u => (u.purchasedCourses || []).includes('phase2_1'));
      const srtOnlyStudents = allStudents.filter(u => (u.purchasedCourses || []).includes('phase2_2'));
      const freeStudents = allStudents.filter(u => (!u.purchasedCourses || u.purchasedCourses.length === 0));

      const courseBadgeMap = {
        'phase2_1': '<span style="background:#e0f2fe; color:#0369a1; padding:2px 7px; border-radius:4px; font-weight:700; font-size:0.75rem; display:inline-block; margin:2px;">🎯 GD + SRT (₹99)</span>',
        'phase2_2': '<span style="background:#dcfce7; color:#15803d; padding:2px 7px; border-radius:4px; font-weight:700; font-size:0.75rem; display:inline-block; margin:2px;">🚀 Only SRT (₹49)</span>',
        'phase2_gd_yt': '<span style="background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:4px; font-weight:700; font-size:0.75rem; display:inline-block; margin:2px;">📹 GD Free</span>',
        'course_1': '<span style="background:#ede9fe; color:#5b21b6; padding:2px 7px; border-radius:4px; font-weight:700; font-size:0.75rem; display:inline-block; margin:2px;">✈️ Airforce Complete</span>',
        'course_2': '<span style="background:#e0e7ff; color:#3730a3; padding:2px 7px; border-radius:4px; font-weight:700; font-size:0.75rem; display:inline-block; margin:2px;">⚓ Navy SSR/MR</span>',
        'course_3': '<span style="background:#fee2e2; color:#991b1b; padding:2px 7px; border-radius:4px; font-weight:700; font-size:0.75rem; display:inline-block; margin:2px;">🎖️ Army GD</span>',
        'ebook_1': '<span style="background:#f1f5f9; color:#334155; padding:2px 7px; border-radius:4px; font-weight:700; font-size:0.75rem; display:inline-block; margin:2px;">📖 E-Book</span>'
      };

      const examLabels = {
        'airforce': '✈️ Airforce X/Y',
        'phase2': '🎯 Phase-II (GD & SRT)',
        'navy': '⚓ Navy SSR/MR',
        'army': '🎖️ Army GD',
        'icg': '🛡️ Coast Guard'
      };

      pane.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:1rem;">
          <div>
            <h3 style="font-size:1.35rem; color:#0a192f; margin:0 0 0.25rem;">👥 Registered Students & Admissions Directory</h3>
            <p style="color:#64748b; font-size:0.88rem; margin:0;">
              Real-time tracker of student signups, target exams, contact numbers, and batch enrollment status.
            </p>
          </div>
          <button class="btn btn-primary" onclick="App.refreshUsersList()" style="font-size:0.82rem; padding:0.4rem 0.85rem;">
            🔄 Refresh List
          </button>
        </div>

        <!-- Student Summary Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; margin-bottom:1.25rem;">
          <div style="background:#0a192f; color:#fff; padding:0.9rem 1rem; border-radius:10px; border-left:4px solid #38bdf8;">
            <div style="font-size:0.75rem; color:#94a3b8; text-transform:uppercase;">Total Registered</div>
            <div style="font-size:1.4rem; font-weight:800; color:#fff;">${allStudents.length} Students</div>
          </div>
          <div style="background:#fff; border:1px solid #e2e8f0; padding:0.9rem 1rem; border-radius:10px; border-left:4px solid #0284c7; box-shadow:var(--shadow);">
            <div style="font-size:0.75rem; color:#64748b; text-transform:uppercase;">GD + SRT Batch (₹99)</div>
            <div style="font-size:1.4rem; font-weight:800; color:#0284c7;">${gdSrtStudents.length} Enrolled</div>
          </div>
          <div style="background:#fff; border:1px solid #e2e8f0; padding:0.9rem 1rem; border-radius:10px; border-left:4px solid #10b981; box-shadow:var(--shadow);">
            <div style="font-size:0.75rem; color:#64748b; text-transform:uppercase;">Only SRT Batch (₹49)</div>
            <div style="font-size:1.4rem; font-weight:800; color:#10b981;">${srtOnlyStudents.length} Enrolled</div>
          </div>
          <div style="background:#fff; border:1px solid #e2e8f0; padding:0.9rem 1rem; border-radius:10px; border-left:4px solid #f59e0b; box-shadow:var(--shadow);">
            <div style="font-size:0.75rem; color:#64748b; text-transform:uppercase;">Free / New Aspirants</div>
            <div style="font-size:1.4rem; font-weight:800; color:#f59e0b;">${freeStudents.length} Pending</div>
          </div>
        </div>

        <!-- Filter & Search Row -->
        <div style="display:flex; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap; align-items:center;">
          <input type="text" id="student-search-input" onkeyup="App.filterStudentsTable()" placeholder="🔍 Search by student name or mobile number..." style="flex:1; min-width:240px; padding:0.55rem 0.85rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.88rem;">
          <select id="student-exam-filter" onchange="App.filterStudentsTable()" style="padding:0.55rem 0.85rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.88rem; background:#fff; font-weight:600;">
            <option value="all">All Target Exams</option>
            <option value="phase2">Airforce Phase-II (GD & SRT)</option>
            <option value="airforce">Indian Airforce (Agniveer Vayu)</option>
            <option value="navy">Indian Navy (SSR / MR)</option>
            <option value="army">Indian Army (Agniveer GD)</option>
            <option value="icg">Indian Coast Guard (ICG)</option>
          </select>
        </div>

        <div class="custom-table-wrapper">
          <table class="data-table" id="students-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Mobile & Direct WhatsApp</th>
                <th>Target Exam</th>
                <th>Status & Batches</th>
                <th>Joined Date</th>
                <th>Access Control</th>
              </tr>
            </thead>
            <tbody>
              ${allStudents.length === 0 ? `
                <tr><td colspan="6" style="text-align:center; padding:2rem; color:#64748b;">No students registered yet. They will appear here immediately as they visit or log in.</td></tr>
              ` : allStudents.map(u => {
                const isPaid = (u.purchasedCourses || []).length > 0;
                const examText = examLabels[u.targetExam] || u.targetExam || '✈️ Airforce X/Y';
                return `
                  <tr class="student-row" data-name="${(u.name || '').toLowerCase()}" data-phone="${u.phone || ''}" data-exam="${u.targetExam || 'airforce'}">
                    <td>
                      <strong style="color:#0a192f; font-size:0.95rem;">${u.name}</strong>
                      <div style="color:#64748b; font-size:0.75rem;">ID: ${u.id}</div>
                    </td>
                    <td>
                      <strong>${u.phone || 'N/A'}</strong><br>
                      ${u.phone ? `
                        <a href="https://wa.me/91${u.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(u.name)},%20welcome%20to%20SKC%20Defence%20Academy!%20How%20is%20your%20defence%20preparation%20going?" target="_blank" style="display:inline-flex; align-items:center; gap:3px; margin-top:3px; padding:2px 8px; background:#25D366; color:#fff; font-size:0.72rem; border-radius:4px; text-decoration:none; font-weight:700;">
                          💬 Chat on WhatsApp
                        </a>
                      ` : ''}
                    </td>
                    <td>
                      <span style="background:#f1f5f9; color:#0f172a; padding:3px 8px; border-radius:20px; font-size:0.76rem; font-weight:700; border:1px solid #e2e8f0;">
                        ${examText}
                      </span>
                    </td>
                    <td>
                      <div style="margin-bottom:3px;">
                        ${isPaid ? `
                          <span style="background:#dcfce7; color:#15803d; padding:2px 6px; border-radius:4px; font-size:0.72rem; font-weight:800;">ENROLLED (PAID)</span>
                        ` : `
                          <span style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:0.72rem; font-weight:800;">FREE ASPIRANT</span>
                        `}
                      </div>
                      ${(u.purchasedCourses || []).length > 0
                        ? (u.purchasedCourses || []).map(cId => courseBadgeMap[cId] || `<span style="font-size:0.75rem;">${cId}</span>`).join('')
                        : '<span style="color:#94a3b8; font-size:0.78rem;">No paid batch yet</span>'}
                    </td>
                    <td>
                      <span style="font-size:0.8rem; color:#64748b;">${u.joinedDate || 'Recent'}</span>
                    </td>
                    <td>
                      <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                        <button class="btn btn-defence" style="padding:0.35rem 0.65rem; font-size:0.75rem;" onclick="App.grantUserAccessPrompt('${u.id}')" title="Grant course or batch access">
                          + Grant
                        </button>
                        ${isPaid ? `
                          <button class="btn btn-outline" style="padding:0.35rem 0.65rem; font-size:0.75rem; color:#ef4444; border-color:#fca5a5;" onclick="App.revokeUserAccessPrompt('${u.id}')" title="Revoke batch access">
                            ✕ Revoke
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (tabName === 'selections') {
      pane.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
          <h3 style="font-size:1.35rem; color:#0a192f;">Manage "OUR Selections" Slideshow</h3>
          <button class="btn btn-primary" onclick="App.openAddSelectionModal()">+ Add New Selection Hero</button>
        </div>
        <div class="custom-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Candidate Name</th>
                <th>Exam</th>
                <th>Intake / Batch</th>
                <th>Roll No</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.state.selections.map(s => `
                <tr>
                  <td><img src="${s.image}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" onerror="this.src='/uploads/logo.png'"></td>
                  <td><strong>${s.name}</strong></td>
                  <td>${s.exam}</td>
                  <td>${s.intake}</td>
                  <td>${s.rollNo}</td>
                  <td>
                    <button class="btn btn-secondary" style="background:#fee2e2; color:#ef4444; padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="App.deleteSelection('${s.id}')">
                      Remove
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  },

  async handleUploadGdClass(event) {
    event.preventDefault();
    const btn = document.getElementById('gd-upload-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerText = '⏳ Uploading & Saving to Database...';
    }

    try {
      const title = document.getElementById('gd-form-title').value.trim();
      const topic = document.getElementById('gd-form-topic').value.trim();
      const youtubeUrl = document.getElementById('gd-form-yturl').value.trim();
      const notes = document.getElementById('gd-form-notes').value.trim();
      const fileInput = document.getElementById('gd-form-pdffile');

      const formData = new FormData();
      formData.append('title', title);
      formData.append('topic', topic);
      formData.append('youtubeUrl', youtubeUrl);
      formData.append('notes', notes);

      if (fileInput && fileInput.files && fileInput.files[0]) {
        formData.append('pdfFile', fileInput.files[0]);
      } else {
        formData.append('existingPdfUrl', '/uploads/pdfs/phase2_gd_guide.pdf');
        formData.append('pdfTitle', title + ' Class Notes.pdf');
      }

      const res = await fetch('/api/phase2/gd-classes', {
        method: 'POST',
        headers: {
          'X-Admin-Role': 'admin',
          'X-Admin-Pin': this.getAdminPin()
        },
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        const alertBox = document.getElementById('gd-form-alert');
        if (alertBox) {
          alertBox.style.display = 'block';
          alertBox.style.background = '#dcfce7';
          alertBox.style.color = '#15803d';
          alertBox.style.border = '1px solid #86efac';
          alertBox.innerHTML = '✅ Success! GD YouTube Class & PDF uploaded and published successfully. All students and users can now view it.';
        }
        // Refresh Phase-II batches in state
        const p2Res = await fetch('/api/phase2').then(r => r.json());
        if (p2Res.success) {
          this.state.phase2Batches = p2Res.batches;
        }
        setTimeout(() => {
          this.switchAdminTab('gd-classes');
          this.renderPhase2();
        }, 1000);
      } else {
        const alertBox = document.getElementById('gd-form-alert');
        if (alertBox) {
          alertBox.style.display = 'block';
          alertBox.style.background = '#fee2e2';
          alertBox.style.color = '#dc2626';
          alertBox.innerHTML = '❌ Upload Failed: ' + (data.message || 'Unknown error');
        }
      }
    } catch (err) {
      console.error(err);
      const alertBox = document.getElementById('gd-form-alert');
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#fee2e2';
        alertBox.style.color = '#dc2626';
        alertBox.innerHTML = '❌ Error: ' + err.message;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = '🚀 Upload & Publish GD Class to All Users';
      }
    }
  },

  async deleteGdClass(classId) {
    if (!confirm('Are you sure you want to delete this GD class? It will be permanently removed from all users.')) {
      return;
    }

    try {
      const res = await fetch('/api/phase2/gd-classes/' + classId, {
        method: 'DELETE',
        headers: {
          'X-Admin-Role': 'admin',
          'X-Admin-Pin': this.getAdminPin()
        }
      });
      const data = await res.json();
      if (data.success) {
        alert('Class deleted successfully.');
        // Refresh Phase-II batches in state
        const p2Res = await fetch('/api/phase2').then(r => r.json());
        if (p2Res.success) {
          this.state.phase2Batches = p2Res.batches;
        }
        if (this.state.activeView === 'admin-panel') {
          this.switchAdminTab('gd-classes');
        } else {
          this.renderPhase2();
          const modal = document.getElementById('generic-modal');
          if (modal && modal.classList.contains('open')) {
            this.openGdBatchViewer();
          }
        }
      } else {
        alert('Failed to delete class: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Error deleting class: ' + err.message);
    }
  },

  async deleteSelection(id) {
    if (!confirm('Are you sure you want to delete this selection from slideshow?')) return;
    await fetch(`/api/selections/${id}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Pin': this.getAdminPin() }
    });
    this.state.selections = this.state.selections.filter(s => s.id !== id);
    this.renderOurSelectionsSlideshow();
    this.switchAdminTab('selections');
  },

  filterStudentsTable() {
    const search = (document.getElementById('student-search-input')?.value || '').toLowerCase().trim();
    const examFilter = document.getElementById('student-exam-filter')?.value || 'all';
    document.querySelectorAll('.student-row').forEach(row => {
      const name = row.getAttribute('data-name') || '';
      const phone = row.getAttribute('data-phone') || '';
      const exam = row.getAttribute('data-exam') || '';
      const matchesSearch = !search || name.includes(search) || phone.includes(search);
      const matchesExam = examFilter === 'all' || exam === examFilter;
      row.style.display = (matchesSearch && matchesExam) ? '' : 'none';
    });
  },

  async refreshUsersList() {
    try {
      const uRes = await fetch('/api/users').then(r => r.json());
      if (uRes.success) {
        this.state.users = uRes.data;
        this.switchAdminTab('users');
      }
    } catch (e) {
      alert('Error fetching users: ' + e.message);
    }
  },

  grantUserAccessPrompt(userId) {
    const courseId = prompt('Enter Course ID to grant (e.g., phase2_1 [GD+SRT ₹99], phase2_2 [Only SRT ₹49], course_1, course_2, course_3):', 'phase2_1');
    if (!courseId) return;

    fetch(`/api/users/${userId}/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Pin': this.getAdminPin()
      },
      body: JSON.stringify({ type: 'course', itemId: courseId })
    }).then(r => r.json()).then(res => {
      alert('Course / Batch access successfully granted!');
      this.refreshUsersList();
    });
  },

  revokeUserAccessPrompt(userId) {
    const courseId = prompt('Enter Course ID to revoke (e.g. phase2_1, phase2_2, course_1, course_2, course_3):', 'phase2_1');
    if (!courseId) return;

    fetch(`/api/users/${userId}/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Pin': this.getAdminPin()
      },
      body: JSON.stringify({ type: 'course', itemId: courseId })
    }).then(r => r.json()).then(res => {
      alert('Batch access revoked successfully.');
      this.refreshUsersList();
    });
  },

  openAddCourseModal() {
    const modalBody = document.getElementById('generic-modal-body');
    document.getElementById('generic-modal-title').innerText = 'Create New Defence Course';

    modalBody.innerHTML = `
      <form onsubmit="App.saveNewCourse(event)">
        <div class="form-group" style="margin-bottom:0.75rem;">
          <label class="form-label" style="font-weight:700;">Course Title *</label>
          <input type="text" id="nc-title" class="form-control" placeholder="e.g. Airforce Agniveer Vayu Fast-Track Batch" required>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;">
          <div>
            <label class="form-label" style="font-weight:700;">Category</label>
            <select id="nc-category" class="form-control">
              <option value="Airforce">Airforce</option>
              <option value="Navy">Navy</option>
              <option value="Army">Army</option>
              <option value="Coast Guard">Coast Guard</option>
              <option value="Phase-II">Phase-II</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Badge</label>
            <input type="text" id="nc-badge" class="form-control" value="Comprehensive Batch">
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;">
          <div>
            <label class="form-label" style="font-weight:700;">Price (₹) *</label>
            <input type="number" id="nc-price" class="form-control" value="999" required>
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Original Price (₹)</label>
            <input type="number" id="nc-orig-price" class="form-control" value="1999">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0.75rem;">
          <label class="form-label" style="font-weight:700;">Course Description</label>
          <textarea id="nc-desc" class="form-control" rows="2" placeholder="Course highlights, target students, and syllabus coverage..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; padding:0.75rem; font-weight:800;">
          💾 Publish Course (Permanent)
        </button>
      </form>
    `;
    this.openModal('generic-modal');
  },

  async saveNewCourse(e) {
    e.preventDefault();
    const title = document.getElementById('nc-title').value.trim();
    const category = document.getElementById('nc-category').value;
    const badge = document.getElementById('nc-badge').value.trim();
    const price = Number(document.getElementById('nc-price').value);
    const originalPrice = Number(document.getElementById('nc-orig-price').value);
    const description = document.getElementById('nc-desc').value.trim();

    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin': this.getAdminPin()
        },
        body: JSON.stringify({ title, category, badge, price, originalPrice, description })
      }).then(r => r.json());

      if (res.success) {
        alert('Course created successfully!');
        this.state.courses.push(res.data);
        this.closeModal('generic-modal');
        this.switchAdminTab('courses');
        this.renderPaidCourses();
      } else {
        alert('Failed: ' + (res.message || 'Error creating course'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  openAddTestModal(category) {
    const modalBody = document.getElementById('generic-modal-body');
    document.getElementById('generic-modal-title').innerText = `Add New ${category} Mock Test`;

    modalBody.innerHTML = `
      <form id="add-test-form" onsubmit="App.saveNewTest(event, '${category}')">
        <div class="form-group">
          <label class="form-label">Mock Test Title</label>
          <input type="text" id="nt-title" class="form-control" required placeholder="e.g. ${category} Agniveer Full Length Mock 01">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label class="form-label">Duration (Minutes)</label>
            <input type="number" id="nt-duration" class="form-control" value="45" required>
          </div>
          <div class="form-group">
            <label class="form-label">Total Marks</label>
            <input type="number" id="nt-marks" class="form-control" value="50" required>
          </div>
        </div>
        
        <h4 style="margin:1rem 0 0.5rem; color:#0a192f;">Sample MCQ Question 1</h4>
        <div class="form-group">
          <label class="form-label">Question Text</label>
          <input type="text" id="nt-q1" class="form-control" value="Choose the antonym of REVEAL:" required>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
          <input type="text" id="nt-opt0" class="form-control" value="Conceal" placeholder="Option A" required>
          <input type="text" id="nt-opt1" class="form-control" value="Expose" placeholder="Option B" required>
          <input type="text" id="nt-opt2" class="form-control" value="Clarify" placeholder="Option C" required>
          <input type="text" id="nt-opt3" class="form-control" value="Exhibit" placeholder="Option D" required>
        </div>
        <div class="form-group" style="margin-top:0.75rem;">
          <label class="form-label">Correct Option Index (0 for A, 1 for B, 2 for C, 3 for D)</label>
          <select id="nt-ans" class="form-control">
            <option value="0">Option A (Conceal)</option>
            <option value="1">Option B (Expose)</option>
            <option value="2">Option C (Clarify)</option>
            <option value="3">Option D (Exhibit)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Explanation</label>
          <input type="text" id="nt-exp" class="form-control" value="Reveal means to make known. Opposite is conceal.">
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:1rem;">
          Save Test to ${category} Series
        </button>
      </form>
    `;

    this.openModal('generic-modal');
  },

  async saveNewTest(e, category) {
    e.preventDefault();
    const title = document.getElementById('nt-title').value;
    const durationMinutes = Number(document.getElementById('nt-duration').value);
    const totalMarks = Number(document.getElementById('nt-marks').value);
    const q1Text = document.getElementById('nt-q1').value;
    const options = [
      document.getElementById('nt-opt0').value,
      document.getElementById('nt-opt1').value,
      document.getElementById('nt-opt2').value,
      document.getElementById('nt-opt3').value
    ];
    const answer = Number(document.getElementById('nt-ans').value);
    const explanation = document.getElementById('nt-exp').value;

    const payload = {
      title,
      durationMinutes,
      totalMarks,
      positiveMarks: 1.0,
      negativeMarks: 0.25,
      questions: [
        {
          id: 'q_' + Date.now(),
          section: category + ' Subject',
          question: q1Text,
          options,
          answer,
          explanation
        }
      ]
    };

    const res = await fetch(`/api/paid-test-series/${category}/tests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Pin': this.getAdminPin()
      },
      body: JSON.stringify(payload)
    }).then(r => r.json());

    if (res.success) {
      alert(`Test successfully created for ${category}!`);
      this.closeModal('generic-modal');
      // Refresh
      const ptsRes = await fetch('/api/paid-test-series').then(r => r.json());
      if (ptsRes.success) this.state.paidTestSeries = ptsRes.data;
      this.renderPaidTestSeries();
    }
  },

  openAddSelectionModal() {
    const modalBody = document.getElementById('generic-modal-body');
    document.getElementById('generic-modal-title').innerText = 'Add New Selection Candidate';

    modalBody.innerHTML = `
      <form id="add-sel-form" onsubmit="App.saveNewSelection(event)">
        <div class="form-group">
          <label class="form-label">Candidate Full Name</label>
          <input type="text" id="nsel-name" class="form-control" required placeholder="e.g. Rohit Kumar">
        </div>
        <div class="form-group">
          <label class="form-label">Exam Cleared</label>
          <input type="text" id="nsel-exam" class="form-control" required value="Airforce Agniveer Vayu">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label class="form-label">Batch / Intake</label>
            <input type="text" id="nsel-intake" class="form-control" value="Intake 02/2026">
          </div>
          <div class="form-group">
            <label class="form-label">Roll Number</label>
            <input type="text" id="nsel-roll" class="form-control" value="SKC-2026-${Math.floor(1000 + Math.random()*9000)}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Candidate Photo</label>
          <select id="nsel-img" class="form-control">
            <option value="/uploads/selections/1780648688032.png">Hero Photo 1 (Airforce)</option>
            <option value="/uploads/selections/1780649056954.png">Hero Photo 2 (Airforce)</option>
            <option value="/uploads/selections/1780649293539.png">Hero Photo 3 (Navy)</option>
            <option value="/uploads/selections/1780650160848.png">Hero Photo 4 (Army)</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:1rem;">
          Save Selection
        </button>
      </form>
    `;
    this.openModal('generic-modal');
  },

  async saveNewSelection(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('nsel-name').value,
      exam: document.getElementById('nsel-exam').value,
      intake: document.getElementById('nsel-intake').value,
      rollNo: document.getElementById('nsel-roll').value,
      image: document.getElementById('nsel-img').value
    };

    const res = await fetch('/api/selections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Pin': this.getAdminPin()
      },
      body: JSON.stringify(payload)
    }).then(r => r.json());

    if (res.success) {
      this.state.selections.unshift(res.data);
      this.renderOurSelectionsSlideshow();
      this.closeModal('generic-modal');
      alert('Candidate added to slideshow successfully!');
    }
  },

  // 13. Dynamic PDF Watermarking Download
  // "Piracy Protection:- when students download pdf automatically SKC DEFENCE ACADEMY watermark comes in downloaded pdf file"
  downloadWatermarkedPdf(pdfPath) {
    const user = this.state.user || { name: 'Aspirant', phone: 'Verified', id: 'SKC-999' };
    const cleanFilename = pdfPath.split('/').pop();
    const downloadUrl = `/api/pdf/download?file=${cleanFilename}&studentName=${encodeURIComponent(user.name)}&studentPhone=${encodeURIComponent(user.phone)}&studentId=${encodeURIComponent(user.id)}`;
    
    // Trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `SKC_DEFENCE_${cleanFilename}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  previewPdf(pdfUrl) {
    const user = this.state.user || { name: 'Student Aspirant', phone: '9876543210' };
    const modalBody = document.getElementById('generic-modal-body');
    document.getElementById('generic-modal-title').innerText = 'Protected Study Material Viewer';

    modalBody.innerHTML = `
      <div class="watermark-canvas-container">
        <div class="watermark-ribbon">SKC DEFENCE ACADEMY • ${user.name.toUpperCase()}</div>
        <iframe src="${pdfUrl}#toolbar=0" style="width:100%; height:450px; border:none; background:#fff; border-radius:4px;"></iframe>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem;">
        <span style="font-size:0.8rem; color:#64748b;">🛡️ Watermark & Anti-Piracy Protection Active</span>
        <button class="btn btn-defence" onclick="App.downloadWatermarkedPdf('${pdfUrl}')">
          ⬇ Download Watermarked PDF
        </button>
      </div>
    `;
    this.openModal('generic-modal');
  },

  // 14. Checkout & Payment Gateway Integration
  // "Payment Gateway Integration: Razorpay, PhonePe, या PayU का इंटीग्रेशन ताकि स्टूडेंट्स UPI, Credit/Debit Card या Net Banking से पेमेंट कर सकें"
  openCheckoutModal(itemType, itemId, itemTitle, amount) {
    const modalBody = document.getElementById('checkout-modal-body');
    const user = this.state.user || { name: 'Aakash Verma', phone: '9812345678' };
    const upiId = this.state.academy.upiId || 'skcdefenceacademy@okaxis';

    modalBody.innerHTML = `
      <div style="margin-bottom:1.25rem;">
        <span class="batch-badge" style="background:#e0f2fe; color:#0369a1;">Instant Access</span>
        <h3 style="font-size:1.3rem; color:#0a192f; margin:0.35rem 0;">${itemTitle}</h3>
        <div style="font-size:1.6rem; font-weight:800; color:#15803d; margin-bottom:1rem;">
          Total Payable: ₹${amount}
        </div>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:1.25rem; text-align:center; margin-bottom:1.5rem;">
        <p style="font-weight:700; color:#0f172a; margin-bottom:0.75rem;">⚡ Scan & Pay with Any UPI App (PhonePe, GPay, Paytm)</p>
        
        <!-- Live Generated QR Code -->
        <div style="display:inline-block; padding:10px; background:#fff; border-radius:8px; border:1.5px solid #cbd5e1; margin-bottom:0.75rem;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${encodeURIComponent(upiId)}%26pn=SKC%20DEFENCE%20ACADEMY%26am=${amount}%26cu=INR" alt="UPI QR Code" style="width:170px; height:170px; display:block;">
        </div>

        <p style="font-size:0.85rem; color:#475569;">
          Official Coaching UPI ID: <strong style="color:#0a192f;">${upiId}</strong>
        </p>
      </div>

      <div style="margin-bottom:1.5rem;">
        <label class="form-label">Select Payment Method</label>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem;">
          <button class="btn btn-outline" style="border-color:#5f259f; color:#5f259f;" onclick="App.simulatePayment('${itemType}', '${itemId}', '${itemTitle}', ${amount}, 'PhonePe (UPI)')">
            🟣 PhonePe
          </button>
          <button class="btn btn-outline" style="border-color:#0284c7; color:#0284c7;" onclick="App.simulatePayment('${itemType}', '${itemId}', '${itemTitle}', ${amount}, 'Razorpay (Cards/UPI)')">
            🔵 Razorpay
          </button>
          <button class="btn btn-outline" style="border-color:#16a34a; color:#16a34a;" onclick="App.simulatePayment('${itemType}', '${itemId}', '${itemTitle}', ${amount}, 'PayU (NetBanking)')">
            🟢 PayU
          </button>
        </div>
      </div>

      <button class="btn btn-primary" style="width:100%; padding:0.85rem; font-size:1.05rem;" onclick="App.simulatePayment('${itemType}', '${itemId}', '${itemTitle}', ${amount}, 'UPI QR Direct')">
        ✓ Verify & Unlock Instantly (₹${amount})
      </button>
    `;

    this.openModal('checkout-modal');
  },

  async simulatePayment(itemType, itemId, itemTitle, amount, gateway) {
    const user = this.state.user || { id: 'usr_student1', name: 'Aakash Verma' };
    
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          itemId,
          itemTitle,
          itemType,
          amount,
          gateway,
          paymentRef: 'TXN' + Date.now()
        })
      }).then(r => r.json());

      if (res.success) {
        this.closeModal('checkout-modal');
        this.state.user = res.user;
        localStorage.setItem('skc_active_user', JSON.stringify(this.state.user));
        alert(`🎉 PAYMENT SUCCESSFUL!\n\nTransaction ID: ${res.order.id}\nItem: ${itemTitle}\nAmount: ₹${amount}\n\nThe content is now unlocked in your library!`);
        this.navigateTo('my-courses');
      }
    } catch (err) {
      alert('Payment processing error');
    }
  },

  // 15. Modals Helper
  openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('open');
  },

  closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('open');
  },

  openLoginModal() {
    this.openModal('login-modal');
  },

  openSignupModal() {
    this.openModal('signup-modal');
  },

  playVideoModal(youtubeId, title) {
    const modalBody = document.getElementById('generic-modal-body');
    document.getElementById('generic-modal-title').innerText = title || 'Class Video Lecture';

    modalBody.innerHTML = `
      <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; background:#000;">
        <iframe src="https://www.youtube.com/embed/${youtubeId}?autoplay=1" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;" allowfullscreen allow="autoplay"></iframe>
      </div>
      <div style="margin-top:1rem; text-align:right;">
        <button class="btn btn-outline" onclick="App.closeModal('generic-modal')">Close Video</button>
      </div>
    `;
    this.openModal('generic-modal');
  },

  startHtmlMock(title) {
    alert(`Starting interactive HTML mock: ${title}`);
    this.launchTest('ft_1');
  },

  toggleDigitalBoardMode() {
    this.state.digitalBoardMode = !this.state.digitalBoardMode;
    document.body.classList.toggle('digital-board-mode', this.state.digitalBoardMode);
    const btn = document.getElementById('digital-board-toggle-btn');
    if (btn) {
      btn.innerText = this.state.digitalBoardMode ? '📺 Exit Board Mode' : '📺 75-inch Board Mode';
    }
  },

  bindEvents() {
    // Escape key closes modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
      }
    });

    // Handle resize for slideshow
    window.addEventListener('resize', () => {
      this.updateSlideshowPosition();
    });
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
