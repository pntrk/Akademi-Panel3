export interface Student {
  id: string;
  no: number;
  name: string;
  className: string;
  examRegistrations?: { examId: string; fee: number; isPaid?: boolean; dateRegistered?: string }[];
  leagueTeam?: 'Kutup Yıldızları' | 'Sıçrama Ustaları' | 'Taktik Avcıları' | 'Atanmadı';
  leaguePoints?: number;
  badges?: { 
    kalkan: number; ivme: number; zirve: number; tamIsabet: number; kirmiziKart: number; 
    zirveBekcisi: number; ivmeSampiyonu: number; barajYikici: number; stratejiMuhendisi: number; istikrarElcisi: number;
    lgsFatihi: number; takimRuhu: number; ankaKusu: number; sozelSovalyesi: number; sayisalKalesi: number; matematikUyanisi: number; dengeCambazi: number; keskinNisanci: number; temelAtici: number;
    uyuyanDev: number; sabirTasi: number; yinYang: number; filozof: number; newton: number; pisagor: number;
  };
  lastTransfer?: string;

  // Optik Sınav / OMR öğrenci alanları
  classStr?: string;
  sectionStr?: string;
  booklet?: string;
  isRegistered?: boolean;
  isPaid?: boolean;
}

export interface OmrStudent {
  no: string | number;
  name: string;
  classStr: string;
  sectionStr: string;
  booklet?: string;
}

// Sınavın ders ve soru dağılımı için:
export interface ExamSubject {
  id: number | string;
  name: string;
  count: number;
  section?: number;
}

export type Subject = ExamSubject;

export interface ExamKeys {
  [booklet: string]: string[];
}

export type ExamType = 'publisher' | 'internal';

// Hibrit Deneme Sınavı Mimarisi
export interface BaseExam {
  id: string;
  no?: number;
  date: string;
  name: string;
  participantCount?: number;
  participatingClasses?: string[]; // e.g. ["8-A", "8-B"]
  assignedHalls?: string[]; // array of ExamHall IDs
  institution?: string;
  logo?: string | null;
  studentList?: (Student | OmrStudent)[];
  layoutType?: 'standard' | 'split';
  format?: 'lgs' | 'mebi' | 'tyt' | 'ayt';
  results?: ExamResult[];
}

// Okul İçi (internal) Deneme Sınavı
export interface InternalExam extends BaseExam {
  examType: 'internal';
  keys?: { [booklet: string]: string[] }; // A, B, C, D anahtarları
  subjects?: ExamSubject[];               // Ders soru dağılımları
  optionsCount?: number;                  // 4 veya 5 şık
  penalty?: number;                       // 3 yanlış 1 doğru (3) veya 4 (TYT)
}

// Yayıncı (publisher) Deneme Sınavı
export interface PublisherExam extends BaseExam {
  examType: 'publisher';
  publisher?: string;
  publisherFee?: number;
  orderQuantity?: number;
  gradeOrderQuantities?: Record<string, number>;
}

export interface Exam {
  id: string;
  no?: number;
  date: string;
  name: string;
  participantCount?: number;
  examType?: 'publisher' | 'internal'; // 'publisher' (yayıncı denemesi) | 'internal' (okul içi deneme)

  // Yayıncı Denemesi (publisher) alanları
  publisher?: string;
  publisherFee?: number;
  orderQuantity?: number; // Order quantity for publisher fee
  gradeOrderQuantities?: Record<string, number>; // Order quantity mapped by grade level, e.g. {"8": 50, "Diğer": 10}

  // Okul İçi (internal) ve Optik Sınav (OMR) alanları
  keys?: { [booklet: string]: string[] }; // A, B, C, D anahtarları
  subjects?: ExamSubject[];               // Ders soru dağılımları
  optionsCount?: number;                  // 4 veya 5 şık
  penalty?: number;                       // 3 yanlış 1 doğru (3) veya 4 (TYT)
  layoutType?: 'standard' | 'split';      // Optik form düzeni
  format?: 'lgs' | 'mebi' | 'tyt' | 'ayt';// Sınav formatı

  participatingClasses?: string[]; // e.g. ["8-A", "8-B"]
  assignedHalls?: string[]; // array of ExamHall IDs
  institution?: string;
  logo?: string | null;
  studentList?: (Student | OmrStudent)[];
  omrMap?: any; // Titizlikle saklanan milimetrik OMR koordinat ve şablon haritası
  results?: ExamResult[];
}

export interface LessonDetail {
  D: number;
  Y: number;
  B: number;
  N: number;
  totalQuestions: number;
}

export interface ExamDetail {
  puan: number;
  lessons: Record<string, LessonDetail>;
}

export interface SubjectScore {
  correct: number;
  wrong: number;
  empty: number;
  net: number;
}

export interface EvaluatedScore {
  total: {
    correct: number;
    wrong: number;
    empty: number;
    net: number;
    lgsScore: number;
    percentile: number;
    tytScore?: number;
    aytScore?: number;
    examType?: 'lgs' | 'tyt' | 'ayt' | 'standard';
  };
  subjectScores: {
    [subjectId: number]: SubjectScore;
  };
}

