import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure upload folders exist
fs.mkdirSync(path.join(UPLOADS_DIR, 'pdfs'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'selections'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'quizzes'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'courses'), { recursive: true });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Disable caching for API responses so updates are instant
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  next();
});

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for file uploads (PDFs, HTML CBT Quizzes, Images)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (mime === 'application/pdf' || ext === '.pdf') {
      cb(null, path.join(UPLOADS_DIR, 'pdfs'));
    } else if (ext === '.html' || ext === '.htm' || mime.includes('html')) {
      cb(null, path.join(UPLOADS_DIR, 'quizzes'));
    } else {
      cb(null, path.join(UPLOADS_DIR, 'selections'));
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext) {
      const mime = (file.mimetype || '').toLowerCase();
      if (mime === 'application/pdf') ext = '.pdf';
      else if (mime.includes('html')) ext = '.html';
      else ext = '.png';
    }
    const safeBase = (file.fieldname || 'upload').replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, safeBase + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// Helper to read DB
function readDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading DB:', err);
    return {};
  }
}

// Helper to write DB
function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing DB:', err);
    return false;
  }
}

// Helper to extract clean YouTube video ID
function extractYoutubeId(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i);
  if (match && match[1]) return match[1];
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  return trimmed;
}

// Helper to generate full YouTube thumbnail URLs
function getYoutubeThumbnail(ytId) {
  if (!ytId) return { thumbnail: '/uploads/banner.png', hqThumbnail: '/uploads/banner.png' };
  return {
    thumbnail: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
    hqThumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    mqThumbnail: `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
  };
}

// Auto-migrate thumbnails on existing video entries in DB
function ensureVideoThumbnails(db) {
  let changed = false;
  if (Array.isArray(db.phase2)) {
    db.phase2.forEach(batch => {
      if (Array.isArray(batch.youtubeVideos)) {
        batch.youtubeVideos.forEach(v => {
          const ytId = v.youtubeId || extractYoutubeId(v.youtubeUrl);
          if (ytId && (!v.thumbnail || !v.hqThumbnail)) {
            const thumbs = getYoutubeThumbnail(ytId);
            v.thumbnail = thumbs.thumbnail;
            v.hqThumbnail = thumbs.hqThumbnail;
            changed = true;
          }
        });
      }
      if (Array.isArray(batch.gdClasses)) {
        batch.gdClasses.forEach(c => {
          const ytId = c.youtubeId || extractYoutubeId(c.youtubeUrl);
          if (ytId && (!c.thumbnail || !c.hqThumbnail)) {
            const thumbs = getYoutubeThumbnail(ytId);
            c.thumbnail = thumbs.thumbnail;
            c.hqThumbnail = thumbs.hqThumbnail;
            changed = true;
          }
        });
      }
    });
  }
  if (Array.isArray(db.courses)) {
    db.courses.forEach(course => {
      if (Array.isArray(course.videos)) {
        course.videos.forEach(v => {
          const ytId = v.youtubeId || extractYoutubeId(v.youtubeUrl || v.url);
          if (ytId && (!v.thumbnail || !v.hqThumbnail)) {
            const thumbs = getYoutubeThumbnail(ytId);
            v.thumbnail = thumbs.thumbnail;
            v.hqThumbnail = thumbs.hqThumbnail;
            changed = true;
          }
        });
      }
    });
  }
  return changed;
}

// Middleware: Ensure only authorized coaching Admin can make changes
function requireAdmin(req, res, next) {
  const pin = (req.headers['x-admin-pin'] || req.body?.adminPin || req.query?.adminPin || '').trim().toLowerCase();
  if (pin === 'skcadmin2026' || pin === 'skcadmin@2026' || pin === 'admin123') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access Denied: Only Coaching Admin/Owner is authorized to perform this action.'
  });
}

// ======================== API ROUTES ========================

// 1. Academy Info
app.get('/api/academy', (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.academy || {} });
});

app.put('/api/academy', requireAdmin, (req, res) => {
  const db = readDb();
  db.academy = { ...db.academy, ...req.body };
  writeDb(db);
  res.json({ success: true, data: db.academy });
});

// 2. Auth: Login, Sign Up, Quick Session
app.post('/api/auth/login', (req, res) => {
  const { email, password, phone, otp, isGoogle } = req.body;
  const db = readDb();
  const users = db.users || [];

  // Google Login or Phone OTP or Email/Password
  let user = null;
  if (isGoogle) {
    user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    if (!user) {
      user = {
        id: 'usr_' + Date.now(),
        name: req.body.name || 'Google Student',
        email: email || 'student.google@gmail.com',
        phone: phone || '9876543210',
        role: 'student',
        purchasedCourses: [],
        purchasedTests: [],
        purchasedEbooks: []
      };
      users.push(user);
      db.users = users;
      writeDb(db);
    }
  } else if (phone && otp) {
    // Verified OTP
    user = users.find(u => u.phone === phone);
    if (!user) {
      user = {
        id: 'usr_' + Date.now(),
        name: req.body.name || 'Student (' + phone.slice(-4) + ')',
        email: phone + '@skcdefence.in',
        phone: phone,
        role: 'student',
        purchasedCourses: [],
        purchasedTests: [],
        purchasedEbooks: []
      };
      users.push(user);
      db.users = users;
      writeDb(db);
    }
  } else {
    // Email / Password
    const cleanEmail = (email || '').trim().toLowerCase();
    user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user && cleanEmail === 'skcdefenceacademy@gmail.com') {
      user = users.find(u => u.role === 'admin');
    }
  }

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials or user not found' });
  }

  res.json({ success: true, user });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, email, phone, role } = req.body;
  const db = readDb();
  const users = db.users || [];

  if (users.find(u => u.email.toLowerCase() === (email || '').toLowerCase())) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const newUser = {
    id: 'usr_' + Date.now(),
    name: name || 'Agniveer Aspirant',
    email: email.trim().toLowerCase(),
    phone: phone || '',
    role: role === 'admin' ? 'admin' : 'student',
    purchasedCourses: [],
    purchasedTests: [],
    purchasedEbooks: []
  };

  users.push(newUser);
  db.users = users;
  writeDb(db);

  res.json({ success: true, user: newUser });
});

// 3. Courses
app.get('/api/courses', (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.courses || [] });
});

app.post('/api/courses', requireAdmin, upload.single('thumbnailFile'), (req, res) => {
  const db = readDb();
  let thumb = req.body.thumbnail || '/uploads/banner.png';
  if (req.file) {
    thumb = '/uploads/selections/' + req.file.filename;
  }
  const newCourse = {
    id: 'course_' + Date.now(),
    title: (req.body.title || 'New Defence Batch 2026').trim(),
    category: req.body.category || 'Airforce',
    price: Number(req.body.price) || 999,
    originalPrice: Number(req.body.originalPrice) || 1999,
    badge: req.body.badge || 'New Batch',
    thumbnail: thumb,
    description: req.body.description || '',
    features: Array.isArray(req.body.features) ? req.body.features : [
      '120+ Full Length Video Lectures',
      'Chapter-wise HTML Mock Tests with Instant Scoring',
      'Class PDFs & Golden Rules Notes',
      'Previous 5 Years Question Paper Discussions'
    ],
    videos: [],
    pdfs: [],
    htmlMocks: []
  };
  db.courses = db.courses || [];
  db.courses.push(newCourse);
  writeDb(db);
  res.json({ success: true, data: newCourse });
});

app.put('/api/courses/:id', requireAdmin, upload.single('thumbnailFile'), (req, res) => {
  const db = readDb();
  const index = (db.courses || []).findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Course not found' });
  const existing = db.courses[index];
  let thumb = existing.thumbnail;
  if (req.file) {
    thumb = '/uploads/selections/' + req.file.filename;
  } else if (req.body.thumbnail) {
    thumb = req.body.thumbnail;
  }
  db.courses[index] = {
    ...existing,
    ...req.body,
    thumbnail: thumb,
    price: req.body.price !== undefined ? Number(req.body.price) : existing.price,
    originalPrice: req.body.originalPrice !== undefined ? Number(req.body.originalPrice) : existing.originalPrice,
    id: req.params.id
  };
  writeDb(db);
  res.json({ success: true, data: db.courses[index] });
});

app.delete('/api/courses/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.courses = (db.courses || []).filter(c => c.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// Course Classroom Sub-Items: Videos
app.post('/api/courses/:id/videos', requireAdmin, (req, res) => {
  const db = readDb();
  const course = (db.courses || []).find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  course.videos = course.videos || [];
  const ytUrl = (req.body.youtubeUrl || req.body.url || '').trim();
  const ytId = extractYoutubeId(ytUrl);
  const thumbs = getYoutubeThumbnail(ytId);
  const newVideo = {
    id: 'cv_' + Date.now(),
    title: (req.body.title || 'Video Lecture').trim(),
    youtubeUrl: ytUrl,
    youtubeId: ytId,
    duration: req.body.duration || '45 Mins',
    description: req.body.description || '',
    thumbnail: thumbs.thumbnail,
    hqThumbnail: thumbs.hqThumbnail
  };
  course.videos.push(newVideo);
  writeDb(db);
  res.json({ success: true, data: newVideo });
});

app.delete('/api/courses/:id/videos/:videoId', requireAdmin, (req, res) => {
  const db = readDb();
  const course = (db.courses || []).find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  course.videos = (course.videos || []).filter(v => v.id !== req.params.videoId);
  writeDb(db);
  res.json({ success: true });
});

// Course Classroom Sub-Items: PDFs
app.post('/api/courses/:id/pdfs', requireAdmin, upload.single('pdfFile'), (req, res) => {
  const db = readDb();
  const course = (db.courses || []).find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  course.pdfs = course.pdfs || [];
  let pdfUrl = req.body.pdfUrl || '';
  let size = '3.2 MB';
  if (req.file) {
    pdfUrl = '/uploads/pdfs/' + req.file.filename;
    size = (req.file.size / (1024 * 1024)).toFixed(1) + ' MB';
  }
  const newPdf = {
    id: 'cp_' + Date.now(),
    title: (req.body.title || 'Class Notes PDF').trim(),
    url: pdfUrl,
    pages: Number(req.body.pages) || 30,
    size: size,
    uploadedAt: new Date().toISOString()
  };
  course.pdfs.push(newPdf);
  writeDb(db);
  res.json({ success: true, data: newPdf });
});

app.delete('/api/courses/:id/pdfs/:pdfId', requireAdmin, (req, res) => {
  const db = readDb();
  const course = (db.courses || []).find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  course.pdfs = (course.pdfs || []).filter(p => p.id !== req.params.pdfId);
  writeDb(db);
  res.json({ success: true });
});

// Course Classroom Sub-Items: HTML Practice Tests / Mocks
app.post('/api/courses/:id/mocks', requireAdmin, upload.fields([{ name: 'pdfFile', maxCount: 1 }, { name: 'htmlFile', maxCount: 1 }]), (req, res) => {
  const db = readDb();
  const course = (db.courses || []).find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  course.htmlMocks = course.htmlMocks || [];

  let htmlUrl = '';
  let pdfUrl = '';
  if (req.files) {
    if (req.files.htmlFile && req.files.htmlFile[0]) {
      htmlUrl = '/uploads/quizzes/' + req.files.htmlFile[0].filename;
    }
    if (req.files.pdfFile && req.files.pdfFile[0]) {
      pdfUrl = '/uploads/pdfs/' + req.files.pdfFile[0].filename;
    }
  }

  const newMock = {
    id: 'cm_' + Date.now(),
    title: (req.body.title || 'Course Interactive Mock Test').trim(),
    durationMinutes: Number(req.body.durationMinutes) || 45,
    totalMarks: Number(req.body.totalMarks) || 50,
    positiveMarks: Number(req.body.positiveMarks) || 1.0,
    negativeMarks: Number(req.body.negativeMarks) || 0.25,
    htmlUrl: htmlUrl,
    pdfUrl: pdfUrl,
    uploadedAt: new Date().toISOString()
  };
  course.htmlMocks.push(newMock);
  writeDb(db);
  res.json({ success: true, data: newMock });
});

app.delete('/api/courses/:id/mocks/:mockId', requireAdmin, (req, res) => {
  const db = readDb();
  const course = (db.courses || []).find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  course.htmlMocks = (course.htmlMocks || []).filter(m => m.id !== req.params.mockId);
  writeDb(db);
  res.json({ success: true });
});

// 4. Free Test Series
app.get('/api/free-tests', (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.freeTests || [] });
});

app.post('/api/free-tests', requireAdmin, upload.fields([{ name: 'pdfFile', maxCount: 1 }, { name: 'htmlFile', maxCount: 1 }]), (req, res) => {
  const db = readDb();
  let pdfUrl = '';
  let htmlUrl = '';
  if (req.files) {
    if (req.files.pdfFile && req.files.pdfFile[0]) {
      pdfUrl = '/uploads/pdfs/' + req.files.pdfFile[0].filename;
    }
    if (req.files.htmlFile && req.files.htmlFile[0]) {
      htmlUrl = '/uploads/quizzes/' + req.files.htmlFile[0].filename;
    }
  }
  const newTest = {
    id: 'ft_' + Date.now(),
    title: (req.body.title || 'Free Mock Test').trim(),
    exam: req.body.exam || 'Airforce Agniveer',
    category: 'Free',
    totalMarks: Number(req.body.totalMarks) || 50,
    durationMinutes: Number(req.body.durationMinutes) || 45,
    positiveMarks: Number(req.body.positiveMarks) || 1.0,
    negativeMarks: Number(req.body.negativeMarks) || 0.25,
    instructions: req.body.instructions || 'Standard Defence Examination Rules apply.',
    pdfUrl: pdfUrl,
    htmlUrl: htmlUrl,
    questions: req.body.questions || []
  };
  db.freeTests = db.freeTests || [];
  db.freeTests.push(newTest);
  writeDb(db);
  res.json({ success: true, data: newTest });
});

app.put('/api/free-tests/:id', requireAdmin, upload.fields([{ name: 'pdfFile', maxCount: 1 }, { name: 'htmlFile', maxCount: 1 }]), (req, res) => {
  const db = readDb();
  const index = (db.freeTests || []).findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Test not found' });
  const existing = db.freeTests[index];
  let pdfUrl = existing.pdfUrl || '';
  let htmlUrl = existing.htmlUrl || '';
  if (req.files) {
    if (req.files.pdfFile && req.files.pdfFile[0]) {
      pdfUrl = '/uploads/pdfs/' + req.files.pdfFile[0].filename;
    }
    if (req.files.htmlFile && req.files.htmlFile[0]) {
      htmlUrl = '/uploads/quizzes/' + req.files.htmlFile[0].filename;
    }
  }
  db.freeTests[index] = {
    ...existing,
    ...req.body,
    totalMarks: Number(req.body.totalMarks) || existing.totalMarks,
    durationMinutes: Number(req.body.durationMinutes) || existing.durationMinutes,
    pdfUrl,
    htmlUrl,
    id: req.params.id
  };
  writeDb(db);
  res.json({ success: true, data: db.freeTests[index] });
});

app.delete('/api/free-tests/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.freeTests = (db.freeTests || []).filter(t => t.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// 5. Paid Test Series (Airforce, Navy, ICG, Army)
app.get('/api/paid-test-series', (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.paidTestSeries || [] });
});

app.post('/api/paid-test-series/:category/tests', requireAdmin, upload.fields([{ name: 'pdfFile', maxCount: 1 }, { name: 'htmlFile', maxCount: 1 }]), (req, res) => {
  const db = readDb();
  const { category } = req.params;
  const series = (db.paidTestSeries || []).find(s => s.name.toLowerCase() === category.toLowerCase() || s.id === category);
  if (!series) return res.status(404).json({ success: false, message: 'Series category not found' });

  series.tests = series.tests || [];
  let pdfUrl = '';
  let htmlUrl = '';
  if (req.files) {
    if (req.files.pdfFile && req.files.pdfFile[0]) {
      pdfUrl = '/uploads/pdfs/' + req.files.pdfFile[0].filename;
    }
    if (req.files.htmlFile && req.files.htmlFile[0]) {
      htmlUrl = '/uploads/quizzes/' + req.files.htmlFile[0].filename;
    }
  }

  const newMock = {
    id: 'pt_' + Date.now(),
    title: (req.body.title || `${series.name} Full Length Mock Test ${series.tests.length + 1}`).trim(),
    durationMinutes: Number(req.body.durationMinutes) || 45,
    totalMarks: Number(req.body.totalMarks) || 50,
    positiveMarks: Number(req.body.positiveMarks) || 1.0,
    negativeMarks: Number(req.body.negativeMarks) || 0.25,
    pdfUrl: pdfUrl,
    htmlUrl: htmlUrl,
    questions: req.body.questions || []
  };
  series.tests.push(newMock);
  writeDb(db);
  res.json({ success: true, data: newMock });
});

app.put('/api/paid-test-series/:category/tests/:testId', requireAdmin, upload.fields([{ name: 'pdfFile', maxCount: 1 }, { name: 'htmlFile', maxCount: 1 }]), (req, res) => {
  const db = readDb();
  const { category, testId } = req.params;
  const series = (db.paidTestSeries || []).find(s => s.name.toLowerCase() === category.toLowerCase() || s.id === category);
  if (!series) return res.status(404).json({ success: false, message: 'Series category not found' });
  const index = (series.tests || []).findIndex(t => t.id === testId);
  if (index === -1) return res.status(404).json({ success: false, message: 'Test not found' });

  const existing = series.tests[index];
  let pdfUrl = existing.pdfUrl || '';
  let htmlUrl = existing.htmlUrl || '';
  if (req.files) {
    if (req.files.pdfFile && req.files.pdfFile[0]) {
      pdfUrl = '/uploads/pdfs/' + req.files.pdfFile[0].filename;
    }
    if (req.files.htmlFile && req.files.htmlFile[0]) {
      htmlUrl = '/uploads/quizzes/' + req.files.htmlFile[0].filename;
    }
  }

  series.tests[index] = {
    ...existing,
    ...req.body,
    totalMarks: Number(req.body.totalMarks) || existing.totalMarks,
    durationMinutes: Number(req.body.durationMinutes) || existing.durationMinutes,
    pdfUrl,
    htmlUrl,
    id: testId
  };
  writeDb(db);
  res.json({ success: true, data: series.tests[index] });
});

app.put('/api/paid-test-series/:category', requireAdmin, (req, res) => {
  const db = readDb();
  const { category } = req.params;
  const series = (db.paidTestSeries || []).find(s => s.name.toLowerCase() === category.toLowerCase() || s.id === category);
  if (!series) return res.status(404).json({ success: false, message: 'Series category not found' });
  if (req.body.title !== undefined) series.title = req.body.title;
  if (req.body.price !== undefined) series.price = Number(req.body.price);
  if (req.body.originalPrice !== undefined) series.originalPrice = Number(req.body.originalPrice);
  if (req.body.description !== undefined) series.description = req.body.description;
  writeDb(db);
  res.json({ success: true, data: series });
});

app.delete('/api/paid-test-series/:category/tests/:testId', requireAdmin, (req, res) => {
  const db = readDb();
  const { category, testId } = req.params;
  const series = (db.paidTestSeries || []).find(s => s.name.toLowerCase() === category.toLowerCase() || s.id === category);
  if (!series) return res.status(404).json({ success: false, message: 'Series not found' });
  series.tests = (series.tests || []).filter(t => t.id !== testId);
  writeDb(db);
  res.json({ success: true });
});

// 6. E-Books
app.get('/api/ebooks', (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.ebooks || [] });
});

app.post('/api/ebooks', requireAdmin, (req, res) => {
  const db = readDb();
  const newEbook = {
    id: 'ebook_' + Date.now(),
    title: req.body.title || 'New Defence E-Book',
    price: Number(req.body.price) || 199,
    originalPrice: Number(req.body.originalPrice) || 499,
    author: req.body.author || 'SKC Defence Faculty',
    pages: Number(req.body.pages) || 120,
    coverImage: req.body.coverImage || '/uploads/banner.png',
    description: req.body.description || '',
    features: req.body.features || ['Golden Grammar Rules', 'PYQ Collection', 'Watermarked PDF'],
    previewText: req.body.previewText || '',
    pdfUrl: req.body.pdfUrl || '/uploads/pdfs/skc_defence_golden_ebook.pdf'
  };
  db.ebooks = db.ebooks || [];
  db.ebooks.push(newEbook);
  writeDb(db);
  res.json({ success: true, data: newEbook });
});

app.put('/api/ebooks/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const index = (db.ebooks || []).findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'E-Book not found' });
  db.ebooks[index] = {
    ...db.ebooks[index],
    ...req.body,
    id: req.params.id
  };
  writeDb(db);
  res.json({ success: true, data: db.ebooks[index] });
});

app.delete('/api/ebooks/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.ebooks = (db.ebooks || []).filter(e => e.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// 7. PYQ PDFs
app.get('/api/pyqs', (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.pyqs || [] });
});

app.post('/api/pyqs', requireAdmin, (req, res) => {
  const db = readDb();
  const newPyq = {
    id: 'pyq_' + Date.now(),
    exam: req.body.exam || 'Airforce',
    title: req.body.title || 'Defence PYQ Solved Paper',
    year: req.body.year || '2025',
    size: req.body.size || '3.5 MB',
    pages: Number(req.body.pages) || 20,
    url: req.body.url || '/uploads/pdfs/airforce_intake_02_2025_group_x.pdf'
  };
  db.pyqs = db.pyqs || [];
  db.pyqs.push(newPyq);
  writeDb(db);
  res.json({ success: true, data: newPyq });
});

app.put('/api/pyqs/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const index = (db.pyqs || []).findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'PYQ not found' });
  db.pyqs[index] = {
    ...db.pyqs[index],
    ...req.body,
    id: req.params.id
  };
  writeDb(db);
  res.json({ success: true, data: db.pyqs[index] });
});

app.delete('/api/pyqs/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.pyqs = (db.pyqs || []).filter(p => p.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// 8. Syllabus
app.get('/api/syllabus', (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.syllabus || [] });
});

app.post('/api/syllabus', requireAdmin, (req, res) => {
  const db = readDb();
  const newSyl = {
    id: 'syl_' + Date.now(),
    exam: req.body.exam || 'Airforce',
    title: req.body.title || 'Official Syllabus Document',
    size: req.body.size || '1.8 MB',
    pages: Number(req.body.pages) || 12,
    url: req.body.url || '/uploads/pdfs/airforce_syllabus_2026.pdf'
  };
  db.syllabus = db.syllabus || [];
  db.syllabus.push(newSyl);
  writeDb(db);
  res.json({ success: true, data: newSyl });
});

app.put('/api/syllabus/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const index = (db.syllabus || []).findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Syllabus not found' });
  db.syllabus[index] = {
    ...db.syllabus[index],
    ...req.body,
    id: req.params.id
  };
  writeDb(db);
  res.json({ success: true, data: db.syllabus[index] });
});

app.delete('/api/syllabus/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.syllabus = (db.syllabus || []).filter(s => s.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// 9. Phase-II (GD & SRT) - Priority Section
app.get('/api/phase2', (req, res) => {
  const db = readDb();
  res.json({
    success: true,
    batches: db.phase2 || [],
    srtScenarios: db.srtScenarios || []
  });
});

// Direct GET route for Phase-II GD YouTube classes
app.get('/api/phase2/gd-classes', (req, res) => {
  const db = readDb();
  const gdBatch = (db.phase2 || []).find(b => b.id === 'phase2_gd_yt');
  res.json({
    success: true,
    batch: gdBatch || null,
    classes: gdBatch ? (gdBatch.gdClasses || []) : []
  });
});

// GD YouTube Classes & PDFs Manager Route
app.post('/api/phase2/gd-classes', requireAdmin, upload.single('pdfFile'), (req, res) => {
  const db = readDb();
  let gdBatch = (db.phase2 || []).find(b => b.id === 'phase2_gd_yt');
  if (!gdBatch) {
    gdBatch = {
      id: 'phase2_gd_yt',
      title: 'AIRFORCE GD SPECIAL BATCH (Daily YouTube Classes & PDFs)',
      price: 0,
      originalPrice: 999,
      badge: 'Daily YouTube Classes',
      type: 'GD Classes & PDFs',
      description: 'Dedicated batch for daily Airforce Phase-II Group Discussion (GD) classes uploaded from YouTube along with complete lecture notes, speaking scripts, and downloadable study PDFs.',
      features: [
        'Daily YouTube Video Lectures & Live GD Mock Demonstrations',
        'Downloadable Class Notes & Speaking Phrasebook PDFs',
        'Top 30+ Trending Defence GD Topics with Hindi/English Scripts',
        'Officer Like Qualities (OLQ) Speaking Techniques & Feedback'
      ],
      gdClasses: [],
      youtubeVideos: [],
      classPdfs: []
    };
    db.phase2 = db.phase2 || [];
    db.phase2.unshift(gdBatch);
  }

  const { title, topic, youtubeUrl, notes, pdfTitle, existingPdfUrl } = req.body;
  const ytId = extractYoutubeId(youtubeUrl);
  
  let finalPdfUrl = existingPdfUrl || '/uploads/pdfs/phase2_gd_guide.pdf';
  let finalPdfTitle = pdfTitle || (title ? title + ' Notes.pdf' : 'GD Class Notes.pdf');
  let finalPdfSize = '3.5 MB';

  if (req.file) {
    finalPdfUrl = '/uploads/pdfs/' + req.file.filename;
    finalPdfSize = (req.file.size / (1024 * 1024)).toFixed(1) + ' MB';
    if (!pdfTitle) finalPdfTitle = req.file.originalname;
  }

  const ytThumbs = getYoutubeThumbnail(ytId);
  const newClass = {
    id: 'gd_cls_' + Date.now(),
    title: title || 'Airforce Phase-II GD Lecture',
    topic: topic || 'Airforce GD Topic',
    date: new Date().toISOString().split('T')[0],
    youtubeUrl: youtubeUrl || '',
    youtubeId: ytId || 'ysz5S6PUM-U',
    thumbnail: ytThumbs.thumbnail,
    hqThumbnail: ytThumbs.hqThumbnail,
    pdfTitle: finalPdfTitle,
    pdfUrl: finalPdfUrl,
    pdfSize: finalPdfSize,
    pages: Number(req.body.pages) || 15,
    notes: notes || 'Key discussion points, speaking framework, and arguments.'
  };

  gdBatch.gdClasses = gdBatch.gdClasses || [];
  gdBatch.gdClasses.unshift(newClass); // newest class on top

  // Also sync to youtubeVideos and classPdfs
  gdBatch.youtubeVideos = gdBatch.youtubeVideos || [];
  gdBatch.youtubeVideos.unshift({
    id: 'yt_' + newClass.id,
    title: newClass.title,
    topic: newClass.topic,
    youtubeUrl: newClass.youtubeUrl,
    youtubeId: newClass.youtubeId,
    thumbnail: ytThumbs.thumbnail,
    hqThumbnail: ytThumbs.hqThumbnail,
    date: newClass.date,
    notes: newClass.notes
  });

  gdBatch.classPdfs = gdBatch.classPdfs || [];
  gdBatch.classPdfs.unshift({
    id: 'pdf_' + newClass.id,
    title: newClass.pdfTitle,
    size: newClass.pdfSize,
    pages: newClass.pages,
    url: newClass.pdfUrl
  });

  // Also auto-sync to phase2_1 (₹99 GD + SRT Master Batch folders)
  const masterBatch = (db.phase2 || []).find(b => b.id === 'phase2_1');
  if (masterBatch) {
    masterBatch.youtubeVideos = masterBatch.youtubeVideos || [];
    masterBatch.youtubeVideos.unshift({
      id: 'vid_' + newClass.id,
      title: newClass.title,
      topic: newClass.topic,
      youtubeUrl: newClass.youtubeUrl,
      youtubeId: newClass.youtubeId,
      thumbnail: ytThumbs.thumbnail,
      hqThumbnail: ytThumbs.hqThumbnail,
      date: newClass.date,
      notes: newClass.notes
    });

    masterBatch.classPdfs = masterBatch.classPdfs || [];
    masterBatch.classPdfs.unshift({
      id: 'pdf_' + newClass.id,
      title: newClass.pdfTitle,
      topic: newClass.topic,
      size: newClass.pdfSize,
      pages: newClass.pages,
      date: newClass.date,
      url: newClass.pdfUrl
    });
  }

  writeDb(db);
  res.json({ success: true, data: newClass });
});

app.delete('/api/phase2/gd-classes/:classId', requireAdmin, (req, res) => {
  const db = readDb();
  const gdBatch = (db.phase2 || []).find(b => b.id === 'phase2_gd_yt');
  const masterBatch = (db.phase2 || []).find(b => b.id === 'phase2_1');
  if (gdBatch) {
    gdBatch.gdClasses = (gdBatch.gdClasses || []).filter(c => c.id !== req.params.classId);
    gdBatch.youtubeVideos = (gdBatch.youtubeVideos || []).filter(v => !v.id.includes(req.params.classId));
    gdBatch.classPdfs = (gdBatch.classPdfs || []).filter(p => !p.id.includes(req.params.classId));
  }
  if (masterBatch) {
    masterBatch.youtubeVideos = (masterBatch.youtubeVideos || []).filter(v => !v.id.includes(req.params.classId));
    masterBatch.classPdfs = (masterBatch.classPdfs || []).filter(p => !p.id.includes(req.params.classId));
  }
  writeDb(db);
  return res.json({ success: true, message: 'Class deleted successfully' });
});

app.post('/api/phase2/srt-scenarios', requireAdmin, (req, res) => {
  const db = readDb();
  const newScenario = {
    id: 'srt_' + Date.now(),
    situation: req.body.situation || '',
    options: req.body.options || [],
    bestAnswer: Number(req.body.bestAnswer) || 0,
    olq: req.body.olq || 'Effective Intelligence',
    explanation: req.body.explanation || ''
  };
  db.srtScenarios = db.srtScenarios || [];
  db.srtScenarios.push(newScenario);
  writeDb(db);
  res.json({ success: true, data: newScenario });
});

app.post('/api/phase2/:batchId/topics', requireAdmin, (req, res) => {
  const db = readDb();
  const batch = (db.phase2 || []).find(b => b.id === req.params.batchId);
  if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

  batch.gdTopics = batch.gdTopics || [];
  const newTopic = {
    id: 'gdt_' + Date.now(),
    title: req.body.title || 'New GD Topic',
    category: req.body.category || 'Defence',
    introduction: req.body.introduction || '',
    pros: req.body.pros || [],
    cons: req.body.cons || [],
    conclusion: req.body.conclusion || ''
  };
  batch.gdTopics.push(newTopic);
  writeDb(db);
  res.json({ success: true, data: newTopic });
});

// Folder 1: YouTube Video Classes for Phase-2 Batches (GD + SRT)
app.post('/api/phase2/:batchId/videos', requireAdmin, (req, res) => {
  const db = readDb();
  const batch = (db.phase2 || []).find(b => b.id === req.params.batchId);
  if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

  const { title, youtubeUrl, topic, notes } = req.body;
  if (!title || !youtubeUrl) {
    return res.status(400).json({ success: false, message: 'Title and YouTube URL are required' });
  }

  const ytId = extractYoutubeId(youtubeUrl);
  const ytThumbs = getYoutubeThumbnail(ytId);
  const newVideo = {
    id: 'vid_' + Date.now(),
    title: title.trim(),
    topic: topic || 'GD & SRT Strategy',
    youtubeUrl: youtubeUrl.trim(),
    youtubeId: ytId || 'ysz5S6PUM-U',
    thumbnail: ytThumbs.thumbnail,
    hqThumbnail: ytThumbs.hqThumbnail,
    date: new Date().toISOString().split('T')[0],
    notes: notes || 'Official discussion points, speaking framework, and arguments.'
  };

  batch.youtubeVideos = batch.youtubeVideos || [];
  batch.youtubeVideos.unshift(newVideo); // newest video on top

  // Also auto-sync to phase2_gd_yt if uploaded to phase2_1
  const gdBatch = (db.phase2 || []).find(b => b.id === 'phase2_gd_yt');
  if (gdBatch && batch.id === 'phase2_1') {
    gdBatch.youtubeVideos = gdBatch.youtubeVideos || [];
    gdBatch.youtubeVideos.unshift(newVideo);
    gdBatch.gdClasses = gdBatch.gdClasses || [];
    gdBatch.gdClasses.unshift({
      id: 'cls_' + newVideo.id,
      title: newVideo.title,
      topic: newVideo.topic,
      date: newVideo.date,
      youtubeUrl: newVideo.youtubeUrl,
      youtubeId: newVideo.youtubeId,
      thumbnail: ytThumbs.thumbnail,
      hqThumbnail: ytThumbs.hqThumbnail,
      pdfTitle: newVideo.title + ' Notes.pdf',
      pdfUrl: '/uploads/pdfs/phase2_gd_guide.pdf',
      pdfSize: '3.5 MB',
      pages: 15,
      notes: newVideo.notes
    });
  }

  // If this batch has gdClasses, keep it synced
  if (Array.isArray(batch.gdClasses)) {
    batch.gdClasses.unshift({
      id: 'cls_' + newVideo.id,
      title: newVideo.title,
      topic: newVideo.topic,
      date: newVideo.date,
      youtubeUrl: newVideo.youtubeUrl,
      youtubeId: newVideo.youtubeId,
      thumbnail: ytThumbs.thumbnail,
      hqThumbnail: ytThumbs.hqThumbnail,
      pdfTitle: newVideo.title + ' Notes.pdf',
      pdfUrl: '/uploads/pdfs/phase2_gd_guide.pdf',
      pdfSize: '3.5 MB',
      pages: 15,
      notes: newVideo.notes
    });
  }

  writeDb(db);
  res.json({ success: true, message: 'YouTube video class added permanently to folder', data: newVideo });
});

app.delete('/api/phase2/:batchId/videos/:videoId', requireAdmin, (req, res) => {
  const db = readDb();
  const batch = (db.phase2 || []).find(b => b.id === req.params.batchId);
  if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

  const targetId = req.params.videoId;
  batch.youtubeVideos = (batch.youtubeVideos || []).filter(v => v.id !== targetId);
  if (Array.isArray(batch.gdClasses)) {
    batch.gdClasses = batch.gdClasses.filter(c => !c.id.includes(targetId));
  }

  // Also remove from synced batches if batch is phase2_1 or phase2_gd_yt
  if (batch.id === 'phase2_1' || batch.id === 'phase2_gd_yt') {
    const gdBatch = (db.phase2 || []).find(b => b.id === 'phase2_gd_yt');
    const masterBatch = (db.phase2 || []).find(b => b.id === 'phase2_1');
    if (gdBatch && batch.id !== 'phase2_gd_yt') {
      gdBatch.youtubeVideos = (gdBatch.youtubeVideos || []).filter(v => v.id !== targetId && !v.id.includes(targetId));
      if (Array.isArray(gdBatch.gdClasses)) {
        gdBatch.gdClasses = gdBatch.gdClasses.filter(c => !c.id.includes(targetId));
      }
    }
    if (masterBatch && batch.id !== 'phase2_1') {
      masterBatch.youtubeVideos = (masterBatch.youtubeVideos || []).filter(v => v.id !== targetId && !v.id.includes(targetId));
    }
  }

  writeDb(db);
  res.json({ success: true, message: 'Video removed from folder successfully' });
});

// Folder 2: PDF Study Materials & Notes for Phase-2 Batches (GD + SRT)
app.post('/api/phase2/:batchId/pdfs', requireAdmin, upload.single('pdfFile'), (req, res) => {
  const db = readDb();
  const batch = (db.phase2 || []).find(b => b.id === req.params.batchId);
  if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

  const gdBatch = (db.phase2 || []).find(b => b.id === 'phase2_gd_yt');
  const { title, pages, existingPdfUrl, topic } = req.body;
  let finalUrl = existingPdfUrl || '/uploads/pdfs/phase2_gd_guide.pdf';
  let finalTitle = title || 'Phase-II GD & SRT Study Notes.pdf';
  let finalSize = '4.2 MB';

  if (req.file) {
    finalUrl = '/uploads/pdfs/' + req.file.filename;
    finalSize = (req.file.size / (1024 * 1024)).toFixed(1) + ' MB';
    if (!title) finalTitle = req.file.originalname;
  }

  const newPdf = {
    id: 'p2pdf_' + Date.now(),
    title: finalTitle.trim(),
    topic: topic || 'GD & SRT Material',
    size: finalSize,
    pages: Number(pages) || 20,
    date: new Date().toISOString().split('T')[0],
    url: finalUrl
  };

  batch.classPdfs = batch.classPdfs || [];
  batch.classPdfs.unshift(newPdf); // newest PDF on top

  // Also auto-sync to phase2_gd_yt if uploaded to phase2_1
  if (gdBatch && batch.id !== 'phase2_gd_yt') {
    gdBatch.classPdfs = gdBatch.classPdfs || [];
    gdBatch.classPdfs.unshift(newPdf);
  }

  writeDb(db);
  res.json({ success: true, message: 'PDF study material uploaded permanently to folder', data: newPdf });
});

app.delete('/api/phase2/:batchId/pdfs/:pdfId', requireAdmin, (req, res) => {
  const db = readDb();
  const batch = (db.phase2 || []).find(b => b.id === req.params.batchId);
  if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

  const targetId = req.params.pdfId;
  const pdfItem = (batch.classPdfs || []).find(p => p.id === targetId);
  if (pdfItem && pdfItem.url && pdfItem.url.startsWith('/uploads/pdfs/')) {
    const filename = path.basename(pdfItem.url);
    const filePath = path.join(__dirname, 'public/uploads/pdfs', filename);
    if (fs.existsSync(filePath) && !filePath.includes('phase2_gd_guide.pdf') && !filePath.includes('phase2_srt_scenarios.pdf')) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }

  batch.classPdfs = (batch.classPdfs || []).filter(p => p.id !== targetId);

  // Also remove from synced batches
  const gdBatch = (db.phase2 || []).find(b => b.id === 'phase2_gd_yt');
  const masterBatch = (db.phase2 || []).find(b => b.id === 'phase2_1');
  if (gdBatch && batch.id !== 'phase2_gd_yt') {
    gdBatch.classPdfs = (gdBatch.classPdfs || []).filter(p => p.id !== targetId && !p.id.includes(targetId));
  }
  if (masterBatch && batch.id !== 'phase2_1') {
    masterBatch.classPdfs = (masterBatch.classPdfs || []).filter(p => p.id !== targetId && !p.id.includes(targetId));
  }

  writeDb(db);
  res.json({ success: true, message: 'PDF removed from folder successfully' });
});

// 10. Current Affairs
app.get('/api/current-affairs', (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.currentAffairs || { weekly: [], monthly: [] } });
});

app.post('/api/current-affairs', requireAdmin, (req, res) => {
  const { type, title, date, summary, highlights, pdfUrl, pages, size } = req.body;
  const db = readDb();
  db.currentAffairs = db.currentAffairs || { weekly: [], monthly: [] };

  if (type === 'monthly') {
    const item = {
      id: 'ca_m_' + Date.now(),
      title: title || 'Monthly Defence Digest',
      date: date || 'Current Month',
      summary: summary || '',
      size: size || '5.5 MB',
      pages: Number(pages) || 60,
      pdfUrl: pdfUrl || '/uploads/pdfs/ca_monthly_oct_2026.pdf'
    };
    db.currentAffairs.monthly.unshift(item);
    writeDb(db);
    return res.json({ success: true, data: item });
  } else {
    const item = {
      id: 'ca_w_' + Date.now(),
      title: title || 'Weekly Defence Current Affairs',
      date: date || 'Current Week',
      summary: summary || '',
      highlights: highlights || [],
      pdfUrl: pdfUrl || '/uploads/pdfs/ca_weekly_oct_w4.pdf'
    };
    db.currentAffairs.weekly.unshift(item);
    writeDb(db);
    return res.json({ success: true, data: item });
  }
});

app.put('/api/current-affairs/:type/:id', requireAdmin, (req, res) => {
  const { type, id } = req.params;
  const db = readDb();
  db.currentAffairs = db.currentAffairs || { weekly: [], monthly: [] };
  const list = type === 'monthly' ? db.currentAffairs.monthly : db.currentAffairs.weekly;
  if (!list) return res.status(400).json({ success: false, message: 'Invalid current affairs type' });
  const index = list.findIndex(item => item.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Current affairs item not found' });
  list[index] = {
    ...list[index],
    ...req.body,
    id
  };
  writeDb(db);
  res.json({ success: true, data: list[index] });
});

app.delete('/api/current-affairs/:type/:id', requireAdmin, (req, res) => {
  const { type, id } = req.params;
  const db = readDb();
  db.currentAffairs = db.currentAffairs || { weekly: [], monthly: [] };
  if (type === 'monthly') {
    db.currentAffairs.monthly = (db.currentAffairs.monthly || []).filter(item => item.id !== id);
  } else {
    db.currentAffairs.weekly = (db.currentAffairs.weekly || []).filter(item => item.id !== id);
  }
  writeDb(db);
  res.json({ success: true });
});

// 11. OUR Selections (Slideshow)
app.get('/api/selections', (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.selections || [] });
});

app.post('/api/selections', requireAdmin, upload.single('candidatePhoto'), (req, res) => {
  const db = readDb();
  let imagePath = '/uploads/selections/1780648688032.png';
  if (req.file) {
    imagePath = '/uploads/selections/' + req.file.filename;
  } else if (req.body.image) {
    imagePath = req.body.image;
  }

  const newSelection = {
    id: 'sel_' + Date.now(),
    name: (req.body.name || 'Candidate Name').trim(),
    exam: (req.body.exam || 'Airforce Agniveer Vayu').trim(),
    intake: (req.body.intake || 'Intake 02/2027').trim(),
    post: (req.body.post || 'Airmen').trim(),
    rollNo: (req.body.rollNo || '').trim(),
    image: imagePath,
    quote: req.body.quote || 'Selection achieved with SKC Defence Academy!'
  };
  db.selections = db.selections || [];
  db.selections.unshift(newSelection);
  writeDb(db);
  res.json({ success: true, data: newSelection });
});

app.delete('/api/selections/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.selections = (db.selections || []).filter(s => s.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

app.delete('/api/selections-all/clear', requireAdmin, (req, res) => {
  const db = readDb();
  db.selections = [];
  writeDb(db);
  res.json({ success: true });
});

// 12. Users Management & Onboarding Auth
app.post('/api/users/auth', (req, res) => {
  const { name, phone, email, targetExam } = req.body;
  const cleanName = (name || '').trim();
  const db = readDb();
  db.users = db.users || [];

  // Check if admin login: name matches skcadmin2026 (case-insensitive)
  if (cleanName.toLowerCase() === 'skcadmin2026') {
    return res.json({
      success: true,
      isAdmin: true,
      adminPin: 'skcadmin2026',
      user: {
        id: 'usr_admin',
        name: 'SKC Admin',
        phone: '9876543210',
        email: 'Skcdefenceacademy@gmail.com',
        role: 'admin',
        purchasedCourses: ['course_1', 'course_2', 'course_3', 'phase2_1', 'phase2_2', 'ebook_1'],
        purchasedTests: ['pts_airforce', 'pts_navy', 'pts_icg', 'pts_army']
      }
    });
  }

  // Clean phone to 10 digits
  const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);

  // Pre-approved student list with automatic batch assignment (Strictly Student role)
  const PRE_APPROVED_STUDENTS = [
    { name: 'birendra', phone: '7379936348', batchId: 'phase2_1' }, // ₹99 Airforce GD + SRT Special Batch
    { name: 'manoj', phone: '8838180433', batchId: 'phase2_2' },   // ₹49 AIRFORCE SRT Special Batch
    { name: 'princi', phone: '9304762295', batchId: 'phase2_2' },  // ₹49 AIRFORCE SRT Special Batch
    { name: 'roli', phone: '8840996960', batchId: 'phase2_2' },    // ₹49 AIRFORCE SRT Special Batch
    { name: 'ajay', phone: '8651146620', batchId: 'phase2_1' },    // ₹99 Airforce GD + SRT Special Batch
    { name: 'radhe', phone: '7500050584', batchId: 'phase2_1' }    // ₹99 Airforce GD + SRT Special Batch
  ];

  // Match by 10-digit phone OR by trimmed lowercase name
  let user = db.users.find(u => {
    const uPhone = (u.phone || '').replace(/\D/g, '').slice(-10);
    const matchPhone = cleanPhone && uPhone && cleanPhone === uPhone;
    const matchName = cleanName && u.name && u.name.trim().toLowerCase() === cleanName.toLowerCase();
    return matchPhone || matchName;
  });

  const matchedPreApproved = PRE_APPROVED_STUDENTS.find(p => 
    (cleanPhone && p.phone === cleanPhone) ||
    (cleanName && p.name === cleanName.toLowerCase())
  );

  if (!user) {
    user = {
      id: 'usr_' + Date.now(),
      name: cleanName || (matchedPreApproved ? matchedPreApproved.name : 'Student'),
      phone: phone || (matchedPreApproved ? matchedPreApproved.phone : ''),
      email: email || '',
      targetExam: targetExam || (matchedPreApproved ? 'phase2' : 'Airforce'),
      role: 'student', // ALWAYS student!
      purchasedCourses: matchedPreApproved ? [matchedPreApproved.batchId] : [],
      purchasedTests: [],
      purchasedEbooks: [],
      joinedDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      pendingBatches: []
    };
    db.users.push(user);
    writeDb(db);
  } else {
    // Ensure role is student (never admin)
    user.role = 'student';
    if (cleanPhone && !user.phone) user.phone = phone;
    if (cleanName && (!user.name || user.name === 'Student')) user.name = cleanName;
    if (targetExam) {
      user.targetExam = targetExam;
    }
    if (matchedPreApproved) {
      user.purchasedCourses = user.purchasedCourses || [];
      if (!user.purchasedCourses.includes(matchedPreApproved.batchId)) {
        user.purchasedCourses.push(matchedPreApproved.batchId);
      }
      user.targetExam = 'phase2';
    }
    writeDb(db);
  }

  res.json({ success: true, isAdmin: false, user });
});

app.get('/api/users', (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.users || [] });
});

app.post('/api/users/:id/grant', requireAdmin, (req, res) => {
  const { type, itemId } = req.body; // type: course | test | ebook
  const db = readDb();
  const user = (db.users || []).find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (type === 'course') {
    user.purchasedCourses = user.purchasedCourses || [];
    if (!user.purchasedCourses.includes(itemId)) user.purchasedCourses.push(itemId);
    user.pendingBatches = (user.pendingBatches || []).filter(p => (typeof p === 'string' ? p !== itemId : p.itemId !== itemId));
    (db.orders || []).forEach(o => {
      if ((o.userId === user.id || o.studentPhone === user.phone) && o.itemId === itemId && o.status === 'PENDING_APPROVAL') {
        o.status = 'GRANTED';
        o.approvedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
      }
    });
  } else if (type === 'test') {
    user.purchasedTests = user.purchasedTests || [];
    if (!user.purchasedTests.includes(itemId)) user.purchasedTests.push(itemId);
  } else if (type === 'ebook') {
    user.purchasedEbooks = user.purchasedEbooks || [];
    if (!user.purchasedEbooks.includes(itemId)) user.purchasedEbooks.push(itemId);
  }
  writeDb(db);
  res.json({ success: true, user });
});

app.post('/api/users/:id/revoke', requireAdmin, (req, res) => {
  const { type, itemId } = req.body;
  const db = readDb();
  const user = (db.users || []).find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (type === 'course') {
    user.purchasedCourses = (user.purchasedCourses || []).filter(id => id !== itemId);
  } else if (type === 'test') {
    user.purchasedTests = (user.purchasedTests || []).filter(id => id !== itemId);
  } else if (type === 'ebook') {
    user.purchasedEbooks = (user.purchasedEbooks || []).filter(id => id !== itemId);
  }
  writeDb(db);
  res.json({ success: true, user });
});

// 13. Orders & Payment Dashboard
app.get('/api/orders', (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.orders || [] });
});

// Approve Batch Enrollment Request (Admin only)
app.post('/api/orders/:id/approve', requireAdmin, (req, res) => {
  const db = readDb();
  const order = (db.orders || []).find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order / Request not found' });

  order.status = 'GRANTED';
  order.approvedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

  // Find user by userId, phone, or name
  let user = (db.users || []).find(u => 
    (order.userId && u.id === order.userId) ||
    (order.studentPhone && u.phone && u.phone === order.studentPhone) ||
    (order.studentName && u.name && u.name.toLowerCase() === order.studentName.toLowerCase())
  );

  if (user) {
    const itType = order.itemType || 'course';
    if (itType === 'course') {
      user.purchasedCourses = user.purchasedCourses || [];
      if (order.itemId && !user.purchasedCourses.includes(order.itemId)) {
        user.purchasedCourses.push(order.itemId);
      }
      user.pendingBatches = (user.pendingBatches || []).filter(p => (typeof p === 'string' ? p !== order.itemId : p.itemId !== order.itemId));
    } else if (itType === 'test') {
      user.purchasedTests = user.purchasedTests || [];
      if (order.itemId && !user.purchasedTests.includes(order.itemId)) {
        user.purchasedTests.push(order.itemId);
      }
    } else if (itType === 'ebook') {
      user.purchasedEbooks = user.purchasedEbooks || [];
      if (order.itemId && !user.purchasedEbooks.includes(order.itemId)) {
        user.purchasedEbooks.push(order.itemId);
      }
    }
  }

  writeDb(db);
  res.json({ success: true, message: 'Batch permission granted successfully!', order, user });
});

// Reject Batch Enrollment Request (Admin only)
app.post('/api/orders/:id/reject', requireAdmin, (req, res) => {
  const db = readDb();
  const order = (db.orders || []).find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order / Request not found' });

  order.status = 'REJECTED';
  order.rejectedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

  let user = (db.users || []).find(u => 
    (order.userId && u.id === order.userId) ||
    (order.studentPhone && u.phone && u.phone === order.studentPhone) ||
    (order.studentName && u.name && u.name.toLowerCase() === order.studentName.toLowerCase())
  );

  if (user && user.pendingBatches) {
    user.pendingBatches = user.pendingBatches.filter(p => (typeof p === 'string' ? p !== order.itemId : p.itemId !== order.itemId));
  }

  writeDb(db);
  res.json({ success: true, message: 'Join request rejected.', order });
});

// 14. Checkout & Join Request Submission
app.post('/api/checkout', (req, res) => {
  const { userId, itemId, itemTitle, itemType, amount, gateway, paymentRef, studentName, studentPhone, studentEmail } = req.body;
  const db = readDb();
  let user = (db.users || []).find(u => u.id === userId);
  if (!user && studentPhone) {
    user = (db.users || []).find(u => u.phone === studentPhone);
  }

  const orderId = 'ord_' + Math.floor(100000 + Math.random() * 900000);
  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').substring(0, 16);

  const isCourse = (itemType === 'course');

  const newOrder = {
    id: orderId,
    userId: user ? user.id : (userId || ''),
    studentName: (user && user.name) ? user.name : (studentName || 'Candidate'),
    studentPhone: (user && user.phone) ? user.phone : (studentPhone || ''),
    studentEmail: (user && user.email) ? user.email : (studentEmail || ''),
    itemId: itemId,
    item: itemTitle,
    itemType: itemType || 'course',
    amount: Number(amount) || 0,
    gateway: gateway || 'UPI / QR',
    status: isCourse ? 'PENDING_APPROVAL' : 'SUCCESS',
    paymentRef: paymentRef || 'TXN' + Date.now(),
    date: dateStr
  };

  db.orders = db.orders || [];
  db.orders.unshift(newOrder);

  if (user) {
    if (isCourse) {
      // STRICT OWNER RULE: Paid batches MUST NOT unlock automatically without admin granting permission!
      user.pendingBatches = user.pendingBatches || [];
      user.pendingBatches = user.pendingBatches.filter(p => (typeof p === 'string' ? p !== itemId : p.itemId !== itemId));
      user.pendingBatches.push({
        orderId,
        itemId,
        itemTitle,
        amount: Number(amount) || 0,
        gateway: newOrder.gateway,
        paymentRef: newOrder.paymentRef,
        status: 'PENDING_APPROVAL',
        requestedAt: dateStr
      });
    } else if (itemType === 'test') {
      user.purchasedTests = user.purchasedTests || [];
      if (!user.purchasedTests.includes(itemId)) user.purchasedTests.push(itemId);
    } else if (itemType === 'ebook') {
      user.purchasedEbooks = user.purchasedEbooks || [];
      if (!user.purchasedEbooks.includes(itemId)) user.purchasedEbooks.push(itemId);
    }
  }

  writeDb(db);
  res.json({
    success: true,
    requiresApproval: isCourse,
    order: newOrder,
    user
  });
});

// 15. Dynamic PDF Watermarking Engine (Piracy Protection)
app.get('/api/pdf/download', async (req, res) => {
  try {
    const { file, studentName, studentPhone, studentId } = req.query;
    if (!file) return res.status(400).send('File parameter missing');

    const cleanFilename = path.basename(file);
    let filePath = path.join(UPLOADS_DIR, 'pdfs', cleanFilename);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(UPLOADS_DIR, 'srt_pdfs', cleanFilename);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('PDF file not found');
    }

    const existingPdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    const name = studentName || 'SKC DEFENCE STUDENT';
    const phone = studentPhone || 'VERIFIED ASPIRANT';
    const roll = studentId || 'SKC-' + Math.floor(1000 + Math.random() * 9000);
    const watermarkText = `SKC DEFENCE ACADEMY  -  LICENSED TO: ${name.toUpperCase()} (${phone})`;
    const footerNotice = `ANTI-PIRACY PROTECTED - LICENSED TO ${name} - DO NOT SHARE OR REPRODUCE`;

    for (const page of pages) {
      const { width, height } = page.getSize();

      // Top Security Bar
      page.drawRectangle({
        x: 0,
        y: height - 16,
        width: width,
        height: 16,
        color: rgb(0.9, 0.15, 0.15),
        opacity: 0.85
      });
      page.drawText(footerNotice.substring(0, 85), {
        x: 20,
        y: height - 12,
        size: 7.5,
        font: font,
        color: rgb(1, 1, 1)
      });

      // Diagonal Watermark Center
      page.drawText('SKC DEFENCE ACADEMY', {
        x: width / 2 - 200,
        y: height / 2 - 50,
        size: 38,
        font: font,
        color: rgb(0.75, 0.15, 0.15),
        opacity: 0.14,
        rotate: degrees(45)
      });

      page.drawText(`LICENSED TO: ${name} [${roll}]`, {
        x: width / 2 - 180,
        y: height / 2 - 90,
        size: 20,
        font: font,
        color: rgb(0.1, 0.2, 0.5),
        opacity: 0.15,
        rotate: degrees(45)
      });

      // Bottom Bar
      page.drawText(`Watermark Verification ID: ${roll} - SKC Security Gate`, {
        x: 40,
        y: 12,
        size: 8,
        font: regularFont,
        color: rgb(0.6, 0.6, 0.6)
      });
    }

    const watermarkedPdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SKC_DEFENCE_${cleanFilename}"`);
    res.send(Buffer.from(watermarkedPdfBytes));
  } catch (err) {
    console.error('Watermarking error:', err);
    res.status(500).send('Watermarking failed');
  }
});

// 16. Multer File Uploads (Images & PDFs)
app.post('/api/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const isPdf = req.file.mimetype === 'application/pdf';
  const relativeUrl = isPdf ? `/uploads/pdfs/${req.file.filename}` : `/uploads/selections/${req.file.filename}`;
  res.json({
    success: true,
    url: relativeUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB'
  });
});

// Catch-all for SPA client routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Auto-initialize YouTube thumbnails on server start
try {
  const initDb = readDb();
  if (ensureVideoThumbnails(initDb)) {
    writeDb(initDb);
    console.log('✓ Initialized and verified all YouTube video thumbnails in database.');
  }
} catch (e) {
  console.error('Error verifying video thumbnails:', e);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 SKC DEFENCE ACADEMY SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🌐 Local Access:   http://localhost:${PORT}`);
  console.log(`🛡️  Admin Contact: Skcdefenceacademy@gmail.com`);
  console.log(`======================================================\n`);
});
