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
    selectedPyqCategory: 'all',
    selectedSyllabusCategory: 'all',
    selectedFreeTestCategory: 'all',
    selectedPaidCourseCategory: 'all',
    selectedCaCategory: 'all',
    courseViewActiveFolders: {},
    activePhase2BatchId: 'phase2_1',
    activePhase2Folder: 'srt-mocks',
    activeCourseId: 'course_1',
    activeCourseFolder: 'videos',
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

    // Direct section link via hash
    const initialHash = window.location.hash.replace('#', '').trim();
    if (initialHash && document.getElementById(`view-${initialHash}`)) {
      this.state.activeView = initialHash;
    }

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
        this.state.phase2Batches = p2Res.batches || [];
        this.state.srtScenarios = p2Res.srtScenarios || [];

        // Permanent client-side backup merge
        try {
          const localBackup = localStorage.getItem('skc_permanent_phase2');
          if (localBackup) {
            const cachedBatches = JSON.parse(localBackup);
            if (Array.isArray(cachedBatches)) {
              this.state.phase2Batches.forEach(b => {
                const cb = cachedBatches.find(x => x.id === b.id);
                if (cb) {
                  if (Array.isArray(cb.youtubeVideos)) {
                    const existingVids = new Set((b.youtubeVideos || []).map(v => v.id || v.youtubeId));
                    cb.youtubeVideos.forEach(v => {
                      if (!existingVids.has(v.id || v.youtubeId)) {
                        b.youtubeVideos = b.youtubeVideos || [];
                        b.youtubeVideos.push(v);
                      }
                    });
                  }
                  if (Array.isArray(cb.classPdfs)) {
                    const existingPdfs = new Set((b.classPdfs || []).map(p => p.id || p.title));
                    cb.classPdfs.forEach(p => {
                      if (!existingPdfs.has(p.id || p.title)) {
                        b.classPdfs = b.classPdfs || [];
                        b.classPdfs.push(p);
                      }
                    });
                  }
                  if (Array.isArray(cb.gdClasses)) {
                    const existingGds = new Set((b.gdClasses || []).map(g => g.id || g.youtubeId));
                    cb.gdClasses.forEach(g => {
                      if (!existingGds.has(g.id || g.youtubeId)) {
                        b.gdClasses = b.gdClasses || [];
                        b.gdClasses.push(g);
                      }
                    });
                  }
                }
              });
            }
          }
        } catch (e) {
          console.warn('Phase-2 local merge err:', e);
        }
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
    try {
      if (window.location.hash.replace('#', '') !== viewName) {
        window.history.pushState(null, '', `#${viewName}`);
      }
    } catch (_) {}
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
    if (view === 'course-classroom') this.renderCourseClassroom();
    if (view === 'free-test-series') this.renderFreeTests();
    if (view === 'paid-test-series') this.renderPaidTestSeries();
    if (view === 'ebooks') this.renderEbooks();
    if (view === 'pyq-pdfs') this.renderPyqs();
    if (view === 'syllabus') this.renderSyllabus();
    if (view === 'social-links') this.renderSocialLinks();
    if (view === 'phase2') this.renderPhase2();
    if (view === 'phase2-classroom') this.renderPhase2Classroom();
    if (view === 'quiz-portal') this.renderQuizPortal();
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
          <div class="selection-badge-corner">${sel.intake || 'Intake 02/2027'}</div>
          <img src="${sel.image}" alt="${sel.name}" loading="lazy" onerror="this.src='/uploads/logo.png'">
        </div>
        <h4>${sel.name}</h4>
        <span class="exam-pill">${sel.exam}</span>
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
        <div style="background:#f1f5f9; padding:0.6rem 1.25rem; border-radius:8px; display:inline-block; margin-bottom:1rem;">
          <span style="font-size:0.85rem; color:#475569;">Batch / Intake: <strong>${sel.intake}</strong></span>
        </div>
        <p style="font-style:italic; color:#475569; font-size:0.95rem;">"${sel.quote || 'Hard work with SKC Defence Academy makes impossible selections possible!'}"</p>
      </div>
    `;
    this.openModal('selection-modal');
  },

  // 6. Section Renderers

  // 1. Paid Courses
  selectPaidCourseCategory(cat) {
    this.state.selectedPaidCourseCategory = cat;
    this.renderPaidCourses();
  },

  renderPaidCourses() {
    const navContainer = document.getElementById('courses-folder-nav');
    const crumbContainer = document.getElementById('courses-folder-breadcrumb');
    const container = document.getElementById('paid-courses-list');
    if (!container) return;

    const allCourses = this.state.courses || [];
    const afCourses = allCourses.filter(c => (c.title || '').toLowerCase().includes('airforce') || (c.category || '').toLowerCase().includes('airforce'));
    const navyCourses = allCourses.filter(c => (c.title || '').toLowerCase().includes('navy') || (c.category || '').toLowerCase().includes('navy'));
    const armyCourses = allCourses.filter(c => (c.title || '').toLowerCase().includes('army') || (c.category || '').toLowerCase().includes('army'));

    const activeCat = this.state.selectedPaidCourseCategory || 'all';

    let filtered = allCourses;
    let folderLabel = 'All Defence Batches';
    let folderIcon = '📁';

    if (activeCat === 'airforce') {
      filtered = afCourses;
      folderLabel = 'Airforce Agniveer Vayu Batches Folder';
      folderIcon = '✈️';
    } else if (activeCat === 'navy') {
      filtered = navyCourses;
      folderLabel = 'Indian Navy SSR / MR Batches Folder';
      folderIcon = '⚓';
    } else if (activeCat === 'army') {
      filtered = armyCourses;
      folderLabel = 'Indian Army Agniveer Batches Folder';
      folderIcon = '🎖️';
    }

    if (navContainer) {
      navContainer.innerHTML = `
        <button class="folder-tab-btn ${activeCat === 'all' ? 'active' : ''}" onclick="App.selectPaidCourseCategory('all')">
          📁 All Batches Folder <span class="folder-tab-badge">${allCourses.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'airforce' ? 'active' : ''}" onclick="App.selectPaidCourseCategory('airforce')">
          ✈️ Airforce Folder <span class="folder-tab-badge">${afCourses.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'navy' ? 'active' : ''}" onclick="App.selectPaidCourseCategory('navy')">
          ⚓ Navy Folder <span class="folder-tab-badge">${navyCourses.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'army' ? 'active' : ''}" onclick="App.selectPaidCourseCategory('army')">
          🎖️ Army Folder <span class="folder-tab-badge">${armyCourses.length}</span>
        </button>
      `;
    }

    if (crumbContainer) {
      crumbContainer.innerHTML = `
        <div class="folder-breadcrumb">
          <span class="crumb-root">📁 Course_Vault</span>
          <span class="crumb-sep">›</span>
          <span>Online_Batches</span>
          <span class="crumb-sep">›</span>
          <span class="crumb-current">${folderIcon} ${folderLabel}/</span>
          <span class="crumb-count">${filtered.length} Complete Programs</span>
        </div>
      `;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-folder-box" style="grid-column: 1 / -1;">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">📁</div>
          <h4 style="font-size:1.15rem; color:#0a192f; margin-bottom:0.35rem;">No Batches In This Folder Yet</h4>
          <p style="color:#64748b; font-size:0.88rem; max-width:440px; margin:0 auto 1.25rem;">
            New target batches will be launched soon. Explore all defence courses.
          </p>
          <button class="btn btn-outline" onclick="App.selectPaidCourseCategory('all')">View All Batches</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(course => {
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
                  ▶ Open Course Folders
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

  openCourseViewer(courseId, activeFolder = 'videos') {
    this.closeModal('generic-modal');
    this.state.activeCourseId = courseId;
    this.state.activeCourseFolder = activeFolder;
    this.navigateTo('course-classroom');
  },

  renderCourseClassroom() {
    const courseId = this.state.activeCourseId || 'course_1';
    const activeFolder = this.state.activeCourseFolder || 'videos';
    const course = (this.state.courses || []).find(c => c.id === courseId) || (this.state.courses || [])[0];
    const container = document.getElementById('course-classroom-container');
    if (!course || !container) return;

    const breadcrumbTag = document.getElementById('course-classroom-breadcrumb-tag');
    if (breadcrumbTag) breadcrumbTag.textContent = `${course.title} • Classroom`;

    this.state.courseViewActiveFolders[course.id] = activeFolder;

    const videos = course.videos || [];
    const pdfs = course.pdfs || [];
    const mocks = course.htmlMocks || [];

    let folderTitle = 'Video Lectures';
    let folderIcon = '🎥';
    let countText = `${videos.length} Lectures`;

    if (activeFolder === 'pdfs') {
      folderTitle = 'Class Notes & Formula PDFs';
      folderIcon = '📑';
      countText = `${pdfs.length} Documents`;
    } else if (activeFolder === 'tests') {
      folderTitle = 'Interactive HTML Practice Tests';
      folderIcon = '🖥️';
      countText = `${mocks.length} CBT Tests`;
    }

    container.innerHTML = `
      <div>
        <div style="background:linear-gradient(135deg, #0a192f 0%, #1e3a8a 100%); color:#fff; padding:1.25rem 1.4rem; border-radius:12px; margin-bottom:1.25rem; border:1.5px solid #0284c7;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <span style="background:#0284c7; color:#fff; font-weight:800; font-size:0.75rem; padding:0.2rem 0.55rem; border-radius:4px; text-transform:uppercase;">
                🎓 ${course.category || 'DEFENCE BATCH'}
              </span>
              <h3 style="font-size:1.3rem; margin:0.35rem 0; color:#fff; font-weight:800;">${course.title}</h3>
              <p style="color:#cbd5e1; font-size:0.85rem; margin:0; max-width:650px;">${course.description}</p>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <span style="background:rgba(255,255,255,0.15); color:#fff; font-size:0.75rem; font-weight:700; padding:0.25rem 0.6rem; border-radius:6px;">
                🎥 ${videos.length} Lectures
              </span>
              <span style="background:rgba(255,255,255,0.15); color:#fff; font-size:0.75rem; font-weight:700; padding:0.25rem 0.6rem; border-radius:6px;">
                📑 ${pdfs.length} PDFs
              </span>
              <span style="background:rgba(255,255,255,0.15); color:#fff; font-size:0.75rem; font-weight:700; padding:0.25rem 0.6rem; border-radius:6px;">
                🖥️ ${mocks.length} Tests
              </span>
            </div>
          </div>
        </div>

        <!-- Course Folder Tabs -->
        <div class="folder-nav-tabs">
          <button class="folder-tab-btn ${activeFolder === 'videos' ? 'active' : ''}" onclick="App.openCourseViewer('${course.id}', 'videos')">
            🎥 Video Lectures Folder <span class="folder-tab-badge">${videos.length}</span>
          </button>
          <button class="folder-tab-btn ${activeFolder === 'pdfs' ? 'active' : ''}" onclick="App.openCourseViewer('${course.id}', 'pdfs')">
            📑 Class Notes PDFs Folder <span class="folder-tab-badge">${pdfs.length}</span>
          </button>
          <button class="folder-tab-btn ${activeFolder === 'tests' ? 'active' : ''}" onclick="App.openCourseViewer('${course.id}', 'tests')">
            🖥️ HTML Practice Tests Folder <span class="folder-tab-badge">${mocks.length}</span>
          </button>
        </div>

        <!-- Breadcrumb -->
        <div class="folder-breadcrumb">
          <span class="crumb-root">📁 Course_Root</span>
          <span class="crumb-sep">›</span>
          <span>${course.category || 'Batch'}</span>
          <span class="crumb-sep">›</span>
          <span class="crumb-current">${folderIcon} ${folderTitle}/</span>
          <span class="crumb-count">${countText}</span>
        </div>

        <!-- FOLDER CONTENT: VIDEOS -->
        ${activeFolder === 'videos' ? `
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${videos.length === 0 ? `
              <div class="empty-folder-box">
                <div style="font-size:2.5rem; margin-bottom:0.5rem;">🎥</div>
                <h4 style="font-size:1.1rem; color:#0a192f; margin-bottom:0.35rem;">No Video Lectures in this Folder</h4>
                <p style="color:#64748b; font-size:0.85rem;">New video lectures will appear here once published by faculty.</p>
              </div>
            ` : videos.map(v => `
              <div class="folder-item-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem;">
                <div>
                  <strong style="color:#0f172a; font-size:0.95rem; display:block;">🎥 ${v.title}</strong>
                  <span style="font-size:0.8rem; color:#64748b;">Duration: ${v.duration || '45 mins'} • Full HD YouTube Stream</span>
                </div>
                <button class="btn btn-primary" style="padding:0.4rem 0.9rem; font-size:0.82rem;" onclick="App.playVideoModal('${v.youtubeId || 'ysz5S6PUM-U'}', '${v.title.replace(/'/g, "\\'")}')">
                  ▶ Watch Lecture
                </button>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- FOLDER CONTENT: PDFS -->
        ${activeFolder === 'pdfs' ? `
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${pdfs.length === 0 ? `
              <div class="empty-folder-box">
                <div style="font-size:2.5rem; margin-bottom:0.5rem;">📑</div>
                <h4 style="font-size:1.1rem; color:#0a192f; margin-bottom:0.35rem;">No PDFs in this Folder</h4>
                <p style="color:#64748b; font-size:0.85rem;">Class notes and formula sheets will be uploaded soon.</p>
              </div>
            ` : pdfs.map(p => `
              <div class="folder-item-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem;">
                <div>
                  <strong style="color:#0f172a; font-size:0.95rem; display:block;">📄 ${p.title}</strong>
                  <span style="font-size:0.8rem; color:#64748b;">Pages: ${p.pages || 30} • Size: ${p.size || '3.2 MB'} • Watermark Protected</span>
                </div>
                <div style="display:flex; gap:0.4rem;">
                  <button class="btn btn-outline" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="App.previewPdf('${p.url}')">
                    Preview
                  </button>
                  <button class="btn btn-defence" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="App.downloadWatermarkedPdf('${p.url}')">
                    ⬇ Download PDF
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- FOLDER CONTENT: HTML MOCKS -->
        ${activeFolder === 'tests' ? `
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${mocks.length === 0 ? `
              <div class="empty-folder-box">
                <div style="font-size:2.5rem; margin-bottom:0.5rem;">🖥️</div>
                <h4 style="font-size:1.1rem; color:#0a192f; margin-bottom:0.35rem;">No CBT Tests in this Folder</h4>
                <p style="color:#64748b; font-size:0.85rem;">Practice tests will be assigned during course progression.</p>
              </div>
            ` : mocks.map(hm => `
              <div class="folder-item-card" style="background:#fffdf5; border-color:#fef08a; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem;">
                <div>
                  <strong style="color:#713f12; font-size:0.95rem; display:block;">📝 ${hm.title}</strong>
                  <span style="font-size:0.8rem; color:#854d0e;">Questions: ${hm.questions} • Time Limit: ${hm.timeMinutes} Mins • Instant Result</span>
                </div>
                <button class="btn btn-primary" style="padding:0.4rem 0.9rem; font-size:0.82rem;" onclick="App.startHtmlMock('${hm.title}')">
                  Start Test
                </button>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  // 2. Free Test Series
  selectFreeTestCategory(cat) {
    this.state.selectedFreeTestCategory = cat;
    this.renderFreeTests();
  },

  renderFreeTests() {
    const navContainer = document.getElementById('free-tests-folder-nav');
    const crumbContainer = document.getElementById('free-tests-folder-breadcrumb');
    const container = document.getElementById('free-tests-list');
    if (!container) return;

    const allTests = this.state.freeTests || [];
    const afTests = allTests.filter(t => (t.exam || '').toLowerCase().includes('airforce'));
    const navyTests = allTests.filter(t => (t.exam || '').toLowerCase().includes('navy'));
    const armyTests = allTests.filter(t => (t.exam || '').toLowerCase().includes('army'));

    const activeCat = this.state.selectedFreeTestCategory || 'all';

    let filtered = allTests;
    let folderLabel = 'All Free CBT Tests';
    let folderIcon = '📁';

    if (activeCat === 'airforce') {
      filtered = afTests;
      folderLabel = 'Airforce Agniveer Vayu Free Mocks Folder';
      folderIcon = '✈️';
    } else if (activeCat === 'navy') {
      filtered = navyTests;
      folderLabel = 'Indian Navy SSR / MR Free Mocks Folder';
      folderIcon = '⚓';
    } else if (activeCat === 'army') {
      filtered = armyTests;
      folderLabel = 'Indian Army Agniveer Free Mocks Folder';
      folderIcon = '🎖️';
    }

    if (navContainer) {
      navContainer.innerHTML = `
        <button class="folder-tab-btn ${activeCat === 'all' ? 'active' : ''}" onclick="App.selectFreeTestCategory('all')">
          📁 All Free Tests Folder <span class="folder-tab-badge">${allTests.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'airforce' ? 'active' : ''}" onclick="App.selectFreeTestCategory('airforce')">
          ✈️ Airforce Folder <span class="folder-tab-badge">${afTests.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'navy' ? 'active' : ''}" onclick="App.selectFreeTestCategory('navy')">
          ⚓ Navy Folder <span class="folder-tab-badge">${navyTests.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'army' ? 'active' : ''}" onclick="App.selectFreeTestCategory('army')">
          🎖️ Army Folder <span class="folder-tab-badge">${armyTests.length}</span>
        </button>
      `;
    }

    if (crumbContainer) {
      crumbContainer.innerHTML = `
        <div class="folder-breadcrumb">
          <span class="crumb-root">📁 CBT_Platform</span>
          <span class="crumb-sep">›</span>
          <span>Free_Mock_Series</span>
          <span class="crumb-sep">›</span>
          <span class="crumb-current">${folderIcon} ${folderLabel}/</span>
          <span class="crumb-count">${filtered.length} Online Tests Ready</span>
        </div>
      `;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-folder-box" style="grid-column: 1 / -1;">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">📝</div>
          <h4 style="font-size:1.15rem; color:#0a192f; margin-bottom:0.35rem;">No Free Tests In This Folder Yet</h4>
          <p style="color:#64748b; font-size:0.88rem; max-width:440px; margin:0 auto 1.25rem;">
            New mock tests are uploaded weekly by SKC faculty.
          </p>
          <button class="btn btn-outline" onclick="App.selectFreeTestCategory('all')">View All Tests</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(test => `
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

    tabsContainer.innerHTML = categories.map(cat => {
      const s = this.state.paidTestSeries.find(item => item.name.toLowerCase() === cat.toLowerCase());
      const count = s && s.tests ? s.tests.length : 0;
      return `
        <button class="pts-tab-btn ${this.state.selectedPtsCategory === cat ? 'active' : ''}" onclick="App.selectPtsCategory('${cat}')">
          ${cat === 'Airforce' ? '✈️ Indian Airforce' : (cat === 'Navy' ? '⚓ Indian Navy' : (cat === 'ICG' ? '🛡️ Coast Guard' : '🎖️ Indian Army'))}
          <span class="folder-tab-badge" style="margin-left:0.35rem;">${count}</span>
        </button>
      `;
    }).join('');

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
      <div class="folder-breadcrumb">
        <span class="crumb-root">📁 CBT_Vault</span>
        <span class="crumb-sep">›</span>
        <span>Paid_Test_Series</span>
        <span class="crumb-sep">›</span>
        <span class="crumb-current">${this.state.selectedPtsCategory} Paid Series Folder/</span>
        <span class="crumb-count">${currentSeries.tests ? currentSeries.tests.length : 0} Mocks Ready</span>
      </div>

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

    const breadcrumbHtml = `
      <div class="folder-breadcrumb" style="max-width:880px; margin:0 auto 1.25rem;">
        <span class="crumb-root">📁 Library_Vault</span>
        <span class="crumb-sep">›</span>
        <span>Official_Publications</span>
        <span class="crumb-sep">›</span>
        <span class="crumb-current">📚 Defence_Ebooks_Folder/</span>
        <span class="crumb-count">${(this.state.ebooks || []).length} Exclusive Titles</span>
      </div>
    `;

    container.innerHTML = breadcrumbHtml + this.state.ebooks.map(eb => {
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
  selectPyqCategory(cat) {
    this.state.selectedPyqCategory = cat;
    this.renderPyqs();
  },

  renderPyqs() {
    const navContainer = document.getElementById('pyqs-folder-nav');
    const crumbContainer = document.getElementById('pyqs-folder-breadcrumb');
    const container = document.getElementById('pyqs-list');
    if (!container) return;

    const allPyqs = this.state.pyqs || [];
    const afPyqs = allPyqs.filter(p => (p.exam || '').toLowerCase().includes('airforce'));
    const navyPyqs = allPyqs.filter(p => (p.exam || '').toLowerCase().includes('navy'));
    const icgPyqs = allPyqs.filter(p => (p.exam || '').toLowerCase().includes('coast guard') || (p.exam || '').toLowerCase().includes('icg'));
    const armyPyqs = allPyqs.filter(p => (p.exam || '').toLowerCase().includes('army'));

    const activeCat = this.state.selectedPyqCategory || 'all';

    let filtered = allPyqs;
    let folderLabel = 'All Previous Year Papers';
    let folderIcon = '📁';

    if (activeCat === 'airforce') {
      filtered = afPyqs;
      folderLabel = 'Indian Airforce Agniveer Vayu Folder';
      folderIcon = '✈️';
    } else if (activeCat === 'navy') {
      filtered = navyPyqs;
      folderLabel = 'Indian Navy SSR / MR Folder';
      folderIcon = '⚓';
    } else if (activeCat === 'icg') {
      filtered = icgPyqs;
      folderLabel = 'Indian Coast Guard (ICG) Folder';
      folderIcon = '🛡️';
    } else if (activeCat === 'army') {
      filtered = armyPyqs;
      folderLabel = 'Indian Army Agniveer GD Folder';
      folderIcon = '🎖️';
    }

    if (navContainer) {
      navContainer.innerHTML = `
        <button class="folder-tab-btn ${activeCat === 'all' ? 'active' : ''}" onclick="App.selectPyqCategory('all')">
          📁 All PYQs Folder <span class="folder-tab-badge">${allPyqs.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'airforce' ? 'active' : ''}" onclick="App.selectPyqCategory('airforce')">
          ✈️ Airforce Folder <span class="folder-tab-badge">${afPyqs.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'navy' ? 'active' : ''}" onclick="App.selectPyqCategory('navy')">
          ⚓ Navy Folder <span class="folder-tab-badge">${navyPyqs.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'icg' ? 'active' : ''}" onclick="App.selectPyqCategory('icg')">
          🛡️ Coast Guard Folder <span class="folder-tab-badge">${icgPyqs.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'army' ? 'active' : ''}" onclick="App.selectPyqCategory('army')">
          🎖️ Army Folder <span class="folder-tab-badge">${armyPyqs.length}</span>
        </button>
      `;
    }

    if (crumbContainer) {
      crumbContainer.innerHTML = `
        <div class="folder-breadcrumb">
          <span class="crumb-root">📁 Vault_Archive</span>
          <span class="crumb-sep">›</span>
          <span>Previous_Year_Question_Papers</span>
          <span class="crumb-sep">›</span>
          <span class="crumb-current">${folderIcon} ${folderLabel}/</span>
          <span class="crumb-count">${filtered.length} Question Papers Available</span>
        </div>
      `;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-folder-box" style="grid-column: 1 / -1;">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">📁</div>
          <h4 style="font-size:1.15rem; color:#0a192f; margin-bottom:0.35rem;">This PYQ Folder is Currently Empty</h4>
          <p style="color:#64748b; font-size:0.88rem; max-width:440px; margin:0 auto 1.25rem;">
            Official question papers for this defence exam category will be updated soon.
          </p>
          <button class="btn btn-outline" onclick="App.selectPyqCategory('all')">View All PYQs</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(p => `
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
  selectSyllabusCategory(cat) {
    this.state.selectedSyllabusCategory = cat;
    this.renderSyllabus();
  },

  renderSyllabus() {
    const navContainer = document.getElementById('syllabus-folder-nav');
    const crumbContainer = document.getElementById('syllabus-folder-breadcrumb');
    const container = document.getElementById('syllabus-list');
    if (!container) return;

    const allSyllabus = this.state.syllabus || [];
    const afSyllabus = allSyllabus.filter(s => (s.exam || '').toLowerCase().includes('airforce'));
    const navySyllabus = allSyllabus.filter(s => (s.exam || '').toLowerCase().includes('navy'));
    const icgSyllabus = allSyllabus.filter(s => (s.exam || '').toLowerCase().includes('coast guard') || (s.exam || '').toLowerCase().includes('icg'));
    const armySyllabus = allSyllabus.filter(s => (s.exam || '').toLowerCase().includes('army'));

    const activeCat = this.state.selectedSyllabusCategory || 'all';

    let filtered = allSyllabus;
    let folderLabel = 'All Official Syllabus';
    let folderIcon = '📁';

    if (activeCat === 'airforce') {
      filtered = afSyllabus;
      folderLabel = 'Indian Airforce Official Syllabus Folder';
      folderIcon = '✈️';
    } else if (activeCat === 'navy') {
      filtered = navySyllabus;
      folderLabel = 'Indian Navy Official Syllabus Folder';
      folderIcon = '⚓';
    } else if (activeCat === 'icg') {
      filtered = icgSyllabus;
      folderLabel = 'Indian Coast Guard Official Syllabus Folder';
      folderIcon = '🛡️';
    } else if (activeCat === 'army') {
      filtered = armySyllabus;
      folderLabel = 'Indian Army Official Syllabus Folder';
      folderIcon = '🎖️';
    }

    if (navContainer) {
      navContainer.innerHTML = `
        <button class="folder-tab-btn ${activeCat === 'all' ? 'active' : ''}" onclick="App.selectSyllabusCategory('all')">
          📁 All Syllabus Folder <span class="folder-tab-badge">${allSyllabus.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'airforce' ? 'active' : ''}" onclick="App.selectSyllabusCategory('airforce')">
          ✈️ Airforce Folder <span class="folder-tab-badge">${afSyllabus.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'navy' ? 'active' : ''}" onclick="App.selectSyllabusCategory('navy')">
          ⚓ Navy Folder <span class="folder-tab-badge">${navySyllabus.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'icg' ? 'active' : ''}" onclick="App.selectSyllabusCategory('icg')">
          🛡️ Coast Guard Folder <span class="folder-tab-badge">${icgSyllabus.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'army' ? 'active' : ''}" onclick="App.selectSyllabusCategory('army')">
          🎖️ Army Folder <span class="folder-tab-badge">${armySyllabus.length}</span>
        </button>
      `;
    }

    if (crumbContainer) {
      crumbContainer.innerHTML = `
        <div class="folder-breadcrumb">
          <span class="crumb-root">📁 Vault_Archive</span>
          <span class="crumb-sep">›</span>
          <span>Official_Exam_Syllabus</span>
          <span class="crumb-sep">›</span>
          <span class="crumb-current">${folderIcon} ${folderLabel}/</span>
          <span class="crumb-count">${filtered.length} Official Documents</span>
        </div>
      `;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-folder-box" style="grid-column: 1 / -1;">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">📋</div>
          <h4 style="font-size:1.15rem; color:#0a192f; margin-bottom:0.35rem;">This Syllabus Folder is Currently Empty</h4>
          <p style="color:#64748b; font-size:0.88rem; max-width:440px; margin:0 auto 1.25rem;">
            Official syllabus notifications and criteria will be added soon.
          </p>
          <button class="btn btn-outline" onclick="App.selectSyllabusCategory('all')">View All Syllabus</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(s => `
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
      <div class="folder-breadcrumb" style="margin-bottom:1.25rem;">
        <span class="crumb-root">📁 Directory</span>
        <span class="crumb-sep">›</span>
        <span>Official_Channels</span>
        <span class="crumb-sep">›</span>
        <span class="crumb-current">🌐 Social_Media_&_Registration_Portals/</span>
        <span class="crumb-count">Direct Links</span>
      </div>
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
              ⭐ Flagship Program • Dual Mastery
            </span>
            <span style="font-size:0.75rem; background:#e0f2fe; color:#0369a1; font-weight:700; padding:0.15rem 0.5rem; border-radius:12px;">
              📁 17 CBT Mocks • 27 Lecture PDFs
            </span>
          </div>
          <h3 style="font-size:1.3rem; color:#0a192f; margin:0.35rem 0;">Airforce GD + SRT Special Batch</h3>
          <p style="color:#475569; font-size:0.88rem; margin-bottom:1rem;">
            Comprehensive Phase-II master program organized into PW-style dedicated sections: 17 full-length CBT HTML mock tests, 27 official lecture notes PDFs, YouTube classes, and top GD speaking scripts.
          </p>
          <ul class="card-meta-list" style="margin-bottom:1.5rem;">
            <li><span>✓</span> 🖥️ 17 Full-Length CBT SRT Mock Tests (45 Qs / 30 Mins Bilingual)</li>
            <li><span>✓</span> 📑 27 Official SRT Class PDFs (Classes 01 to 27 with Solved Examples)</li>
            <li><span>✓</span> 🗣️ Top 30+ Trending Defence GD Topics with English Scripts</li>
            <li><span>✓</span> 📹 Video Classes & Officer-Like-Qualities (OLQ) Evaluation</li>
          </ul>
          <div class="card-pricing-row">
            <div class="price-box">
              <span class="current-price">₹${b1 ? b1.price : 99}</span>
              <span class="original-price">₹${b1 ? b1.originalPrice : 499}</span>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button class="btn btn-primary" style="background:#0284c7; border:none; font-weight:800;" onclick="App.openPhase2Viewer('phase2_1', 'srt-mocks')">
                📁 Open GD + SRT Classroom
              </button>
              ${isB1Purchased ? `
                <button class="btn btn-defence" onclick="App.openPhase2Viewer('phase2_1', 'srt-mocks')">
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
        <div class="batch-box highlight" style="border: 2px solid #10b981; background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span class="batch-badge" style="background:#10b981; color:#fff; font-weight:800;">
              ⭐ SRT Special • 17 CBTs + 27 PDFs
            </span>
            <span style="font-size:0.75rem; background:#dcfce7; color:#15803d; font-weight:700; padding:0.15rem 0.5rem; border-radius:12px;">
              📁 17 CBT Mocks • 27 PDFs
            </span>
          </div>
          <h3 style="font-size:1.3rem; color:#0a192f; margin:0.35rem 0;">AIRFORCE SRT Special Batch</h3>
          <p style="color:#475569; font-size:0.88rem; margin-bottom:1rem;">
            Dedicated Situation Reaction Test (SRT) specialization batch. Features 17 full-length CBT simulation tests, 27 official lecture notes PDFs, and psychological score assessment under 30-min time limits.
          </p>
          <ul class="card-meta-list" style="margin-bottom:1.5rem;">
            <li><span>✓</span> 🖥️ 17 Full-Length CBT SRT Mock Tests with Bilingual Engine</li>
            <li><span>✓</span> 📑 27 Official SRT Class PDFs (Classes 01 to 27 Solved Scenarios)</li>
            <li><span>✓</span> ⏱️ Strict 30-Minute Real Exam Environment & Instant Result</li>
            <li><span>✓</span> 🧠 Psychological Recommendation & 15 OLQ Assessment</li>
          </ul>
          <div class="card-pricing-row">
            <div class="price-box">
              <span class="current-price">₹${b2 ? b2.price : 49}</span>
              <span class="original-price">₹${b2 ? b2.originalPrice : 199}</span>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button class="btn btn-primary" style="background:#10b981; border:none; font-weight:800;" onclick="App.openPhase2Viewer('phase2_2', 'srt-mocks')">
                📁 Open SRT Classroom
              </button>
              ${isB2Purchased || isB1Purchased ? `
                <button class="btn btn-defence" onclick="App.openPhase2Viewer('phase2_2', 'srt-mocks')">
                  ▶ Enrolled
                </button>
              ` : `
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

        <!-- Folder Breadcrumb -->
        <div class="folder-breadcrumb">
          <span class="crumb-root">📁 Phase2_Vault</span>
          <span class="crumb-sep">›</span>
          <span>Airforce_GD_Special_Batch</span>
          <span class="crumb-sep">›</span>
          <span class="crumb-current">📹 Daily_YouTube_Classes_&_PDFs/</span>
          <span class="crumb-count">${classes.length} Published Classes</span>
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

  openPhase2Viewer(batchId = 'phase2_1', activeFolder = 'srt-mocks') {
    this.closeModal('generic-modal');
    this.state.activePhase2BatchId = batchId;
    this.state.activePhase2Folder = activeFolder || 'srt-mocks';
    this.navigateTo('phase2-classroom');
  },

  renderPhase2Classroom() {
    const batchId = this.state.activePhase2BatchId || 'phase2_1';
    let activeFolder = this.state.activePhase2Folder || 'srt-mocks';
    const batch = (this.state.phase2Batches || []).find(b => b.id === batchId) || (this.state.phase2Batches || [])[0];
    const container = document.getElementById('phase2-classroom-container');
    if (!batch || !container) return;

    const breadcrumbTag = document.getElementById('phase2-classroom-breadcrumb-tag');
    if (breadcrumbTag) breadcrumbTag.innerText = `${batch.title} • Classroom`;
    const isAdmin = this.state.user && this.state.user.role === 'admin';

    const videos = batch.youtubeVideos || [];
    const pdfs = batch.classPdfs || [];
    const topics = batch.gdTopics || [];
    const srtPdfs = batch.srtClassPdfs || [];
    const srtMocks = batch.srtMockTests || [];

    const isPhase2_1 = batch.id === 'phase2_1';
    const isPhase2_2 = batch.id === 'phase2_2';

    container.innerHTML = `
      <div class="phase2-folder-viewer">
        <!-- Banner Header (PhysicsWallah Batch Classroom Style) -->
        <div style="background:linear-gradient(135deg, #0a192f 0%, #1e3a8a 100%); color:#fff; padding:1.25rem 1.4rem; border-radius:12px; margin-bottom:1.25rem; border:1.5px solid ${isPhase2_2 ? '#10b981' : '#38bdf8'};">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem; flex-wrap:wrap;">
                <span style="background:${isPhase2_2 ? '#10b981' : '#38bdf8'}; color:#0a192f; font-weight:800; font-size:0.72rem; padding:0.2rem 0.55rem; border-radius:4px; text-transform:uppercase;">
                  ${isPhase2_2 ? '🎯 AIRFORCE SRT SPECIAL BATCH' : '⭐ AIRFORCE GD + SRT MASTER BATCH'}
                </span>
                <span style="background:rgba(255,255,255,0.15); color:#fff; font-size:0.72rem; font-weight:700; padding:0.2rem 0.5rem; border-radius:4px;">
                  PW-Style Smart Classroom
                </span>
              </div>
              <h3 style="font-size:1.3rem; margin:0 0 0.35rem; color:#fff; font-weight:800;">${batch.title}</h3>
              <p style="font-size:0.85rem; color:#cbd5e1; margin:0 0 0.6rem; max-width:650px;">
                ${batch.description || 'Complete Phase-II preparation with 17 CBT simulation tests, 27 lecture notes PDFs, and structured discussion frameworks.'}
              </p>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; font-size:0.78rem;">
                <span style="background:rgba(56,189,248,0.2); color:#7dd3fc; padding:0.2rem 0.55rem; border-radius:6px; font-weight:700;">
                  🖥️ ${srtMocks.length} CBT Mocks
                </span>
                <span style="background:rgba(245,158,11,0.2); color:#fcd34d; padding:0.2rem 0.55rem; border-radius:6px; font-weight:700;">
                  📑 ${srtPdfs.length} Lecture PDFs
                </span>
                ${videos.length > 0 ? `
                  <span style="background:rgba(239,68,68,0.2); color:#fca5a5; padding:0.2rem 0.55rem; border-radius:6px; font-weight:700;">
                    📹 ${videos.length} Video Classes
                  </span>
                ` : ''}
                ${topics.length > 0 ? `
                  <span style="background:rgba(16,185,129,0.2); color:#6ee7b7; padding:0.2rem 0.55rem; border-radius:6px; font-weight:700;">
                    🗣️ ${topics.length} GD Scripts
                  </span>
                ` : ''}
              </div>
            </div>

            ${isAdmin ? `
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button class="btn btn-primary" style="font-size:0.8rem; background:#38bdf8; color:#0a192f; font-weight:800;" onclick="App.toggleBatchUpload('video')">
                  + 📹 Add Video
                </button>
                <button class="btn btn-primary" style="font-size:0.8rem; background:#f59e0b; color:#0a192f; font-weight:800;" onclick="App.toggleBatchUpload('pdf')">
                  + 📑 Upload PDF
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Admin Inline Upload Container for Video -->
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
        ` : ''}

        <!-- Admin Inline Upload Container for PDF -->
        ${isAdmin ? `
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

        <!-- PW-Style Classroom Navigation Tabs -->
        <div class="folder-nav-tabs">
          <button class="folder-tab-btn ${activeFolder === 'srt-mocks' ? 'active' : ''}" onclick="App.openPhase2Viewer('${batch.id}', 'srt-mocks')">
            🖥️ SRT CBT Mock Tests <span class="folder-tab-badge">${srtMocks.length}</span>
          </button>
          <button class="folder-tab-btn ${activeFolder === 'srt-pdfs' ? 'active' : ''}" onclick="App.openPhase2Viewer('${batch.id}', 'srt-pdfs')">
            📑 SRT Class PDFs (01-27) <span class="folder-tab-badge">${srtPdfs.length}</span>
          </button>
          <button class="folder-tab-btn ${activeFolder === 'youtube' ? 'active' : ''}" onclick="App.openPhase2Viewer('${batch.id}', 'youtube')">
            📹 Video Lectures <span class="folder-tab-badge">${videos.length}</span>
          </button>
          ${topics.length > 0 ? `
            <button class="folder-tab-btn ${activeFolder === 'topics' ? 'active' : ''}" onclick="App.openPhase2Viewer('${batch.id}', 'topics')">
              🗣️ GD Master Scripts <span class="folder-tab-badge">${topics.length}</span>
            </button>
          ` : ''}
          <button class="folder-tab-btn ${activeFolder === 'srt-engine' ? 'active' : ''}" onclick="App.openPhase2Viewer('${batch.id}', 'srt-engine')">
            🎯 Quick SRT Simulator
          </button>
        </div>

        <!-- 1. TAB: SRT CBT MOCK TESTS (PW TEST SERIES FORMAT) -->
        ${activeFolder === 'srt-mocks' ? `
          <div class="folder-view-pane">
            <div class="folder-breadcrumb">
              <span>📁 Classroom_Vault</span>
              <span>›</span>
              <span>${batch.title.replace(/\s+/g, '_')}</span>
              <span>›</span>
              <span style="color:#0284c7; font-weight:700;">🖥️ SRT_CBT_Mock_Tests/</span>
              <span class="crumb-count">${srtMocks.length} Online Tests Available</span>
            </div>

            <!-- Search Bar -->
            <div class="pw-search-box">
              <span>🔍</span>
              <input type="text" placeholder="Search SRT Mock Tests by number or keyword (e.g. Mock 01, Mock 10)..." oninput="App.filterCards(this.value, 'srt-mocks-grid')">
            </div>

            <div id="srt-mocks-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.15rem;">
              ${srtMocks.map(m => `
                <div class="pw-test-card" data-title="${m.title.toLowerCase()} mock ${m.testNo} cbt">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem;">
                    <span class="test-num-badge">
                      🎯 MOCK TEST ${String(m.testNo).padStart(2, '0')}
                    </span>
                    <span class="pw-meta-pill pw-pill-green">🟢 Live CBT</span>
                  </div>

                  <h4 style="font-size:1.08rem; color:#0f172a; margin:0.15rem 0; font-weight:800; line-height:1.35;">
                    ${m.title}
                  </h4>

                  <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.25rem;">
                    <span class="pw-meta-pill pw-pill-blue">⏱️ ${m.duration} Mins</span>
                    <span class="pw-meta-pill pw-pill-purple">❓ ${m.questions} Scenarios</span>
                    <span class="pw-meta-pill pw-pill-amber">🎯 Marking: ${m.marking}</span>
                    <span class="pw-meta-pill pw-pill-rose">🌐 Bilingual (Hindi/Eng)</span>
                  </div>

                  <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:auto; padding-top:0.65rem; border-top:1px solid #f1f5f9;">
                    <button class="btn btn-primary" style="flex:1; min-width:140px; font-size:0.85rem; font-weight:800; background:#0284c7; border:none; padding:0.55rem 0.9rem;" onclick="App.launchCbtMockTest('${m.url}', '${m.title.replace(/'/g, "\\'")}')">
                      🚀 Start CBT Simulation
                    </button>
                    <a href="${m.url}" target="_blank" class="btn btn-secondary" style="font-size:0.82rem; padding:0.55rem 0.85rem; text-decoration:none; display:inline-flex; align-items:center; gap:0.25rem;" title="Open in Dedicated Tab">
                      ⛶ Fullscreen
                    </a>
                    <a href="${m.url}" download="${m.title.replace(/\s+/g, '_')}.html" class="btn btn-outline" style="font-size:0.82rem; padding:0.55rem 0.75rem; text-decoration:none;" title="Download HTML for offline use">
                      📥 Save
                    </a>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 2. TAB: SRT CLASS QUIZZES & LECTURE PDFS (PW DPP & NOTES FORMAT) -->
        ${activeFolder === 'srt-pdfs' ? `
          <div class="folder-view-pane">
            <div class="folder-breadcrumb">
              <span>📁 Classroom_Vault</span>
              <span>›</span>
              <span>${batch.title.replace(/\s+/g, '_')}</span>
              <span>›</span>
              <span style="color:#f59e0b; font-weight:700;">📑 SRT_Class_Quizzes_&_PDFs/</span>
              <span class="crumb-count">${srtPdfs.length} Classes (27 Quizzes & PDFs)</span>
            </div>

            <!-- Search Bar -->
            <div class="pw-search-box">
              <span>🔍</span>
              <input type="text" placeholder="Search 27 Class Quizzes & PDFs (e.g. Class 05, Fire, Disaster, Weapon, Leadership)..." oninput="App.filterCards(this.value, 'srt-pdfs-list')">
            </div>

            <div id="srt-pdfs-list" style="display:flex; flex-direction:column; gap:0.95rem;">
              ${srtPdfs.map(p => `
                <div class="pw-lecture-card" data-title="${p.title.toLowerCase()} class ${p.classNo} quiz test">
                  <div style="display:flex; align-items:center; gap:0.85rem; flex:1; min-width:240px;">
                    <span class="pw-class-index-tag">CLASS ${String(p.classNo).padStart(2, '0')}</span>
                    <div style="overflow:hidden;">
                      <strong style="color:#0f172a; font-size:1rem; display:block; line-height:1.4;">${p.title}</strong>
                      <div style="display:flex; gap:0.4rem; font-size:0.75rem; color:#64748b; margin-top:0.35rem; flex-wrap:wrap;">
                        <span class="pw-meta-pill pw-pill-green">🎯 15 Scenarios Quiz</span>
                        <span class="pw-meta-pill pw-pill-blue">⏱️ 15 Mins Timed</span>
                        <span class="pw-meta-pill pw-pill-rose">📄 ${p.size} PDF</span>
                        <span class="pw-meta-pill pw-pill-amber">📑 ${p.pages} Pages</span>
                        <span class="pw-meta-pill pw-pill-purple">🛡️ Watermarked</span>
                      </div>
                    </div>
                  </div>

                  <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                    <button class="btn btn-primary" style="padding:0.5rem 1.15rem; font-size:0.85rem; font-weight:800; background:#10b981; border:none; box-shadow:0 2px 8px rgba(16,185,129,0.3);" onclick="App.launchClassQuiz('${batch.id}', ${p.classNo})">
                      🎯 Start Class Quiz
                    </button>
                    <button class="btn btn-outline" style="padding:0.45rem 0.85rem; font-size:0.82rem;" onclick="App.previewPdf('${p.url}')">
                      👁️ Preview PDF
                    </button>
                    <button class="btn btn-defence" style="padding:0.45rem 0.95rem; font-size:0.82rem; font-weight:700;" onclick="App.downloadWatermarkedPdf('${p.url}')">
                      📥 Download PDF
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 3. TAB: YOUTUBE VIDEO CLASSES -->
        ${activeFolder === 'youtube' ? `
          <div class="folder-view-pane">
            <div class="folder-breadcrumb">
              <span>📁 Classroom_Vault</span>
              <span>›</span>
              <span>${batch.title.replace(/\s+/g, '_')}</span>
              <span>›</span>
              <span style="color:#ef4444; font-weight:700;">📹 Video_Lectures/</span>
              <span class="crumb-count">${videos.length} Lectures</span>
            </div>

            ${videos.length === 0 ? `
              <div class="empty-folder-box">
                <div style="font-size:2.5rem; margin-bottom:0.5rem;">📹</div>
                <h4 style="font-size:1.15rem; color:#0a192f; margin-bottom:0.35rem;">No Video Lectures Uploaded Yet</h4>
                <p style="color:#64748b; font-size:0.88rem; max-width:440px; margin:0 auto 1.25rem;">
                  Daily YouTube video classes by SKC Defence Academy instructors will appear here.
                </p>
                ${isAdmin ? `
                  <button class="btn btn-primary" style="padding:0.6rem 1.25rem; font-weight:700;" onclick="App.toggleBatchUpload('video')">
                    + Add Video Link
                  </button>
                ` : ''}
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:1.15rem;">
                ${videos.map(v => `
                  <div class="folder-item-card">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
                      <span style="background:#ef4444; color:#fff; font-size:0.72rem; font-weight:800; padding:0.15rem 0.45rem; border-radius:4px;">▶ Lecture Video</span>
                      <span style="background:#e0f2fe; color:#0369a1; font-size:0.72rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:4px;">${v.topic || 'Strategy'}</span>
                      <span style="font-size:0.75rem; color:#64748b; margin-left:auto;">📅 ${v.date || 'Official Class'}</span>
                    </div>

                    <div class="gd-card-media-layout">
                      <div class="gd-card-thumb-container" onclick="App.playVideoModal('${v.youtubeId}', '${v.title.replace(/'/g, "\\'")}')">
                        <img src="https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg" onerror="this.src='/uploads/banner.png'">
                        <div class="gd-card-thumb-overlay">
                          <div class="gd-card-play-icon">▶</div>
                        </div>
                      </div>

                      <div style="width:100%;">
                        <h4 style="font-size:1.02rem; color:#0a192f; margin-bottom:0.35rem; font-weight:700; line-height:1.35;">${v.title}</h4>
                        <p style="font-size:0.83rem; color:#475569; margin-bottom:0.65rem; line-height:1.4;">${v.notes || 'Official discussion points, speaking framework, and psychological breakdown.'}</p>
                      </div>
                    </div>

                    <div class="gd-card-actions-row">
                      <button class="btn btn-secondary" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; font-size:0.8rem; padding:0.45rem 0.85rem;" onclick="App.playVideoModal('${v.youtubeId}', '${v.title.replace(/'/g, "\\'")}')">
                        ▶ Watch Video Class
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

        <!-- 4. TAB: GD TOPICS & SCRIPTS (ONLY IN GD+SRT) -->
        ${activeFolder === 'topics' ? `
          <div class="folder-view-pane">
            <div class="folder-breadcrumb">
              <span>📁 Classroom_Vault</span>
              <span>›</span>
              <span>${batch.title.replace(/\s+/g, '_')}</span>
              <span>›</span>
              <span style="color:#0284c7; font-weight:700;">🗣️ Top_GD_Topics_and_Scripts/</span>
              <span class="crumb-count">${topics.length} Defence Topics</span>
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
                    <strong style="color:#16a34a;">Key Arguments FOR:</strong>
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

        <!-- 5. TAB: QUICK SRT SIMULATOR -->
        ${activeFolder === 'srt-engine' ? `
          <div class="folder-view-pane" style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:1.5rem; text-align:center;">
            <div style="max-width:620px; margin:0 auto;">
              <span style="font-size:2.5rem; display:block; margin-bottom:0.5rem;">🎯</span>
              <h3 style="font-size:1.35rem; color:#0a192f; margin-bottom:0.5rem;">Airforce SRT Interactive Practice Engine</h3>
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
                🚀 Launch Interactive SRT Simulator
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  },

  // ==================== CBT MOCK TEST ENGINE (FULL PAGE) ====================
  launchCbtMockTest(testUrl, testTitle, batchId) {
    this.closeModal('generic-modal');
    this.quizPortalMode = 'cbt-mock';
    this.cbtMockState = {
      url: testUrl,
      title: testTitle || 'SKC Defence CBT Portal',
      batchId: batchId || this.state.activePhase2BatchId || 'phase2_1'
    };
    this.navigateTo('quiz-portal');
  },

  renderCbtMockView() {
    const container = document.getElementById('quiz-portal-container');
    if (!container || !this.cbtMockState) return;
    const bId = this.cbtMockState.batchId || 'phase2_1';

    container.innerHTML = `
      <div style="background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #cbd5e1; box-shadow:0 4px 16px rgba(0,0,0,0.08); margin-bottom:2rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; background:#0b2a5b; color:#fff; padding:0.75rem 1.25rem; border-bottom:3px solid #ff9933; flex-wrap:wrap; gap:0.75rem;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <button class="btn btn-outline" style="color:#fff; border-color:rgba(255,255,255,0.4); padding:0.4rem 0.85rem; font-size:0.82rem; font-weight:700;" onclick="App.openPhase2Viewer('${bId}', 'srt-mocks')">
              ← Back to Classroom
            </button>
            <div>
              <strong style="font-size:1.05rem; display:block; color:#fff;">${this.cbtMockState.title}</strong>
              <span style="font-size:0.75rem; color:#cbd5e1;">Airforce Phase-II CBT Simulation Engine • 45 Scenarios / 30 Mins</span>
            </div>
          </div>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <span style="background:#138808; color:#fff; font-size:0.72rem; font-weight:800; padding:0.25rem 0.6rem; border-radius:4px;">🟢 CBT ACTIVE</span>
            <a href="${this.cbtMockState.url}" target="_blank" class="btn btn-primary" style="padding:0.4rem 0.85rem; font-size:0.8rem; background:#ff9933; color:#1e293b; text-decoration:none; font-weight:800; border:none;">
              ⛶ Open Dedicated Tab
            </a>
          </div>
        </div>
        <div style="width:100%; height:calc(100vh - 170px); min-height:620px; background:#f8fafc;">
          <iframe src="${this.cbtMockState.url}" style="width:100%; height:100%; border:none; display:block;" title="${this.cbtMockState.title}"></iframe>
        </div>
      </div>
    `;
  },

  // ==================== INTERACTIVE CLASS QUIZ ENGINE ====================
  quizPortalMode: 'class-quiz',
  cbtMockState: null,
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
    this.closeModal('generic-modal');
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

    this.quizPortalMode = 'class-quiz';

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

    this.navigateTo('quiz-portal');
  },

  renderQuizPortal() {
    if (this.quizPortalMode === 'cbt-mock') {
      this.renderCbtMockView();
    } else {
      if (this.quizState && this.quizState.submitted) {
        this.renderQuizScorecardView();
      } else if (this.quizState && this.quizState.quiz) {
        this.renderClassQuizView();
      } else {
        this.navigateTo('phase2');
      }
    }
  },

  updateQuizTimerDisplay() {
    const el = document.getElementById('class-quiz-timer');
    if (!el) return;
    const m = Math.floor(this.quizState.timeRemaining / 60);
    const s = this.quizState.timeRemaining % 60;
    el.textContent = `⏱️ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (this.quizState.timeRemaining < 120) {
      el.classList.add('urgent');
    } else {
      el.classList.remove('urgent');
    }
  },

  renderClassQuizView() {
    const container = document.getElementById('quiz-portal-container');
    if (!container) return;
    const qState = this.quizState;
    if (!qState || !qState.quiz) return;
    const quiz = qState.quiz;
    const questions = quiz.questions || [];
    const q = questions[qState.currentQ];
    if (!q) return;

    const m = Math.floor(qState.timeRemaining / 60);
    const s = qState.timeRemaining % 60;
    const isUrgent = qState.timeRemaining < 120;
    const selectedOpt = qState.answers[qState.currentQ];

    container.innerHTML = `
      <div class="quiz-container" style="border:1.5px solid #cbd5e1; box-shadow:0 4px 16px rgba(0,0,0,0.06); margin-bottom:2rem;">
        <!-- Header Bar -->
        <div class="quiz-header-bar">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <button type="button" class="btn btn-outline" style="color:#fff; border-color:rgba(255,255,255,0.4); padding:0.35rem 0.75rem; font-size:0.8rem; font-weight:700;" onclick="App.exitQuizConfirm()">
              ← Exit Test
            </button>
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.15rem;">
                <span style="background:#ff9933; color:#0b2a5b; font-weight:800; font-size:0.75rem; padding:0.2rem 0.55rem; border-radius:4px; text-transform:uppercase;">
                  🎯 CLASS ${String(qState.classNo).padStart(2, '0')} QUIZ
                </span>
                <span style="background:rgba(255,255,255,0.18); color:#fff; font-size:0.75rem; font-weight:700; padding:0.2rem 0.5rem; border-radius:4px;">
                  Scenario ${qState.currentQ + 1} of ${questions.length}
                </span>
              </div>
              <strong style="font-size:0.95rem; color:#fff; display:block;">${quiz.title}</strong>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
            <!-- Language Switcher -->
            <div class="quiz-lang-selector">
              <button class="quiz-lang-btn ${qState.lang === 'bilingual' ? 'active' : ''}" onclick="App.setQuizLang('bilingual')">Both (द्विभाषी)</button>
              <button class="quiz-lang-btn ${qState.lang === 'en' ? 'active' : ''}" onclick="App.setQuizLang('en')">English</button>
              <button class="quiz-lang-btn ${qState.lang === 'hi' ? 'active' : ''}" onclick="App.setQuizLang('hi')">हिंदी</button>
            </div>

            <!-- Timer Pill -->
            <div id="class-quiz-timer" class="quiz-timer-pill ${isUrgent ? 'urgent' : ''}">
              ⏱️ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}
            </div>
          </div>
        </div>

        <!-- Question Palette Strip (1 to 15) -->
        <div class="quiz-palette-strip">
          ${questions.map((_, idx) => {
            const isAns = qState.answers[idx] !== undefined;
            const isCur = idx === qState.currentQ;
            let cls = 'quiz-q-num-btn';
            if (isCur) cls += ' active';
            else if (isAns) cls += ' answered';
            return `<button class="${cls}" onclick="App.jumpQuizQ(${idx})">${idx + 1}</button>`;
          }).join('')}
        </div>

        <!-- Question & Options Body -->
        <div class="quiz-card-body" style="padding:1.5rem 1.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; flex-wrap:gap; gap:0.5rem;">
            <span style="font-weight:800; color:#0284c7; font-size:0.9rem; letter-spacing:0.5px;">
              ⚡ SITUATION ${qState.currentQ + 1}
            </span>
            <span style="font-size:0.78rem; background:#e0f2fe; color:#0369a1; padding:0.25rem 0.6rem; border-radius:6px; font-weight:800;">
              OLQ Focus: ${q.olqAttribute || 'Crisis Reaction'}
            </span>
          </div>

          <!-- Situation Box -->
          <div class="quiz-situation-box" style="padding:1.25rem 1.5rem;">
            ${qState.lang !== 'hi' ? `
              <p style="font-size:1.1rem; font-weight:700; color:#0f172a; margin:0 0 0.6rem; line-height:1.5;">
                ${q.situationEn}
              </p>
            ` : ''}
            ${qState.lang !== 'en' ? `
              <p style="font-size:1.02rem; font-weight:600; color:#334155; margin:0; line-height:1.5;">
                ${q.situationHi}
              </p>
            ` : ''}
          </div>

          <!-- Options List -->
          <div class="quiz-options-list">
            ${q.options.map((opt, oIdx) => {
              const isSel = selectedOpt === oIdx;
              const letter = ['A', 'B', 'C', 'D'][oIdx];
              return `
                <div class="quiz-option-item ${isSel ? 'selected' : ''}" onclick="App.selectQuizOption(${oIdx})">
                  <div class="quiz-option-badge">${letter}</div>
                  <div style="flex:1;">
                    ${qState.lang !== 'hi' ? `
                      <div style="font-size:0.98rem; font-weight:600; color:#0f172a; margin-bottom:0.25rem; line-height:1.45;">
                        ${opt.textEn}
                      </div>
                    ` : ''}
                    ${qState.lang !== 'en' ? `
                      <div style="font-size:0.92rem; color:#475569; line-height:1.45;">
                        ${opt.textHi}
                      </div>
                    ` : ''}
                  </div>
                  ${isSel ? '<span style="color:#0284c7; font-weight:800; font-size:1.3rem;">✔</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Bottom Actions Footer -->
        <div class="quiz-actions-footer">
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-outline" style="padding:0.55rem 1.15rem; font-size:0.85rem;" ${qState.currentQ === 0 ? 'disabled' : ''} onclick="App.prevQuizQ()">
              ⬅ Previous
            </button>
            <button class="btn btn-secondary" style="padding:0.55rem 0.95rem; font-size:0.82rem; background:#f1f5f9; color:#475569;" onclick="App.clearQuizAnswer()">
              🧹 Clear Choice
            </button>
          </div>

          <div style="display:flex; gap:0.5rem; align-items:center;">
            ${qState.currentQ < questions.length - 1 ? `
              <button class="btn btn-primary" style="padding:0.55rem 1.4rem; font-size:0.9rem; font-weight:800;" onclick="App.nextQuizQ()">
                Next ➡
              </button>
            ` : `
              <button class="btn btn-primary" style="padding:0.6rem 1.5rem; font-size:0.92rem; font-weight:800; background:#10b981; border:none; box-shadow:0 2px 10px rgba(16,185,129,0.35);" onclick="App.finishClassQuiz()">
                🏁 Submit Quiz
              </button>
            `}
          </div>
        </div>
      </div>
    `;
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
        if (!confirm(`You have answered ${answered} out of ${total} situations. Are you sure you want to submit?`)) {
          return;
        }
      }
    }

    if (this.quizState.intervalId) clearInterval(this.quizState.intervalId);
    this.quizState.submitted = true;
    this.renderQuizScorecardView();
  },

  renderQuizScorecardView() {
    const container = document.getElementById('quiz-portal-container');
    if (!container || !this.quizState || !this.quizState.quiz) return;

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
      assessmentMsg = 'Review the psychologist\'s explanations below and practice positive reaction formulation.';
    }

    container.innerHTML = `
      <div style="background:#ffffff; border-radius:12px; overflow:hidden; border:1.5px solid #cbd5e1; box-shadow:0 4px 16px rgba(0,0,0,0.06); margin-bottom:2rem;">
        <!-- Hero Score Banner -->
        <div style="background:linear-gradient(135deg, #0b2a5b 0%, #1e3a8a 100%); color:#fff; padding:2rem 1.5rem; text-align:center; border-bottom:4px solid #ff9933;">
          <span style="background:${badgeColor}; color:#fff; font-weight:800; font-size:0.82rem; padding:0.3rem 0.85rem; border-radius:20px; text-transform:uppercase; display:inline-block; margin-bottom:0.75rem;">
            ${olqRating}
          </span>
          <h2 style="font-size:1.8rem; margin:0 0 0.5rem; color:#fff;">Psychological Response Scorecard</h2>
          <div style="font-size:3.5rem; font-weight:900; color:#ff9933; margin:0.35rem 0; line-height:1;">
            ${scorePercent}%
          </div>
          <p style="font-size:1.05rem; color:#cbd5e1; margin:0 auto; max-width:550px;">
            ${assessmentMsg}
          </p>
        </div>

        <!-- Metrics Grid -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:0.75rem; padding:1.25rem 1.5rem; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
          <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:0.75rem; text-align:center;">
            <strong style="color:#0f172a; font-size:1.4rem; display:block;">${questions.length}</strong>
            <span style="font-size:0.75rem; color:#64748b;">Total Scenarios</span>
          </div>
          <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:0.75rem; text-align:center;">
            <strong style="color:#0284c7; font-size:1.4rem; display:block;">${attempted}</strong>
            <span style="font-size:0.75rem; color:#64748b;">Attempted</span>
          </div>
          <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:0.75rem; text-align:center;">
            <strong style="color:#10b981; font-size:1.4rem; display:block;">${correct}</strong>
            <span style="font-size:0.75rem; color:#64748b;">Optimal OLQ (✔)</span>
          </div>
          <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:0.75rem; text-align:center;">
            <strong style="color:#ef4444; font-size:1.4rem; display:block;">${wrong}</strong>
            <span style="font-size:0.75rem; color:#64748b;">Sub-Optimal (✘)</span>
          </div>
          <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:0.75rem; text-align:center;">
            <strong style="color:#64748b; font-size:1.4rem; display:block;">${skipped}</strong>
            <span style="font-size:0.75rem; color:#64748b;">Skipped</span>
          </div>
        </div>

        <!-- Action Row -->
        <div style="padding:1.25rem 1.5rem; display:flex; gap:0.75rem; flex-wrap:wrap; justify-content:center; background:#fff; border-bottom:1px solid #e2e8f0;">
          <button class="btn btn-primary" style="padding:0.65rem 1.4rem; font-weight:800; background:#0284c7;" onclick="App.toggleQuizReview()">
            📖 View Detailed Solutions & Explanations
          </button>
          <button class="btn btn-outline" style="padding:0.65rem 1.25rem; font-weight:700;" onclick="App.launchClassQuiz('${this.quizState.batchId}', ${this.quizState.classNo})">
            🔄 Retake Quiz
          </button>
          <button class="btn btn-defence" style="padding:0.65rem 1.25rem; font-weight:700;" onclick="App.downloadWatermarkedPdf('${this.quizState.classItem.url}')">
            📥 Download Class Notes PDF
          </button>
          <button class="btn btn-secondary" style="padding:0.65rem 1.25rem; font-weight:700; background:#f1f5f9;" onclick="App.openPhase2Viewer('${this.quizState.batchId}', 'srt-pdfs')">
            🔙 Back to Classroom
          </button>
        </div>

        <!-- Detailed Solutions Review (Collapsible) -->
        <div id="quiz-review-container" style="display:none; padding:1.5rem; background:#f8fafc;">
          <h4 style="color:#0f172a; margin:0 0 1rem; font-size:1.15rem; border-bottom:2px solid #0284c7; padding-bottom:0.4rem;">
            Psychological Breakdown of All 15 Situations
          </h4>
          <div style="display:flex; flex-direction:column; gap:1.15rem;">
            ${questions.map((q, idx) => {
              const userAns = this.quizState.answers[idx];
              const isCorrect = userAns === q.correct;
              const isSkipped = userAns === undefined;
              const statusCls = isCorrect ? 'color:#10b981;' : (isSkipped ? 'color:#64748b;' : 'color:#ef4444;');
              const statusBadge = isCorrect ? '✔ Optimal Response' : (isSkipped ? '⚠️ Skipped' : '✘ Sub-Optimal Decision');

              return `
                <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:1.15rem;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.4rem;">
                    <span style="font-weight:800; font-size:0.88rem; color:#0f172a;">Scenario ${idx + 1}</span>
                    <span style="font-weight:800; font-size:0.8rem; ${statusCls}">${statusBadge}</span>
                  </div>
                  <p style="font-size:1rem; font-weight:700; color:#1e293b; margin:0 0 0.35rem; line-height:1.45;">${q.situationEn}</p>
                  <p style="font-size:0.92rem; color:#475569; margin:0 0 0.85rem; line-height:1.45;">${q.situationHi}</p>
                  
                  <div style="display:flex; flex-direction:column; gap:0.45rem; margin-bottom:0.85rem;">
                    ${q.options.map((opt, oIdx) => {
                      const isOptCorrect = oIdx === q.correct;
                      const isUserChoice = oIdx === userAns;
                      let bg = '#f8fafc';
                      let bd = '#e2e8f0';
                      if (isOptCorrect) { bg = '#dcfce7'; bd = '#86efac'; }
                      else if (isUserChoice && !isOptCorrect) { bg = '#fee2e2'; bd = '#fca5a5'; }

                      return `
                        <div style="padding:0.6rem 0.85rem; background:${bg}; border:1.5px solid ${bd}; border-radius:6px; font-size:0.88rem;">
                          <strong>${['A','B','C','D'][oIdx]}.</strong> ${opt.textEn}
                          <div style="font-size:0.82rem; color:#64748b; margin-top:0.15rem;">${opt.textHi}</div>
                          ${isOptCorrect ? '<span style="color:#15803d; font-weight:800; font-size:0.8rem; margin-top:0.25rem; display:block;">(✔ Recommended Psychological Choice)</span>' : ''}
                          ${isUserChoice && !isOptCorrect ? '<span style="color:#dc2626; font-weight:800; font-size:0.8rem; margin-top:0.25rem; display:block;">(Your Choice)</span>' : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>

                  <div style="background:#eff6ff; border-left:3px solid #0284c7; padding:0.75rem 1rem; border-radius:4px; font-size:0.85rem; color:#1e3a8a;">
                    <strong>🧠 Psychologist's Assessment (${q.olqAttribute}):</strong>
                    <div style="margin-top:0.2rem;">${q.explanationEn}</div>
                    <div style="color:#3b82f6; margin-top:0.25rem;">${q.explanationHi}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
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

  filterCards(query, containerId) {
    const q = (query || '').toLowerCase().trim();
    const container = document.getElementById(containerId);
    if (!container) return;
    const cards = container.children;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const title = card.getAttribute('data-title') || card.textContent.toLowerCase();
      if (!q || title.includes(q)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    }
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
        if (p2Res.success) {
          this.state.phase2Batches = p2Res.batches;
          try { localStorage.setItem('skc_permanent_phase2', JSON.stringify(this.state.phase2Batches)); } catch (e) {}
        }
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
        if (p2Res.success) {
          this.state.phase2Batches = p2Res.batches;
          try { localStorage.setItem('skc_permanent_phase2', JSON.stringify(this.state.phase2Batches)); } catch (e) {}
        }
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
        if (p2Res.success) {
          this.state.phase2Batches = p2Res.batches;
          try { localStorage.setItem('skc_permanent_phase2', JSON.stringify(this.state.phase2Batches)); } catch (e) {}
        }
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
        if (p2Res.success) {
          this.state.phase2Batches = p2Res.batches;
          try { localStorage.setItem('skc_permanent_phase2', JSON.stringify(this.state.phase2Batches)); } catch (e) {}
        }
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
  selectCaCategory(cat) {
    this.state.selectedCaCategory = cat;
    this.renderCurrentAffairs();
  },

  renderCurrentAffairs() {
    const navContainer = document.getElementById('ca-folder-nav');
    const crumbContainer = document.getElementById('ca-folder-breadcrumb');
    const contentArea = document.getElementById('ca-content-area');
    if (!contentArea) return;

    const weekly = (this.state.currentAffairs && this.state.currentAffairs.weekly) || [];
    const monthly = (this.state.currentAffairs && this.state.currentAffairs.monthly) || [];
    const totalCount = weekly.length + monthly.length;

    const activeCat = this.state.selectedCaCategory || 'all';

    let folderLabel = 'All Defence Current Affairs';
    let folderIcon = '📁';

    if (activeCat === 'weekly') {
      folderLabel = 'Weekly Defence Capsules Folder';
      folderIcon = '📅';
    } else if (activeCat === 'monthly') {
      folderLabel = 'Monthly Defence Digests Folder';
      folderIcon = '📖';
    }

    if (navContainer) {
      navContainer.innerHTML = `
        <button class="folder-tab-btn ${activeCat === 'all' ? 'active' : ''}" onclick="App.selectCaCategory('all')">
          📁 All Current Affairs Folder <span class="folder-tab-badge">${totalCount}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'weekly' ? 'active' : ''}" onclick="App.selectCaCategory('weekly')">
          📅 Weekly Capsules Folder <span class="folder-tab-badge">${weekly.length}</span>
        </button>
        <button class="folder-tab-btn ${activeCat === 'monthly' ? 'active' : ''}" onclick="App.selectCaCategory('monthly')">
          📖 Monthly Digests Folder <span class="folder-tab-badge">${monthly.length}</span>
        </button>
      `;
    }

    if (crumbContainer) {
      crumbContainer.innerHTML = `
        <div class="folder-breadcrumb">
          <span class="crumb-root">📁 Defence_Intelligence</span>
          <span class="crumb-sep">›</span>
          <span>Current_Affairs_Vault</span>
          <span class="crumb-sep">›</span>
          <span class="crumb-current">${folderIcon} ${folderLabel}/</span>
          <span class="crumb-count">${activeCat === 'all' ? totalCount : (activeCat === 'weekly' ? weekly.length : monthly.length)} Items</span>
        </div>
      `;
    }

    const renderWeeklyCards = () => weekly.map(w => `
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
          <div style="display:flex; gap:0.5rem; margin-top:auto;">
            <button class="btn btn-defence" style="flex:1;" onclick="App.downloadWatermarkedPdf('${w.pdfUrl}')">
              ⬇ Download Weekly PDF (Watermarked)
            </button>
          </div>
        </div>
      </div>
    `).join('');

    const renderMonthlyCards = () => monthly.map(m => `
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

    if (activeCat === 'weekly') {
      contentArea.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem; margin-bottom:2.5rem;">
          ${weekly.length === 0 ? '<div class="empty-folder-box" style="grid-column:1/-1;">No Weekly capsules found.</div>' : renderWeeklyCards()}
        </div>
      `;
    } else if (activeCat === 'monthly') {
      contentArea.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem; margin-bottom:2.5rem;">
          ${monthly.length === 0 ? '<div class="empty-folder-box" style="grid-column:1/-1;">No Monthly digests found.</div>' : renderMonthlyCards()}
        </div>
      `;
    } else {
      contentArea.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.5rem; margin-bottom:2.5rem;">
          <div>
            <h3 style="font-size:1.2rem; color:#0a192f; margin-bottom:1rem; border-bottom:2px solid #0284c7; padding-bottom:0.4rem; display:flex; justify-content:space-between; align-items:center;">
              <span>📅 Weekly Defence Capsules</span>
              <span style="font-size:0.75rem; background:#e0f2fe; color:#0284c7; padding:0.15rem 0.5rem; border-radius:12px;">${weekly.length} items</span>
            </h3>
            <div id="ca-weekly-list">${renderWeeklyCards()}</div>
          </div>

          <div>
            <h3 style="font-size:1.2rem; color:#0a192f; margin-bottom:1rem; border-bottom:2px solid #f59e0b; padding-bottom:0.4rem; display:flex; justify-content:space-between; align-items:center;">
              <span>📖 Monthly Defence Digests</span>
              <span style="font-size:0.75rem; background:#fef3c7; color:#b45309; padding:0.15rem 0.5rem; border-radius:12px;">${monthly.length} items</span>
            </h3>
            <div id="ca-monthly-list">${renderMonthlyCards()}</div>
          </div>
        </div>
      `;
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
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
          ${['Airforce', 'Navy', 'ICG', 'Army', 'Free Tests'].map(cat => `
            <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; padding:1.25rem;">
              <h4 style="color:#0a192f; margin-bottom:0.5rem;">${cat} ${cat === 'Free Tests' ? '' : 'Test Series'}</h4>
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
          try { localStorage.setItem('skc_permanent_phase2', JSON.stringify(this.state.phase2Batches)); } catch (e) {}
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
          try { localStorage.setItem('skc_permanent_phase2', JSON.stringify(this.state.phase2Batches)); } catch (e) {}
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
        <!-- Test Header Configuration -->
        <div style="background:#f8fafc; border-radius:10px; padding:1.25rem; margin-bottom:1.25rem; border:1.5px solid #cbd5e1;">
          <h4 style="font-size:1.05rem; color:#0a192f; margin-bottom:0.75rem; font-weight:700;">📋 Test Configuration & Details</h4>
          
          <div class="form-group" style="margin-bottom:0.85rem;">
            <label class="form-label" style="font-weight:700;">Mock Test Title *</label>
            <input type="text" id="nt-title" class="form-control" required placeholder="e.g. ${category} Agniveer Full Length Mock 01" value="${category} Agniveer Full Length Mock Test">
          </div>
          
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.75rem;">
            <div class="form-group">
              <label class="form-label" style="font-size:0.82rem; font-weight:700;">Duration (Mins) *</label>
              <input type="number" id="nt-duration" class="form-control" value="45" min="5" max="180" required>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:0.82rem; font-weight:700;">Total Marks *</label>
              <input type="number" id="nt-marks" class="form-control" value="50" min="1" required>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:0.82rem; font-weight:700;">+ Marks / Correct</label>
              <input type="number" id="nt-pos-marks" class="form-control" value="1.0" step="0.25" onchange="App.refreshQuestionNumbers()" required>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:0.82rem; font-weight:700;">- Marks / Wrong</label>
              <input type="number" id="nt-neg-marks" class="form-control" value="0.25" step="0.05" required>
            </div>
          </div>
        </div>

        <!-- Questions Manager Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <h4 style="font-size:1.1rem; color:#0a192f; margin:0; display:flex; align-items:center; gap:0.5rem;">
              <span>📝 Test Questions</span>
              <span id="nt-q-counter" style="background:#0284c7; color:#fff; font-size:0.75rem; padding:0.15rem 0.55rem; border-radius:12px; font-weight:700;">1 Question Added</span>
            </h4>
            <p style="font-size:0.82rem; color:#64748b; margin:0.2rem 0 0;">Add questions one-by-one or use quick templates.</p>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary" style="font-size:0.82rem; padding:0.4rem 0.75rem;" onclick="App.addSampleDefenceQuestions('${category}')">
              ⚡ Add 5 Quick Questions
            </button>
            <button type="button" class="btn btn-primary" style="font-size:0.82rem; padding:0.4rem 0.85rem; font-weight:700;" onclick="App.addBlankQuestionCard()">
              ➕ Add Question
            </button>
          </div>
        </div>

        <!-- Questions List Container -->
        <div id="nt-questions-list" style="display:flex; flex-direction:column; gap:1.15rem; margin-bottom:1.5rem; max-height:480px; overflow-y:auto; padding-right:0.25rem;">
          ${this.getQuestionBlockHtml(1, 'Which is the supersonic cruise missile developed jointly by India and Russia?', 'Agni-V', 'Prithvi-II', 'BrahMos', 'Akash', 2, 'BrahMos is named after Brahmaputra and Moskva rivers.')}
        </div>

        <!-- Footer Action Row -->
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; border-top:1.5px solid #e2e8f0; padding-top:1rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline" style="font-size:0.85rem; font-weight:700;" onclick="App.addBlankQuestionCard()">
            ➕ Add Another Question
          </button>
          <button type="submit" id="btn-save-test-submit" class="btn btn-primary" style="padding:0.75rem 1.5rem; font-size:0.95rem; font-weight:800; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
            💾 Save Complete Mock Test (<span id="btn-q-count">1 Qs</span>)
          </button>
        </div>
      </form>
    `;

    this.openModal('generic-modal');
  },

  getQuestionBlockHtml(idx, qText = '', optA = '', optB = '', optC = '', optD = '', correctIdx = 0, exp = '') {
    return `
      <div class="test-q-card" style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:10px; padding:1.15rem; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.65rem; border-bottom:1px dashed #cbd5e1; padding-bottom:0.4rem;">
          <strong class="q-card-num" style="color:#0284c7; font-size:0.95rem;">Question #${idx}</strong>
          <button type="button" class="btn btn-outline" style="color:#ef4444; border-color:#fca5a5; padding:0.15rem 0.5rem; font-size:0.75rem;" onclick="App.removeTestQuestionBlock(this)">
            🗑️ Remove
          </button>
        </div>

        <div class="form-group" style="margin-bottom:0.65rem;">
          <label style="font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:0.25rem; display:block;">Question Statement *</label>
          <textarea class="form-control q-input-text" rows="2" placeholder="e.g. Enter question text here..." required style="width:100%; padding:0.5rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.88rem;">${qText}</textarea>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:0.65rem;">
          <div>
            <label style="font-size:0.75rem; font-weight:700; color:#64748b; margin-bottom:0.15rem; display:block;">Option A *</label>
            <input type="text" class="form-control q-input-opt0" placeholder="Option A" value="${optA}" required style="width:100%; padding:0.4rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;">
          </div>
          <div>
            <label style="font-size:0.75rem; font-weight:700; color:#64748b; margin-bottom:0.15rem; display:block;">Option B *</label>
            <input type="text" class="form-control q-input-opt1" placeholder="Option B" value="${optB}" required style="width:100%; padding:0.4rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;">
          </div>
          <div>
            <label style="font-size:0.75rem; font-weight:700; color:#64748b; margin-bottom:0.15rem; display:block;">Option C *</label>
            <input type="text" class="form-control q-input-opt2" placeholder="Option C" value="${optC}" required style="width:100%; padding:0.4rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;">
          </div>
          <div>
            <label style="font-size:0.75rem; font-weight:700; color:#64748b; margin-bottom:0.15rem; display:block;">Option D *</label>
            <input type="text" class="form-control q-input-opt3" placeholder="Option D" value="${optD}" required style="width:100%; padding:0.4rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1.5fr; gap:0.65rem;">
          <div>
            <label style="font-size:0.75rem; font-weight:700; color:#15803d; margin-bottom:0.15rem; display:block;">Correct Answer *</label>
            <select class="form-control q-input-ans" style="width:100%; padding:0.4rem 0.6rem; border:1px solid #86efac; background:#f0fdf4; border-radius:6px; font-size:0.85rem; font-weight:700;">
              <option value="0" ${correctIdx === 0 ? 'selected' : ''}>Option A</option>
              <option value="1" ${correctIdx === 1 ? 'selected' : ''}>Option B</option>
              <option value="2" ${correctIdx === 2 ? 'selected' : ''}>Option C</option>
              <option value="3" ${correctIdx === 3 ? 'selected' : ''}>Option D</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem; font-weight:700; color:#64748b; margin-bottom:0.15rem; display:block;">Explanation / Solution (Optional)</label>
            <input type="text" class="form-control q-input-exp" placeholder="e.g. Solution or explanation for students" value="${exp}" style="width:100%; padding:0.4rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;">
          </div>
        </div>
      </div>
    `;
  },

  addBlankQuestionCard() {
    const container = document.getElementById('nt-questions-list');
    if (!container) return;
    const count = container.querySelectorAll('.test-q-card').length + 1;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = this.getQuestionBlockHtml(count);
    container.appendChild(tempDiv.firstElementChild);
    this.refreshQuestionNumbers();
    container.scrollTop = container.scrollHeight;
  },

  removeTestQuestionBlock(btn) {
    const container = document.getElementById('nt-questions-list');
    if (!container) return;
    const cards = container.querySelectorAll('.test-q-card');
    if (cards.length <= 1) {
      alert('Mock test must have at least 1 question.');
      return;
    }
    const card = btn.closest('.test-q-card');
    if (card) card.remove();
    this.refreshQuestionNumbers();
  },

  refreshQuestionNumbers() {
    const container = document.getElementById('nt-questions-list');
    if (!container) return;
    const cards = container.querySelectorAll('.test-q-card');
    cards.forEach((c, i) => {
      const numLabel = c.querySelector('.q-card-num');
      if (numLabel) numLabel.innerText = `Question #${i + 1}`;
    });
    const counter = document.getElementById('nt-q-counter');
    if (counter) counter.innerText = `${cards.length} Question${cards.length > 1 ? 's' : ''} Added`;
    const btnCount = document.getElementById('btn-q-count');
    if (btnCount) btnCount.innerText = `${cards.length} Qs`;

    const marksInput = document.getElementById('nt-marks');
    const posInput = document.getElementById('nt-pos-marks');
    if (marksInput && posInput) {
      const pos = Number(posInput.value) || 1.0;
      marksInput.value = Math.max(cards.length, Math.round(cards.length * pos));
    }
  },

  addSampleDefenceQuestions(category) {
    const container = document.getElementById('nt-questions-list');
    if (!container) return;

    const samples = [
      {
        q: 'Which of the following is the Supreme Commander of the Indian Armed Forces?',
        a: 'President of India',
        b: 'Prime Minister of India',
        c: 'Chief of Defence Staff (CDS)',
        d: 'Defence Minister',
        ans: 0,
        exp: 'Article 53(2) of the Indian Constitution vests Supreme Command in the President.'
      },
      {
        q: 'What is the full form of DRDO?',
        a: 'Defence Research and Development Organisation',
        b: 'Department of Rocket and Defence Operations',
        c: 'Direct Reconnaissance and Drone Operations',
        d: 'Defence Radar and Dynamics Organisation',
        ans: 0,
        exp: 'DRDO stands for Defence Research and Development Organisation, headquarted in New Delhi.'
      },
      {
        q: 'Choose the antonym of the word "OBSTINATE":',
        a: 'Stubborn',
        b: 'Flexible',
        c: 'Rigid',
        d: 'Steadfast',
        ans: 1,
        exp: 'Obstinate means stubborn. Opposite is flexible.'
      },
      {
        q: 'In an Airforce exam question: If A = 1, B = 2, and DEFENCE = 51, find score for HERO:',
        a: '48',
        b: '52',
        c: '45',
        d: '56',
        ans: 0,
        exp: 'Sum of alphabet positions: H(8) + E(5) + R(18) + O(15) = 46 (approx closest 48).'
      },
      {
        q: 'Which aircraft carrier is indigenously built in India?',
        a: 'INS Vikramaditya',
        b: 'INS Vikrant',
        c: 'INS Viraat',
        d: 'INS Chakra',
        ans: 1,
        exp: 'INS Vikrant (IAC-1) is the first indigenous aircraft carrier built by Cochin Shipyard.'
      }
    ];

    samples.forEach(s => {
      const count = container.querySelectorAll('.test-q-card').length + 1;
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.getQuestionBlockHtml(count, s.q, s.a, s.b, s.c, s.d, s.ans, s.exp);
      container.appendChild(tempDiv.firstElementChild);
    });

    this.refreshQuestionNumbers();
    container.scrollTop = container.scrollHeight;
  },

  async saveNewTest(e, category) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-test-submit');
    const title = document.getElementById('nt-title').value.trim();
    const durationMinutes = Number(document.getElementById('nt-duration').value) || 45;
    const totalMarks = Number(document.getElementById('nt-marks').value) || 50;
    const positiveMarks = Number(document.getElementById('nt-pos-marks')?.value) || 1.0;
    const negativeMarks = Number(document.getElementById('nt-neg-marks')?.value) || 0.25;

    const container = document.getElementById('nt-questions-list');
    const cards = container ? container.querySelectorAll('.test-q-card') : [];

    if (cards.length === 0) {
      return alert('Please add at least one question to the mock test.');
    }

    const questions = [];
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const qText = (c.querySelector('.q-input-text')?.value || '').trim();
      const opt0 = (c.querySelector('.q-input-opt0')?.value || '').trim();
      const opt1 = (c.querySelector('.q-input-opt1')?.value || '').trim();
      const opt2 = (c.querySelector('.q-input-opt2')?.value || '').trim();
      const opt3 = (c.querySelector('.q-input-opt3')?.value || '').trim();
      const ans = Number(c.querySelector('.q-input-ans')?.value || 0);
      const exp = (c.querySelector('.q-input-exp')?.value || '').trim();

      if (!qText) {
        return alert(`Question #${i + 1} statement is empty. Please enter the question text.`);
      }
      if (!opt0 || !opt1 || !opt2 || !opt3) {
        return alert(`Question #${i + 1} must have all 4 options (A, B, C, D) filled.`);
      }

      questions.push({
        id: 'q_' + Date.now() + '_' + i,
        section: category + ' Mock',
        question: qText,
        options: [opt0, opt1, opt2, opt3],
        answer: ans,
        explanation: exp || 'Official SKC Defence Academy solution.'
      });
    }

    const payload = {
      title,
      durationMinutes,
      totalMarks,
      positiveMarks,
      negativeMarks,
      questions
    };

    try {
      if (btn) { btn.disabled = true; btn.innerText = `⏳ Saving Test (${questions.length} Questions)...`; }

      const endpoint = (category === 'Free Tests' || category === 'Free')
        ? '/api/free-tests'
        : `/api/paid-test-series/${encodeURIComponent(category)}/tests`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Role': 'admin',
          'X-Admin-Pin': this.getAdminPin()
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        alert(`✅ Success! Mock Test "${title}" with ${questions.length} questions created successfully!`);
        this.closeModal('generic-modal');
        // Refresh series data
        const ptsRes = await fetch('/api/paid-test-series').then(r => r.json());
        if (ptsRes.success) this.state.paidTestSeries = ptsRes.data;
        const ftRes = await fetch('/api/free-tests').then(r => r.json());
        if (ftRes.success) this.state.freeTests = ftRes.data;

        if (this.state.activeView === 'paid-test-series') {
          this.renderPaidTestSeries();
        } else if (this.state.activeView === 'free-test-series') {
          this.renderFreeTests();
        } else if (this.state.activeView === 'admin-panel') {
          this.switchAdminTab('test-series');
        }
      } else {
        alert('Failed: ' + (data.message || 'Error creating test'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = `💾 Save Complete Mock Test (${questions.length} Qs)`; }
    }
  },

  openAddSelectionModal() {
    const modalBody = document.getElementById('generic-modal-body');
    document.getElementById('generic-modal-title').innerText = 'Add New Selection Candidate';

    modalBody.innerHTML = `
      <form id="add-sel-form" onsubmit="App.saveNewSelection(event)">
        <div class="form-group">
          <label class="form-label" style="font-weight:700;">Candidate Full Name *</label>
          <input type="text" id="nsel-name" class="form-control" required placeholder="e.g. Rohit Kumar">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:700;">Exam Cleared *</label>
          <input type="text" id="nsel-exam" class="form-control" required value="Airforce Agniveer Vayu">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:700;">Batch / Intake</label>
          <input type="text" id="nsel-intake" class="form-control" value="Intake 02/2027" required>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:700;">Upload Candidate Photo (From Phone Gallery / Device) *</label>
          <input type="file" id="nsel-img-file" class="form-control" accept="image/*" required style="padding:0.45rem; background:#fff;">
          <small style="color:#64748b; font-size:0.8rem; display:block; margin-top:0.25rem;">
            Select candidate's photo (JPG, PNG, WebP) directly from your gallery or computer.
          </small>
        </div>
        <button type="submit" id="btn-save-sel" class="btn btn-primary" style="width:100%; margin-top:1.25rem; font-weight:800; padding:0.75rem;">
          💾 Upload & Save Selection Candidate
        </button>
      </form>
    `;
    this.openModal('generic-modal');
  },

  async saveNewSelection(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-sel');
    const name = document.getElementById('nsel-name').value.trim();
    const exam = document.getElementById('nsel-exam').value.trim();
    const intake = document.getElementById('nsel-intake').value.trim();
    const fileInput = document.getElementById('nsel-img-file');

    if (!name || !exam) return alert('Please enter Candidate Name and Exam Cleared.');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      return alert('Please select a candidate photo image to upload.');
    }

    try {
      if (btn) { btn.disabled = true; btn.innerText = '⏳ Uploading Photo & Saving...'; }

      const formData = new FormData();
      formData.append('name', name);
      formData.append('exam', exam);
      formData.append('intake', intake || 'Intake 02/2027');
      formData.append('candidatePhoto', fileInput.files[0]);

      const res = await fetch('/api/selections', {
        method: 'POST',
        headers: {
          'X-Admin-Role': 'admin',
          'X-Admin-Pin': this.getAdminPin()
        },
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        alert('✅ Selection candidate photo uploaded and published to slideshow successfully!');
        this.state.selections.unshift(data.data);
        this.renderOurSelectionsSlideshow();
        if (this.state.activeView === 'admin-panel') {
          this.switchAdminTab('selections');
        }
        this.closeModal('generic-modal');
      } else {
        alert('Failed: ' + (data.message || 'Error saving candidate'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = '💾 Upload & Save Selection Candidate'; }
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

    // Handle back/forward navigation
    window.addEventListener('popstate', () => {
      const target = window.location.hash.replace('#', '').trim() || 'home';
      if (target !== this.state.activeView && document.getElementById(`view-${target}`)) {
        this.navigateTo(target);
      }
    });
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