export interface ExamResult {
  id: string;
  studentId?: string;
  studentNo?: number;
  studentName?: string;
  studentClass?: string;
  scores?: Record<string, any>; // examId -> score or EvaluatedScore
  average?: number;
  earnedLP?: number;
  earnedBadges?: string[];

  // Optik Okuma (OMR) Verileri
  name?: string;
  no?: string | number;
  booklet?: string;                       // 'A', 'B', 'C', 'D'
  answers?: string[];                     // Öğrencinin işaretlediği ham cevaplar ['A', 'B', '', ...]
  classStr?: string;                      // Örn: "8"
  sectionStr?: string;                    // Örn: "A"

  // Detaylı Karne ve Başarı Analizi Verileri
  details?: any;                          // LGS / TYT puanı, yüzdelik dilim ve ders bazlı detaylar (ExamDetail)
  evaluatedScore?: EvaluatedScore;        // Ders bazlı doğru/yanlış/net ve toplam puan analizi
  net?: number;                           // Toplam Net
  totalCorrect?: number;                  // Toplam Doğru Soru Sayısı
  totalWrong?: number;                    // Toplam Yanlış Soru Sayısı
  totalEmpty?: number;                    // Toplam Boş Soru Sayısı
  lgsScore?: number;                      // LGS Puanı (MEB Katsayılı)
  tytScore?: number;                      // TYT Puanı (ÖSYM Katsayılı)
  aytScore?: number;                      // AYT Puanı
  percentile?: number;                    // Başarı Yüzdelik Dilimi
  rankInClass?: number;                   // Sınıf İçi Sıralaması
  rankInSchool?: number;                  // Okul Geneli Sıralaması
}

export interface BudgetIncome {
  id: string;
  name: string;
  amount: number;
  studentId?: string;
  examId?: string;
}

export interface BudgetExpense {
  id: string;
  no: number;
  name: string;
  amount: number;
  examId?: string;
}

export interface BudgetDebt {
  id: string;
  name: string;
  amount: number;
}

export interface BudgetData {
  incomes: BudgetIncome[];
  expenses: BudgetExpense[];
  debts: BudgetDebt[];
}

export interface SeatingPlanItem {
  deskNumber: number;
  studentId: string;
  studentNo: number;
  studentName: string;
  studentClass: string;
}

export interface ExamHall {
  id: string;
  name: string;
  capacity?: number;
  examId?: string; // Kept for backwards compatibility
  examIds?: string[]; // Allow multiple exams
  selectedClasses?: string[];
  seatingPlan?: SeatingPlanItem[];
  columns?: {
    id: string;
    deskCount: number;
    seatsPerDesk: number;
    name: string;
  }[];
}

export interface FullBackupSummary {
  studentCount: number;
  examCount: number;
  resultCount: number;
  hallCount: number;
  budgetIncomesCount: number;
  budgetExpensesCount: number;
  budgetDebtsCount: number;
  arenaMentorsCount?: number;
  arenaBonusCount?: number;
  approvedTransferCount?: number;
}

export interface FullBackupData {
  appName: string;
  version: string;
  backupDate: string;
  school?: string;
  modules?: string[];
  summary?: FullBackupSummary;
  students: Student[];
  exams: Exam[];
  results: ExamResult[];
  examHalls: ExamHall[];
  budget: BudgetData;
  leagueMentors?: Record<string, string>;
  leagueTeamPoints?: Record<string, number>;
  approvedTransfers?: { studentNo: number; examName: string; toTeam: string }[];
  admins?: string[];
  teachers?: string[];
  examCalendarPrintSettings?: any;
}

export interface CloudBackupRecord {
  id: string;
  name: string;
  createdAt: string;
  createdByEmail: string;
  createdByName?: string;
  summary: FullBackupSummary;
  data: FullBackupData;
  note?: string;
}

export interface AppNotification {
  id: string;
  type: 'exam_result' | 'exam_created' | 'announcement' | 'arena_update' | 'system';
  title: string;
  message: string;
  createdAt: string;
  createdByEmail?: string;
  createdByName?: string;
  targetRole?: 'all' | 'teachers' | 'students';
  targetGrade?: string; // 'Tümü', '8', '7', '6', '5'
  linkTab?: 'results' | 'exams' | 'league' | 'students' | 'halls' | 'budget';
  readBy?: string[];
  urgent?: boolean;
}

export interface LayoutItem {
  type: 'header' | 'question';
  text?: string;
  cIdx: number;
  y: number;
  h: number;
  qIdx?: number;
  localIdx?: number;
  x?: number;
  subjectId?: string | number;
  subjectName?: string;
  options?: string[];
  bubbleCenters?: { option: string; x: number; y: number }[];
}

export interface Point {
  x: number;
  y: number;
}

export interface Anchors {
  tl: Point;
  tr: Point;
  bl: Point;
  br: Point;
}

export interface LaserMark {
  x: number;
  y: number;
  type: 'info' | 'question';
}

export interface DialogState {
  type: 'alert' | 'confirm';
  msg: string;
  onConfirm?: () => void;
}

declare global {
  interface Window {
    QRious?: any;
    jsQR?: any;
    pdfjsLib?: any;
  }
}
