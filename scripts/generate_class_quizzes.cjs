const fs = require('fs');
const path = require('path');

const mockDir = path.join(__dirname, '..', 'public', 'uploads', 'srt_mocks');
const dbPath = path.join(__dirname, '..', 'data', 'db.json');

const files = fs.readdirSync(mockDir).filter(f => f.endsWith('.html'));
const allQuestions = [];

files.forEach(f => {
  const content = fs.readFileSync(path.join(mockDir, f), 'utf8');
  const match = content.match(/var Q\s*=\s*(\[[\s\S]*?\]);/);
  if (match) {
    try {
      const IG = ['You will completely ignore the situation and mind your own business.', 'आप स्थिति को पूरी तरह नजरअंदाज करेंगे और अपने काम से काम रखेंगे।'];
      const AG = ['You will aggressively attack the person and start a violent fight.', 'आप व्यक्ति पर आक्रामक रूप से हमला करेंगे और हिंसक लड़ाई शुरू करेंगे।'];
      const CR = ['You will start crying in panic, freeze, and wait helplessly.', 'आप घबराहट में रोने लगेंगे, सुन्न हो जाएंगे और असहाय होकर इंतजार करेंगे।'];
      
      const fn = new Function('IG', 'AG', 'CR', 'return ' + match[1]);
      const qs = fn(IG, AG, CR);
      qs.forEach(q => {
        if (q && q[0] && q[1] && q[2] && q[2].length >= 4) {
          allQuestions.push({
            situationEn: q[0],
            situationHi: q[1],
            options: [
              { textEn: q[2][0][0] || q[2][0], textHi: q[2][0][1] || q[2][0] },
              { textEn: q[2][1][0] || q[2][1], textHi: q[2][1][1] || q[2][1] },
              { textEn: q[2][2][0] || q[2][2], textHi: q[2][2][1] || q[2][2] },
              { textEn: q[2][3][0] || q[2][3], textHi: q[2][3][1] || q[2][3] }
            ],
            correct: q[3] !== undefined ? q[3] : (q[6] !== undefined ? q[6] : 1)
          });
        } else if (q && q.length >= 7) {
          allQuestions.push({
            situationEn: q[0],
            situationHi: q[1],
            options: [
              { textEn: q[2][0], textHi: q[2][1] },
              { textEn: q[3][0], textHi: q[3][1] },
              { textEn: q[4][0], textHi: q[4][1] },
              { textEn: q[5][0], textHi: q[5][1] }
            ],
            correct: q[6]
          });
        }
      });
    } catch(e) {}
  }
});

console.log('Total extracted questions from mocks:', allQuestions.length);

