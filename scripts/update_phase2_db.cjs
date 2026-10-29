const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const srtPdfs = [
  { id: "srt_pdf_01", classNo: 1, title: "SRT Class 01: Situation Reaction Test Foundations & Thinking Patterns", filename: "SRT_Class_01.pdf", url: "/uploads/srt_pdfs/SRT_Class_01.pdf", size: "2.2 MB", pages: 32 },
  { id: "srt_pdf_02", classNo: 2, title: "SRT Class 02: Officer Like Qualities (OLQ) in Crisis Scenarios", filename: "SRT_Class_02.pdf", url: "/uploads/srt_pdfs/SRT_Class_02.pdf", size: "2.2 MB", pages: 32 },
  { id: "srt_pdf_03", classNo: 3, title: "SRT Class 03: Speed Response & Time Pressure Formulation", filename: "SRT_Class_03.pdf", url: "/uploads/srt_pdfs/SRT_Class_03.pdf", size: "2.2 MB", pages: 32 },
  { id: "srt_pdf_04", classNo: 4, title: "SRT Class 04: Fire, Accident & Life-Threatening Emergencies", filename: "SRT_Class_04.pdf", url: "/uploads/srt_pdfs/SRT_Class_04.pdf", size: "4.8 MB", pages: 45 },
  { id: "srt_pdf_05", classNo: 5, title: "SRT Class 05: Train, Road & Public Transit Security Reactions", filename: "SRT_Class_05.pdf", url: "/uploads/srt_pdfs/SRT_Class_05.pdf", size: "3.3 MB", pages: 36 },
  { id: "srt_pdf_06", classNo: 6, title: "SRT Class 06: Leadership, Moral Courage & Interpersonal Conflicts", filename: "SRT_Class_06.pdf", url: "/uploads/srt_pdfs/SRT_Class_06.pdf", size: "3.7 MB", pages: 40 },
  { id: "srt_pdf_07", classNo: 7, title: "SRT Class 07: Academic, Financial & Family Stress Scenarios", filename: "SRT_Class_07.pdf", url: "/uploads/srt_pdfs/SRT_Class_07.pdf", size: "4.3 MB", pages: 42 },
  { id: "srt_pdf_08", classNo: 8, title: "SRT Class 08: Military Readiness & Border Crisis Response", filename: "SRT_Class_08.pdf", url: "/uploads/srt_pdfs/SRT_Class_08.pdf", size: "4.5 MB", pages: 44 },
  { id: "srt_pdf_09", classNo: 9, title: "SRT Class 09: Natural Disaster & Flood Evacuation Response", filename: "SRT_Class_09.pdf", url: "/uploads/srt_pdfs/SRT_Class_09.pdf", size: "4.9 MB", pages: 48 },
  { id: "srt_pdf_10", classNo: 10, title: "SRT Class 10: Police, Law & Order & Anti-Social Elements", filename: "SRT_Class_10.pdf", url: "/uploads/srt_pdfs/SRT_Class_10.pdf", size: "5.1 MB", pages: 50 },
  { id: "srt_pdf_11", classNo: 11, title: "SRT Class 11: Teamwork & Subordinate Conflict Resolution", filename: "SRT_Class_11.pdf", url: "/uploads/srt_pdfs/SRT_Class_11.pdf", size: "7.3 MB", pages: 56 },
  { id: "srt_pdf_12", classNo: 12, title: "SRT Class 12: High-Stakes Decision Making Under Fog of War", filename: "SRT_Class_12.pdf", url: "/uploads/srt_pdfs/SRT_Class_12.pdf", size: "7.3 MB", pages: 56 },
  { id: "srt_pdf_13", classNo: 13, title: "SRT Class 13: Weapon Handling & Combat Discipline", filename: "SRT_Class_13.pdf", url: "/uploads/srt_pdfs/SRT_Class_13.pdf", size: "8.3 MB", pages: 60 },
  { id: "srt_pdf_14", classNo: 14, title: "SRT Class 14: Medical First Aid & Casualty Evacuation (CASEVAC)", filename: "SRT_Class_14.pdf", url: "/uploads/srt_pdfs/SRT_Class_14.pdf", size: "7.7 MB", pages: 58 },
  { id: "srt_pdf_15", classNo: 15, title: "SRT Class 15: Cyber Security, Rumour Mongering & Mob Control", filename: "SRT_Class_15.pdf", url: "/uploads/srt_pdfs/SRT_Class_15.pdf", size: "8.3 MB", pages: 60 },
  { id: "srt_pdf_16", classNo: 16, title: "SRT Class 16: Jungle Survival & Night Navigation Crises", filename: "SRT_Class_16.pdf", url: "/uploads/srt_pdfs/SRT_Class_16.pdf", size: "8.1 MB", pages: 60 },
  { id: "srt_pdf_17", classNo: 17, title: "SRT Class 17: Water Crossing, Boat Capsizing & Drowning Rescue", filename: "SRT_Class_17.pdf", url: "/uploads/srt_pdfs/SRT_Class_17.pdf", size: "8.9 MB", pages: 64 },
  { id: "srt_pdf_18", classNo: 18, title: "SRT Class 18: Campus, Hostel & Ragging Deterrence Response", filename: "SRT_Class_18.pdf", url: "/uploads/srt_pdfs/SRT_Class_18.pdf", size: "6.5 MB", pages: 52 },
  { id: "srt_pdf_19", classNo: 19, title: "SRT Class 19: Wildlife Encounter & Venomous Creature Action", filename: "SRT_Class_19.pdf", url: "/uploads/srt_pdfs/SRT_Class_19.pdf", size: "6.3 MB", pages: 50 },
  { id: "srt_pdf_20", classNo: 20, title: "SRT Class 20: Train Derailed & Track Sabotage Reporting", filename: "SRT_Class_20.pdf", url: "/uploads/srt_pdfs/SRT_Class_20.pdf", size: "8.6 MB", pages: 62 },
  { id: "srt_pdf_21", classNo: 21, title: "SRT Class 21: High Altitude Hypothermia & Frostbite Protocol", filename: "SRT_Class_21.pdf", url: "/uploads/srt_pdfs/SRT_Class_21.pdf", size: "7.1 MB", pages: 55 },
  { id: "srt_pdf_22", classNo: 22, title: "SRT Class 22: Desert Navigation & Dehydration Management", filename: "SRT_Class_22.pdf", url: "/uploads/srt_pdfs/SRT_Class_22.pdf", size: "6.3 MB", pages: 50 },
  { id: "srt_pdf_23", classNo: 23, title: "SRT Class 23: Anti-Terrorism & Suspicious Bag Detection", filename: "SRT_Class_23.pdf", url: "/uploads/srt_pdfs/SRT_Class_23.pdf", size: "6.5 MB", pages: 52 },
  { id: "srt_pdf_24", classNo: 24, title: "SRT Class 24: Aerial Emergency, Hijack Alert & Hostage Crisis", filename: "SRT_Class_24.pdf", url: "/uploads/srt_pdfs/SRT_Class_24.pdf", size: "6.9 MB", pages: 54 },
  { id: "srt_pdf_25", classNo: 25, title: "SRT Class 25: Submarine & Naval Damage Control Scenarios", filename: "SRT_Class_25.pdf", url: "/uploads/srt_pdfs/SRT_Class_25.pdf", size: "7.5 MB", pages: 58 },
  { id: "srt_pdf_26", classNo: 26, title: "SRT Class 26: Commando Raid Coordination & Counter Attack", filename: "SRT_Class_26.pdf", url: "/uploads/srt_pdfs/SRT_Class_26.pdf", size: "7.1 MB", pages: 55 },
  { id: "srt_pdf_27", classNo: 27, title: "SRT Class 27: Final Full Mock Scenario Analysis & OLQ Checklist", filename: "SRT_Class_27.pdf", url: "/uploads/srt_pdfs/SRT_Class_27.pdf", size: "7.9 MB", pages: 60 }
];

