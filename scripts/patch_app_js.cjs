const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

const targetStart = "  openPhase2Viewer(batchId = 'phase2_1', activeFolder = 'youtube') {";
const targetEnd = "    this.openModal('generic-modal');\n  },";

const startIndex = content.indexOf(targetStart);
if (startIndex === -1) {
  console.error("targetStart not found!");
  process.exit(1);
}

const endIndex = content.indexOf(targetEnd, startIndex);
if (endIndex === -1) {
  console.error("targetEnd not found!");
  process.exit(1);
}

const replacement = `  openPhase2Viewer(batchId = 'phase2_1', activeFolder = 'srt-mocks') {
    const batch = (this.state.phase2Batches || []).find(b => b.id === batchId) || (this.state.phase2Batches || [])[0];
    if (!batch) return;
    const modalBody = document.getElementById('generic-modal-body');
    const isAdmin = this.state.user && this.state.user.role === 'admin';
    document.getElementById('generic-modal-title').innerText = \`\${batch.title} • Classroom\`;

    const videos = batch.youtubeVideos || [];
    const pdfs = batch.classPdfs || [];
    const topics = batch.gdTopics || [];
    const srtPdfs = batch.srtClassPdfs || [];
    const srtMocks = batch.srtMockTests || [];

    if (!activeFolder) activeFolder = 'srt-mocks';

    const isPhase2_1 = batch.id === 'phase2_1';
    const isPhase2_2 = batch.id === 'phase2_2';

    modalBody.innerHTML = \`
      <div class="phase2-folder-viewer">
        <!-- Banner Header (PhysicsWallah Batch Classroom Style) -->
        <div style="background:linear-gradient(135deg, #0a192f 0%, #1e3a8a 100%); color:#fff; padding:1.25rem 1.4rem; border-radius:12px; margin-bottom:1.25rem; border:1.5px solid \${isPhase2_2 ? '#10b981' : '#38bdf8'};">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem; flex-wrap:wrap;">
                <span style="background:\${isPhase2_2 ? '#10b981' : '#38bdf8'}; color:#0a192f; font-weight:800; font-size:0.72rem; padding:0.2rem 0.55rem; border-radius:4px; text-transform:uppercase;">
                  \${isPhase2_2 ? '🎯 AIRFORCE SRT SPECIAL BATCH' : '⭐ AIRFORCE GD + SRT MASTER BATCH'}
                </span>
                <span style="background:rgba(255,255,255,0.15); color:#fff; font-size:0.72rem; font-weight:700; padding:0.2rem 0.5rem; border-radius:4px;">
                  PW-Style Smart Classroom
                </span>
              </div>
              <h3 style="font-size:1.3rem; margin:0 0 0.35rem; color:#fff; font-weight:800;">\${batch.title}</h3>
              <p style="font-size:0.85rem; color:#cbd5e1; margin:0 0 0.6rem; max-width:650px;">
                \${batch.description || 'Complete Phase-II preparation with 17 CBT simulation tests, 27 lecture notes PDFs, and structured discussion frameworks.'}
              </p>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; font-size:0.78rem;">
                <span style="background:rgba(56,189,248,0.2); color:#7dd3fc; padding:0.2rem 0.55rem; border-radius:6px; font-weight:700;">
                  🖥️ \${srtMocks.length} CBT Mocks
                </span>
                <span style="background:rgba(245,158,11,0.2); color:#fcd34d; padding:0.2rem 0.55rem; border-radius:6px; font-weight:700;">
                  📑 \${srtPdfs.length} Lecture PDFs
                </span>
                \${videos.length > 0 ? \`
                  <span style="background:rgba(239,68,68,0.2); color:#fca5a5; padding:0.2rem 0.55rem; border-radius:6px; font-weight:700;">
                    📹 \${videos.length} Video Classes
                  </span>
                \` : ''}
                \${topics.length > 0 ? \`
                  <span style="background:rgba(16,185,129,0.2); color:#6ee7b7; padding:0.2rem 0.55rem; border-radius:6px; font-weight:700;">
                    🗣️ \${topics.length} GD Scripts
                  </span>
                \` : ''}
              </div>
            </div>

            \${isAdmin ? \`
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button class="btn btn-primary" style="font-size:0.8rem; background:#38bdf8; color:#0a192f; font-weight:800;" onclick="App.toggleBatchUpload('video')">
                  + 📹 Add Video
                </button>
                <button class="btn btn-primary" style="font-size:0.8rem; background:#f59e0b; color:#0a192f; font-weight:800;" onclick="App.toggleBatchUpload('pdf')">
                  + 📑 Upload PDF
                </button>
              </div>
            \` : ''}
          </div>
        </div>

        <!-- Admin Inline Upload Container for Video -->
        \${isAdmin ? \`
          <div id="batch-yt-upload-panel" style="display:none; background:#ffffff; border:1.5px solid #38bdf8; border-radius:10px; padding:1.25rem; margin-bottom:1.25rem; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
              <h4 style="color:#0a192f; margin:0; font-size:1.05rem;">📹 Add New Video Link to YouTube Classes Folder</h4>
              <button type="button" class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="App.toggleBatchUpload('video')">✕ Close</button>
            </div>
            <form id="form-batch-video" onsubmit="App.handleBatchUploadVideo(event, '\${batch.id}')">
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
        \` : ''}

        <!-- Admin Inline Upload Container for PDF -->
        \${isAdmin ? \`
          <div id="batch-pdf-upload-panel" style="display:none; background:#ffffff; border:1.5px solid #f59e0b; border-radius:10px; padding:1.25rem; margin-bottom:1.25rem; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
              <h4 style="color:#0a192f; margin:0; font-size:1.05rem;">📑 Upload New Notes PDF to Study Materials Folder</h4>
              <button type="button" class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="App.toggleBatchUpload('pdf')">✕ Close</button>
            </div>
            <form id="form-batch-pdf" onsubmit="App.handleBatchUploadPdf(event, '\${batch.id}')">
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
        \` : ''}

        <!-- PW-Style Classroom Navigation Tabs -->
        <div class="folder-nav-tabs">
          <button class="folder-tab-btn \${activeFolder === 'srt-mocks' ? 'active' : ''}" onclick="App.openPhase2Viewer('\${batch.id}', 'srt-mocks')">
            🖥️ SRT CBT Mock Tests <span class="folder-tab-badge">\${srtMocks.length}</span>
          </button>
          <button class="folder-tab-btn \${activeFolder === 'srt-pdfs' ? 'active' : ''}" onclick="App.openPhase2Viewer('\${batch.id}', 'srt-pdfs')">
            📑 SRT Class PDFs (01-27) <span class="folder-tab-badge">\${srtPdfs.length}</span>
          </button>
          <button class="folder-tab-btn \${activeFolder === 'youtube' ? 'active' : ''}" onclick="App.openPhase2Viewer('\${batch.id}', 'youtube')">
            📹 Video Lectures <span class="folder-tab-badge">\${videos.length}</span>
          </button>
          \${topics.length > 0 ? \`
            <button class="folder-tab-btn \${activeFolder === 'topics' ? 'active' : ''}" onclick="App.openPhase2Viewer('\${batch.id}', 'topics')">
              🗣️ GD Master Scripts <span class="folder-tab-badge">\${topics.length}</span>
            </button>
          \` : ''}
          <button class="folder-tab-btn \${activeFolder === 'srt-engine' ? 'active' : ''}" onclick="App.openPhase2Viewer('\${batch.id}', 'srt-engine')">
            🎯 Quick SRT Simulator
          </button>
        </div>

        <!-- 1. TAB: SRT CBT MOCK TESTS (PW TEST SERIES FORMAT) -->
        \${activeFolder === 'srt-mocks' ? \`
          <div class="folder-view-pane">
            <div class="folder-breadcrumb">
              <span>📁 Classroom_Vault</span>
              <span>›</span>
              <span>\${batch.title.replace(/\\s+/g, '_')}</span>
              <span>›</span>
              <span style="color:#0284c7; font-weight:700;">🖥️ SRT_CBT_Mock_Tests/</span>
              <span class="crumb-count">\${srtMocks.length} Online Tests Available</span>
            </div>

            <!-- Search Bar -->
            <div class="pw-search-box">
              <span>🔍</span>
              <input type="text" placeholder="Search SRT Mock Tests by number or keyword (e.g. Mock 01, Mock 10)..." oninput="App.filterCards(this.value, 'srt-mocks-grid')">
            </div>

            <div id="srt-mocks-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.15rem;">
              \${srtMocks.map(m => \`
                <div class="pw-test-card" data-title="\${m.title.toLowerCase()} mock \${m.testNo} cbt">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem;">
                    <span class="test-num-badge">
                      🎯 MOCK TEST \${String(m.testNo).padStart(2, '0')}
                    </span>
                    <span class="pw-meta-pill pw-pill-green">🟢 Live CBT</span>
                  </div>

                  <h4 style="font-size:1.08rem; color:#0f172a; margin:0.15rem 0; font-weight:800; line-height:1.35;">
                    \${m.title}
                  </h4>

                  <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.25rem;">
                    <span class="pw-meta-pill pw-pill-blue">⏱️ \${m.duration} Mins</span>
                    <span class="pw-meta-pill pw-pill-purple">❓ \${m.questions} Scenarios</span>
                    <span class="pw-meta-pill pw-pill-amber">🎯 Marking: \${m.marking}</span>
                    <span class="pw-meta-pill pw-pill-rose">🌐 Bilingual (Hindi/Eng)</span>
                  </div>

                  <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:auto; padding-top:0.65rem; border-top:1px solid #f1f5f9;">
                    <button class="btn btn-primary" style="flex:1; min-width:140px; font-size:0.85rem; font-weight:800; background:#0284c7; border:none; padding:0.55rem 0.9rem;" onclick="App.launchCbtMockTest('\${m.url}', '\${m.title.replace(/'/g, "\\\\'")}')">
                      🚀 Start CBT Simulation
                    </button>
                    <a href="\${m.url}" target="_blank" class="btn btn-secondary" style="font-size:0.82rem; padding:0.55rem 0.85rem; text-decoration:none; display:inline-flex; align-items:center; gap:0.25rem;" title="Open in Dedicated Tab">
                      ⛶ Fullscreen
                    </a>
                    <a href="\${m.url}" download="\${m.title.replace(/\\s+/g, '_')}.html" class="btn btn-outline" style="font-size:0.82rem; padding:0.55rem 0.75rem; text-decoration:none;" title="Download HTML for offline use">
                      📥 Save
                    </a>
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        \` : ''}

        <!-- 2. TAB: SRT CLASS LECTURE PDFS (PW NOTES REPOSITORY FORMAT) -->
        \${activeFolder === 'srt-pdfs' ? \`
          <div class="folder-view-pane">
            <div class="folder-breadcrumb">
              <span>📁 Classroom_Vault</span>
              <span>›</span>
              <span>\${batch.title.replace(/\\s+/g, '_')}</span>
              <span>›</span>
              <span style="color:#f59e0b; font-weight:700;">📑 SRT_Class_Lecture_PDFs/</span>
              <span class="crumb-count">\${srtPdfs.length} Official PDF Notes</span>
            </div>

            <!-- Search Bar -->
            <div class="pw-search-box">
              <span>🔍</span>
              <input type="text" placeholder="Search 27 SRT Classes (e.g. Class 05, Fire, Disaster, Weapon, Leadership)..." oninput="App.filterCards(this.value, 'srt-pdfs-list')">
            </div>

            <div id="srt-pdfs-list" style="display:flex; flex-direction:column; gap:0.85rem;">
              \${srtPdfs.map(p => \`
                <div class="pw-lecture-card" data-title="\${p.title.toLowerCase()} class \${p.classNo}">
                  <div style="display:flex; align-items:center; gap:0.85rem; flex:1; min-width:240px;">
                    <span class="pw-class-index-tag">CLASS \${String(p.classNo).padStart(2, '0')}</span>
                    <div style="overflow:hidden;">
                      <strong style="color:#0f172a; font-size:0.95rem; display:block; line-height:1.4;">\${p.title}</strong>
                      <div style="display:flex; gap:0.4rem; font-size:0.75rem; color:#64748b; margin-top:0.25rem; flex-wrap:wrap;">
                        <span class="pw-meta-pill pw-pill-rose">📄 Class Note</span>
                        <span class="pw-meta-pill pw-pill-blue">📊 \${p.size}</span>
                        <span class="pw-meta-pill pw-pill-amber">📑 \${p.pages} Pages</span>
                        <span class="pw-meta-pill pw-pill-green">🛡️ Anti-Piracy Watermark</span>
                      </div>
                    </div>
                  </div>

                  <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                    <button class="btn btn-outline" style="padding:0.45rem 0.85rem; font-size:0.82rem;" onclick="App.previewPdf('\${p.url}')">
                      👁️ Preview
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

        <!-- 3. TAB: YOUTUBE VIDEO CLASSES -->
        \${activeFolder === 'youtube' ? \`
          <div class="folder-view-pane">
            <div class="folder-breadcrumb">
              <span>📁 Classroom_Vault</span>
              <span>›</span>
              <span>\${batch.title.replace(/\\s+/g, '_')}</span>
              <span>›</span>
              <span style="color:#ef4444; font-weight:700;">📹 Video_Lectures/</span>
              <span class="crumb-count">\${videos.length} Lectures</span>
            </div>

            \${videos.length === 0 ? \`
              <div class="empty-folder-box">
                <div style="font-size:2.5rem; margin-bottom:0.5rem;">📹</div>
                <h4 style="font-size:1.15rem; color:#0a192f; margin-bottom:0.35rem;">No Video Lectures Uploaded Yet</h4>
                <p style="color:#64748b; font-size:0.88rem; max-width:440px; margin:0 auto 1.25rem;">
                  Daily YouTube video classes by SKC Defence Academy instructors will appear here.
                </p>
                \${isAdmin ? \`
                  <button class="btn btn-primary" style="padding:0.6rem 1.25rem; font-weight:700;" onclick="App.toggleBatchUpload('video')">
                    + Add Video Link
                  </button>
                \` : ''}
              </div>
            \` : \`
              <div style="display:flex; flex-direction:column; gap:1.15rem;">
                \${videos.map(v => \`
                  <div class="folder-item-card">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
                      <span style="background:#ef4444; color:#fff; font-size:0.72rem; font-weight:800; padding:0.15rem 0.45rem; border-radius:4px;">▶ Lecture Video</span>
                      <span style="background:#e0f2fe; color:#0369a1; font-size:0.72rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:4px;">\${v.topic || 'Strategy'}</span>
                      <span style="font-size:0.75rem; color:#64748b; margin-left:auto;">📅 \${v.date || 'Official Class'}</span>
                    </div>

                    <div class="gd-card-media-layout">
                      <div class="gd-card-thumb-container" onclick="App.playVideoModal('\${v.youtubeId}', '\${v.title.replace(/'/g, "\\\\'")}')">
                        <img src="https://img.youtube.com/vi/\${v.youtubeId}/mqdefault.jpg" onerror="this.src='/uploads/banner.png'">
                        <div class="gd-card-thumb-overlay">
                          <div class="gd-card-play-icon">▶</div>
                        </div>
                      </div>

                      <div style="width:100%;">
                        <h4 style="font-size:1.02rem; color:#0a192f; margin-bottom:0.35rem; font-weight:700; line-height:1.35;">\${v.title}</h4>
                        <p style="font-size:0.83rem; color:#475569; margin-bottom:0.65rem; line-height:1.4;">\${v.notes || 'Official discussion points, speaking framework, and psychological breakdown.'}</p>
                      </div>
                    </div>

                    <div class="gd-card-actions-row">
                      <button class="btn btn-secondary" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; font-size:0.8rem; padding:0.45rem 0.85rem;" onclick="App.playVideoModal('\${v.youtubeId}', '\${v.title.replace(/'/g, "\\\\'")}')">
                        ▶ Watch Video Class
                      </button>
                      \${isAdmin ? \`
                        <button class="btn btn-outline" style="color:#ef4444; border-color:#fca5a5; font-size:0.8rem; padding:0.45rem 0.75rem;" onclick="App.deleteBatchVideo('\${batch.id}', '\${v.id}')">
                          🗑️ Delete
                        </button>
                      \` : ''}
                    </div>
                  </div>
                \`).join('')}
              </div>
            \`}
          </div>
        \` : ''}

        <!-- 4. TAB: GD TOPICS & SCRIPTS (ONLY IN GD+SRT) -->
        \${activeFolder === 'topics' ? \`
          <div class="folder-view-pane">
            <div class="folder-breadcrumb">
              <span>📁 Classroom_Vault</span>
              <span>›</span>
              <span>\${batch.title.replace(/\\s+/g, '_')}</span>
              <span>›</span>
              <span style="color:#0284c7; font-weight:700;">🗣️ Top_GD_Topics_and_Scripts/</span>
              <span class="crumb-count">\${topics.length} Defence Topics</span>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.85rem;">
              \${topics.map(g => \`
                <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:10px; padding:1.15rem; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                    <span style="font-size:0.72rem; font-weight:800; color:#0284c7; background:#e0f2fe; padding:0.15rem 0.45rem; border-radius:4px; text-transform:uppercase;">
                      \${g.category || 'Defence Policy'}
                    </span>
                  </div>
                  <h4 style="color:#0f172a; margin:0 0 0.45rem; font-size:1.05rem;">\${g.title}</h4>
                  <p style="font-size:0.86rem; color:#475569; margin-bottom:0.5rem; background:#f8fafc; padding:0.6rem; border-left:3px solid #0284c7; border-radius:4px;">
                    <strong>Opening Speech Script:</strong> "\${g.introduction}"
                  </p>
                  <div style="font-size:0.82rem; color:#1e293b; margin-bottom:0.5rem;">
                    <strong style="color:#16a34a;">Key Arguments FOR:</strong>
                    <ul style="margin-left:1.25rem; margin-top:0.25rem;">
                      \${(g.pros || []).map(p => \`<li>\${p}</li>\`).join('')}
                    </ul>
                  </div>
                  \${g.conclusion ? \`
                    <p style="font-size:0.82rem; color:#334155; margin:0;">
                      <strong style="color:#0284c7;">Balanced Conclusion:</strong> \${g.conclusion}
                    </p>
                  \` : ''}
                </div>
              \`).join('')}
            </div>
          </div>
        \` : ''}

        <!-- 5. TAB: QUICK SRT SIMULATOR -->
        \${activeFolder === 'srt-engine' ? \`
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
        \` : ''}
      </div>
    \`;

    this.openModal('generic-modal');
  },

  launchCbtMockTest(testUrl, testTitle) {
    const modalBody = document.getElementById('generic-modal-body');
    document.getElementById('generic-modal-title').innerText = testTitle || 'SKC Defence CBT Portal';

    modalBody.innerHTML = \`
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0b2a5b; color:#fff; padding:0.6rem 1rem; border-radius:8px 8px 0 0; border-bottom:3px solid #ff9933; flex-wrap:wrap; gap:0.5rem;">
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <span style="font-size:1.2rem;">🖥️</span>
          <div>
            <strong style="font-size:0.95rem; display:block;">\${testTitle}</strong>
            <span style="font-size:0.75rem; color:#cbd5e1;">Airforce Phase-II CBT Simulation Engine</span>
          </div>
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <span style="background:#138808; color:#fff; font-size:0.7rem; font-weight:800; padding:0.2rem 0.5rem; border-radius:4px;">CBT LIVE</span>
          <a href="\${testUrl}" target="_blank" class="btn btn-primary" style="padding:0.35rem 0.85rem; font-size:0.78rem; background:#ff9933; color:#1e293b; text-decoration:none; font-weight:800; border:none;">
            ⛶ Open Fullscreen Window
          </a>
        </div>
      </div>
      <div style="width:100%; height:75vh; min-height:480px; max-height:820px; background:#f2f5fa; border:1px solid #cbd5e1; border-top:none; border-radius:0 0 8px 8px; overflow:hidden;">
        <iframe src="\${testUrl}" style="width:100%; height:100%; border:none; display:block;" title="\${testTitle}"></iframe>
      </div>
    \`;
    this.openModal('generic-modal');
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
  },`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex + targetEnd.length);
fs.writeFileSync(appJsPath, newContent, 'utf8');
console.log('Successfully patched public/js/app.js with PW-Style classroom tabs, CBT launcher, and search filter!');