// Deduplicate questions by situationEn
const uniqueQuestions = [];
const seen = new Set();
for (const q of allQuestions) {
  const key = q.situationEn.trim().toLowerCase();
  if (!seen.has(key)) {
    seen.add(key);
    uniqueQuestions.push(q);
  }
}
console.log('Unique questions:', uniqueQuestions.length);

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Topic titles and OLQ attributes for each of the 27 classes
const classMetadata = [
  { no: 1, topic: "Foundations & Quick Decision Making", olq: "Effective Intelligence & Speed of Decision" },
  { no: 2, topic: "Officer Like Qualities (OLQ) in Crisis", olq: "Sense of Responsibility & Initiative" },
  { no: 3, topic: "Speed Response & Time Pressure", olq: "Liveliness & Determination" },
  { no: 4, topic: "Fire, Accident & Medical Emergencies", olq: "Courage & Stamina" },
  { no: 5, topic: "Train, Road & Public Transit Security", olq: "Social Responsibility & Duty" },
  { no: 6, topic: "Leadership, Moral Courage & Ethics", olq: "Moral Courage & Integrity" },
  { no: 7, topic: "Academic, Financial & Family Stress", olq: "Emotional Stability & Adaptability" },
  { no: 8, topic: "Military Readiness & Border Crisis", olq: "Patriotism & Combat Readiness" },
  { no: 9, topic: "Natural Disaster & Flood Evacuation", olq: "Disaster Management & Empathy" },
  { no: 10, topic: "Police, Law & Order & Anti-Social Elements", olq: "Respect for Law & Assertiveness" },
  { no: 11, topic: "Teamwork & Subordinate Conflict Resolution", olq: "Ability to Influence & Cooperation" },
  { no: 12, topic: "High-Stakes Decision Under Fog of War", olq: "Decisiveness Under Pressure" },
  { no: 13, topic: "Weapon Handling & Combat Discipline", olq: "Military Discipline & Safety" },
  { no: 14, topic: "Medical First Aid & Casualty Evacuation", olq: "Resourcefulness & Empathy" },
  { no: 15, topic: "Cyber Security & Mob Control", olq: "Situational Awareness & Calmness" },
  { no: 16, topic: "Jungle Survival & Night Navigation", olq: "Self-Reliance & Endurance" },
  { no: 17, topic: "Water Crossing, Boat Capsizing & Drowning", olq: "Swift Action & Watermanship" },
  { no: 18, topic: "Campus, Hostel & Ragging Deterrence", olq: "Moral Leadership & Fraternal Spirit" },
  { no: 19, topic: "Wildlife Encounter & Wilderness Action", olq: "Presence of Mind & Composure" },
  { no: 20, topic: "Train Derailed & Track Sabotage", olq: "Public Duty & Vigilance" },
  { no: 21, topic: "High Altitude Hypothermia & Frostbite", olq: "Toughness & Survival Acumen" },
  { no: 22, topic: "Desert Navigation & Dehydration", olq: "Resource Conservation & Tenacity" },
  { no: 23, topic: "Anti-Terrorism & Suspicious Object Alert", olq: "National Security Consciousness" },
  { no: 24, topic: "Aerial Emergency & Hostage Crisis", olq: "Crisis Negotiations & Nerve" },
  { no: 25, topic: "Submarine & Naval Damage Control", olq: "Damage Containment & Comradeship" },
  { no: 26, topic: "Commando Raid & Tactical Ambush", olq: "Tactical Acumen & Daring" },
  { no: 27, topic: "Final Full Mock Scenario Analysis & OLQ Checklist", olq: "Holistic Officer Suitability" }
];

// Allocate 15 questions per class
const QUESTIONS_PER_CLASS = 15;
const classQuizzes = [];

for (let i = 0; i < 27; i++) {
  const meta = classMetadata[i];
  const startIndex = (i * QUESTIONS_PER_CLASS) % uniqueQuestions.length;
  const questionsForClass = [];
  
  for (let j = 0; j < QUESTIONS_PER_CLASS; j++) {
    const qIndex = (startIndex + j) % uniqueQuestions.length;
    const baseQ = uniqueQuestions[qIndex];
    questionsForClass.push({
      qId: `c${meta.no}_q${j + 1}`,
      situationEn: baseQ.situationEn,
      situationHi: baseQ.situationHi,
      options: baseQ.options,
      correct: baseQ.correct,
      olqAttribute: meta.olq,
      explanationEn: `Option ${['A','B','C','D'][baseQ.correct]} demonstrates positive initiative, moral courage, and responsible officer-like behavior without panic.`,
      explanationHi: `विकल्प ${['A','B','C','D'][baseQ.correct]} बिना किसी घबराहट के त्वरित निर्णय, नैतिक साहस और कर्तव्यनिष्ठा को प्रदर्शित करता है।`
    });
  }

  classQuizzes.push({
    quizId: `class_quiz_${String(meta.no).padStart(2, '0')}`,
    classNo: meta.no,
    title: `SRT Class ${String(meta.no).padStart(2, '0')} Practice Quiz: ${meta.topic}`,
    olqFocus: meta.olq,
    durationMinutes: 15,
    totalQuestions: QUESTIONS_PER_CLASS,
    questions: questionsForClass
  });
}

// Attach quiz to each item in srtClassPdfs in both phase2_1 and phase2_2
if (db.phase2) {
  const b1 = db.phase2.find(b => b.id === 'phase2_1');
  if (b1 && b1.srtClassPdfs) {
    b1.srtClassPdfs.forEach((p, idx) => {
      p.quiz = classQuizzes[idx];
    });
  }

  const b2 = db.phase2.find(b => b.id === 'phase2_2');
  if (b2 && b2.srtClassPdfs) {
    b2.srtClassPdfs.forEach((p, idx) => {
      p.quiz = classQuizzes[idx];
    });
  }
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log('Successfully added interactive Quizzes to all 27 SRT Classes in db.json!');