const srtMockTests = [
  { id: "srt_mock_1", testNo: 1, title: "SKC SRT Full Mock Test 01", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_1.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_2", testNo: 2, title: "SKC SRT Full Mock Test 02", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_2.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_3", testNo: 3, title: "SKC SRT Full Mock Test 03", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_3.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_4", testNo: 4, title: "SKC SRT Full Mock Test 04", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_4.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_5", testNo: 5, title: "SKC SRT Full Mock Test 05", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_5.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_7", testNo: 6, title: "SKC SRT Full Mock Test 06", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_7.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_8", testNo: 7, title: "SKC SRT Full Mock Test 07", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_8.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_9", testNo: 8, title: "SKC SRT Full Mock Test 08", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_9.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_10", testNo: 9, title: "SKC SRT Full Mock Test 09", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_10.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_11", testNo: 10, title: "SKC SRT Full Mock Test 10", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_11.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_12", testNo: 11, title: "SKC SRT Full Mock Test 11", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_12.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_13", testNo: 12, title: "SKC SRT Full Mock Test 12", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_13.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_14", testNo: 13, title: "SKC SRT Full Mock Test 13", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_14.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_15", testNo: 14, title: "SKC SRT Full Mock Test 14", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_15.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_16", testNo: 15, title: "SKC SRT Full Mock Test 15", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_16.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_17", testNo: 16, title: "SKC SRT Full Mock Test 16", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_17.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" },
  { id: "srt_mock_18", testNo: 17, title: "SKC SRT Full Mock Test 17", questions: 45, duration: 30, marking: "+1, 0", url: "/uploads/srt_mocks/SKC_SRT_Mock_Test_18.html", mode: "Bilingual (Hindi / English)", badge: "Full Length CBT", status: "Active" }
];

// Update phase2 in db
if (db.phase2) {
  const b1 = db.phase2.find(b => b.id === 'phase2_1');
  if (b1) {
    b1.srtClassPdfs = srtPdfs;
    b1.srtMockTests = srtMockTests;
    b1.features = [
      "17 Full-Length Interactive CBT SRT Mock Tests (45 Situations in 30 Mins)",
      "27 Official SRT Class PDFs (Classes 01 to 27 with Solved Examples)",
      "Top 30+ Trending Defence GD Topics with Hindi/English Scripts",
      "YouTube Video Demonstrations of Live Mock GD Sessions",
      "Officer Like Qualities (OLQ) Evaluation & Psychological Scoring"
    ];
  }

  const b2 = db.phase2.find(b => b.id === 'phase2_2');
  if (b2) {
    b2.srtClassPdfs = srtPdfs;
    b2.srtMockTests = srtMockTests;
    b2.features = [
      "17 Full-Length Interactive CBT SRT Mock Tests (Bilingual Hindi/English)",
      "27 Official SRT Class PDFs (Classes 01 to 27 with Solved Scenarios)",
      "Instant Psychological Scoring & Officer-Like-Qualities (OLQ) Analysis",
      "Downloadable Watermarked Mock Test Papers & Lecture Notes",
      "Timed 45 Scenarios in 30 Minutes Under Real Exam Conditions"
    ];
  }
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log('Successfully updated phase2_1 and phase2_2 in data/db.json with 27 PDFs and 17 Mock Tests!');
