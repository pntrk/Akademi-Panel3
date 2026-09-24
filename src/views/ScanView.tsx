import React, { useState, useEffect, useRef, useMemo } from 'react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { Exam, Anchors, Point, LaserMark, Student, ExamResult, OmrStudent } from '../types';
import { DEFAULT_OMR, OMR_SPECS, OPTS_4, OPTS_5, getHomography, applyHomography, getQuestionsLayout, calculateScore, formatClassSec, createUnifiedExamResult, getBookletBubblePositions, getQrCodeBox, warpPerspectiveToCanvas, evaluateQuestionAnswer, evaluateBubbleFill, sampleLocalBackground } from '../lib/omrEngine';
import { useAppContext } from '../context/AppContext';
import { generateId } from '../lib/utils';
import {
  Camera,
  CheckCircle2,
  Video,
  Upload,
  Smartphone,
  SlidersHorizontal,
  Sparkles,
  RotateCcw,
  RotateCw,
  Zap,
  RefreshCw,
  X,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  FileCheck,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Eye,
  Play,
  Trash2,
  ListOrdered,
  Lock,
  Unlock,
  BookOpen
} from 'lucide-react';

export interface PageThumbnail {
  id: string;
  index: number;
  fileName: string;
  pageNum: number;
  file: File;
  thumbUrl: string;
  status: 'pending' | 'processing' | 'success' | 'warning' | 'error';
  studentName?: string;
  studentNo?: string;
  booklet?: string;
  net?: number;
}

export interface BatchProcessItem {
  pageIndex: number;
  fileName: string;
  status: 'pending' | 'processing' | 'success' | 'warning' | 'error';
  studentName?: string;
  studentNo?: string;
  booklet?: string;
  net?: number;
  message?: string;
}

export const findAnchorsCore = (context: CanvasRenderingContext2D, w: number, h: number): { pts: Anchors; lockFailed: boolean } => {
  const imgData = context.getImageData(0, 0, w, h).data;
  const intImg = new Uint32Array(w * h);

  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const l = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
      rowSum += l;
      intImg[y * w + x] = rowSum + (y > 0 ? intImg[(y - 1) * w + x] : 0);
    }
  }

  const getBoxSum = (x1: number, y1: number, x2: number, y2: number) => {
    x1 = Math.max(0, Math.min(w - 1, Math.floor(x1)));
    y1 = Math.max(0, Math.min(h - 1, Math.floor(y1)));
    x2 = Math.max(0, Math.min(w - 1, Math.floor(x2)));
    y2 = Math.max(0, Math.min(h - 1, Math.floor(y2)));

    const A = (x1 > 0 && y1 > 0) ? intImg[(y1 - 1) * w + (x1 - 1)] : 0;
    const B = (y1 > 0) ? intImg[(y1 - 1) * w + x2] : 0;
    const C = (x1 > 0) ? intImg[y2 * w + (x1 - 1)] : 0;
    const D = intImg[y2 * w + x2];
    return D - B - C + A;
  };

  const getBoxAvg = (x1: number, y1: number, x2: number, y2: number) => {
    const cx1 = Math.max(0, Math.min(w - 1, Math.floor(x1)));
    const cy1 = Math.max(0, Math.min(h - 1, Math.floor(y1)));
    const cx2 = Math.max(0, Math.min(w - 1, Math.floor(x2)));
    const cy2 = Math.max(0, Math.min(h - 1, Math.floor(y2)));
    const area = (cx2 - cx1 + 1) * (cy2 - cy1 + 1);
    if (area <= 0) return 255;
    return getBoxSum(cx1, cy1, cx2, cy2) / area;
  };

  const findAnchorNear = (targetX: number, targetY: number, _isTop: boolean) => {
    let bestAnchor: { x: number; y: number; score: number } | null = null;
    let minScore = Infinity;

    const srX = w * 0.35;
    const srY = h * 0.35;

    const startX = Math.max(w * 0.035, targetX - srX);
    const endX = Math.min(w * 0.965, targetX + srX);
    const startY = Math.max(h * 0.025, targetY - srY);
    const endY = Math.min(h * 0.975, targetY + srY);

    for (let y = startY; y < endY; y += 3) {
      for (let x = startX; x < endX; x += 3) {
        const coreAvg = getBoxAvg(x - 2, y - 2, x + 2, y + 2);
        if (coreAvg > 160) continue;

        let left = x, right = x, top = y, bottom = y;
        const threshold = Math.min(200, coreAvg + 40);

        while (left > 0 && getBoxAvg(left - 1, y, left - 1, y) < threshold) left--;
        while (right < w - 1 && getBoxAvg(right + 1, y, right + 1, y) < threshold) right++;
        while (top > 0 && getBoxAvg(x, top - 1, x, top - 1) < threshold) top--;
        while (bottom < h - 1 && getBoxAvg(x, bottom + 1, x, bottom + 1) < threshold) bottom++;

        const bw = right - left;
        const bh = bottom - top;

        if (bw >= 10 && bw <= 180 && bh >= 10 && bh <= 180) {
          const ratio = bw / bh;
          if (ratio > 0.4 && ratio < 2.5) {
            let sumX = 0, sumY = 0, weightSum = 0;
            for (let py = top; py <= bottom; py += 1) {
              for (let px = left; px <= right; px += 1) {
                const avg = getBoxAvg(px - 1, py - 1, px + 1, py + 1);
                if (avg < threshold) {
                  let weight = 255 - avg;
                  weight = weight * weight;
                  sumX += px * weight;
                  sumY += py * weight;
                  weightSum += weight;
                }
              }
            }

            const cx = weightSum > 0 ? sumX / weightSum : left + (bw / 2);
            const cy = weightSum > 0 ? sumY / weightSum : top + (bh / 2);

            const dist = Math.hypot(cx - targetX, cy - targetY);
            const shapePenalty = Math.abs(bw - bh) * 1.5;
            const score = dist + shapePenalty + (coreAvg * 0.5);

            if (score < minScore) {
              minScore = score;
              bestAnchor = { x: cx, y: cy, score: score };
            }
          }
        }
      }
    }
    return bestAnchor;
  };

  const marginXRatio = DEFAULT_OMR.anchorMargin / DEFAULT_OMR.paperW;
  const marginYRatio = DEFAULT_OMR.anchorMargin / DEFAULT_OMR.paperH;

  const defTL = { x: w * marginXRatio, y: h * marginYRatio };
  const defTR = { x: w * (1 - marginXRatio), y: h * marginYRatio };
  const defBL = { x: w * marginXRatio, y: h * (1 - marginYRatio) };
  const defBR = { x: w * (1 - marginXRatio), y: h * (1 - marginYRatio) };

  const tl = findAnchorNear(defTL.x, defTL.y, true);
  const tr = findAnchorNear(defTR.x, defTR.y, true);
  const bl = findAnchorNear(defBL.x, defBL.y, false);
  const br = findAnchorNear(defBR.x, defBR.y, false);

  let lockFailed = !tl || !tr || !bl || !br;

  const finalTL = tl || defTL;
  const finalTR = tr || defTR;
  const finalBL = bl || defBL;
  const finalBR = br || defBR;

  if (!lockFailed) {
    if (finalTR.x - finalTL.x < w * 0.6 || finalBR.x - finalBL.x < w * 0.6) lockFailed = true;
    if (finalBL.y - finalTL.y < h * 0.6 || finalBR.y - finalTR.y < h * 0.6) lockFailed = true;
  }

  return { pts: { tl: finalTL, tr: finalTR, bl: finalBL, br: finalBR }, lockFailed };
};

interface ScanViewProps {
  examId?: string;
  onClose?: () => void;
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

export function ScanView({ examId: propExamId, onClose, activeTab = 'scan', onNavigate }: ScanViewProps) {
  const { state, saveOmrExamResults } = useAppContext();

  // Tüm deneme sınavları (öncelik internal, yoksa tümü)
  const allExams = useMemo(() => {
    return state.exams && state.exams.length > 0 ? state.exams : [];
  }, [state.exams]);

  const internalExams = useMemo(() => {
    const list = state.exams.filter(e => e.examType === 'internal' || (!e.examType && e.keys && Object.keys(e.keys).length > 0));
    return list.length > 0 ? list : state.exams;
  }, [state.exams]);

  // Aktif sınav seçimi (prop olarak gelirse, sessionStorage'dan veya listeden seçilirse)
  const [lockToSelectedExam, setLockToSelectedExam] = useState<boolean>(false);
  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    if (propExamId) return String(propExamId);
    try {
      const savedId = sessionStorage.getItem('active_exam_id');
      if (savedId && state.exams.some(e => String(e.id) === String(savedId))) {
        return String(savedId);
      }
    } catch (e) {}
    if (internalExams.length > 0) return String(internalExams[0].id);
    return state.exams.length > 0 ? String(state.exams[0].id) : "";
  });

  const exam: Exam = state.exams.find(e => String(e.id) === String(selectedExamId))
    || internalExams.find(e => String(e.id) === String(selectedExamId))
    || internalExams[0]
    || state.exams[0]
    || {
    id: "1",
    name: "Örnek Deneme Sınavı",
    examType: 'internal',
    date: new Date().toLocaleDateString('tr-TR'),
    subjects: [
      { id: 1, name: "Türkçe", count: 20, section: 1 },
      { id: 2, name: "T.C. İnkılap", count: 10, section: 1 },
      { id: 3, name: "Din Kültürü", count: 10, section: 1 },
      { id: 4, name: "İngilizce", count: 10, section: 1 },
      { id: 5, name: "Matematik", count: 20, section: 2 },
      { id: 6, name: "Fen Bilimleri", count: 20, section: 2 }
    ],
    optionsCount: 4,
    penalty: 3,
    keys: { A: Array(90).fill(""), B: Array(90).fill(""), C: [], D: [] },
    results: []
  };

  useEffect(() => {
    if (propExamId && String(propExamId) !== selectedExamId) {
      setSelectedExamId(String(propExamId));
      try { sessionStorage.setItem('active_exam_id', String(propExamId)); } catch(e) {}
      const target = state.exams.find(e => String(e.id) === String(propExamId));
      if (target) {
        detectedExamRef.current = target;
      }
    }
  }, [propExamId, state.exams]);

  const totalQ = (exam.subjects && exam.subjects.length > 0)
    ? exam.subjects.reduce((sum, s) => sum + s.count, 0)
    : 90;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const arGuideRef = useRef<HTMLDivElement | null>(null);
  const lockCounter = useRef(0);

  const nativeCameraRef = useRef<HTMLInputElement | null>(null);

  const autoRotateTriedRef = useRef(0);
  const autoAlignTriedRef = useRef(false);

  // Otomatik Tanıma, Hızlı Seri Okuma Koruması (2.5s Cooldown) ve Anlık Bildirim
  const scanCooldownRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });
  const detectedExamRef = useRef<Exam | null>(null);
  const [scanSuccessCard, setScanSuccessCard] = useState<{
    studentName: string;
    studentNo: string;
    booklet: string;
    net: number;
    examName: string;
  } | null>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [omrImg, setOmrImg] = useState<HTMLImageElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");

  const [anchors, setAnchors] = useState<Anchors | null>(null);
  const [draggingNode, setDraggingNode] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);

  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchIndex, setBatchIndex] = useState(-1);
  const [pageThumbnails, setPageThumbnails] = useState<PageThumbnail[]>([]);
  const batchFilesRef = useRef<File[]>([]);
  const batchIndexRef = useRef<number>(-1);

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    stage: 'extracting' | 'processing' | 'done';
    statusText: string;
  }>({
    current: 0,
    total: 0,
    stage: 'extracting',
    statusText: ''
  });
  const [batchItems, setBatchItems] = useState<BatchProcessItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const batchAbortRef = useRef(false);

  const [autoMode, setAutoMode] = useState(false);
  const [autoSaveSingle, setAutoSaveSingle] = useState(true);
  const [expectedFormat, setExpectedFormat] = useState('auto');
  const [laserMarks, setLaserMarks] = useState<LaserMark[]>([]);

  const [rotation90, setRotation90] = useState(0);
  const [fineAngle, setFineAngle] = useState(0);

  const [homographyMat, setHomographyMat] = useState<number[] | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [lockLevel, setLockLevel] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [detectedQrCode, setDetectedQrCode] = useState<string | null>(null);
  const [toastAlert, setToastAlert] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const scannedFormatRef = useRef('standard');
  const scannedQrRef = useRef<string | null>(null);
  const thumbContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (batchIndex >= 0 && thumbContainerRef.current) {
      const activeEl = thumbContainerRef.current.children[batchIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [batchIndex]);

  const showAlert = (msg: string, type: 'success' | 'warning' | 'error' = 'warning') => {
    setToastAlert({ message: msg, type });
    setTimeout(() => {
      setToastAlert(null);
    }, 3500);
  };

  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {}
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([70, 40, 70]);
      }
    } catch (e) {}
  };

  const ensurePdfJsLoaded = async (): Promise<any> => {
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      if (!window.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      }
      return window.pdfjsLib;
    }
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (typeof window !== 'undefined' && window.pdfjsLib) {
        if (!window.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        }
        return window.pdfjsLib;
      }
    }
    throw new Error("PDF.js kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol edip sayfayı yenileyin.");
  };

  const processPdfToFiles = async (
    pdfFile: File,
    onProgress?: (pageNum: number, totalPages: number) => void
  ): Promise<File[]> => {
    const pdfjs = await ensurePdfJsLoaded();
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const extractedFiles: File[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      if (onProgress) onProgress(i, pdf.numPages);
      const page = await pdf.getPage(i);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      // Scale to optimal ~1600px width for fast and crisp optical mark detection
      const scale = Math.max(1.5, Math.min(3.0, 1600 / (unscaledViewport.width || 595)));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.90));
      canvas.width = 0;
      canvas.height = 0;
      if (typeof (page as any).cleanup === 'function') {
        (page as any).cleanup();
      }
      if (blob) {
        const newFile = new File([blob], `${pdfFile.name.replace(/\.pdf$/i, '')}_Sayfa_${i}.jpg`, { type: 'image/jpeg' });
        extractedFiles.push(newFile);
      }
    }
    return extractedFiles;
  };

  const getActiveOMR = () => OMR_SPECS;

  const decodeQR = (data: Uint8ClampedArray, width: number, height: number, options?: any) => {
    try {
      if (typeof jsQR === 'function') {
        const res = jsQR(data, width, height, options);
        if (res && res.data) return res;
      }
    } catch (e) {}
    return null;
  };

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const cvs = overlayCanvasRef.current;
    if (!cvs) return null;
    const rect = cvs.getBoundingClientRect();

    let clientX: number, clientY: number;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    } else {
      return null;
    }

    const canvasRatio = cvs.width / cvs.height;
    const elementRatio = rect.width / rect.height;
    let renderedW: number, renderedH: number, offsetX = 0, offsetY = 0;

    if (canvasRatio > elementRatio) {
      renderedW = rect.width;
      renderedH = rect.width / canvasRatio;
      offsetY = (rect.height - renderedH) / 2;
    } else {
      renderedH = rect.height;
      renderedW = rect.height * canvasRatio;
      offsetX = (rect.width - renderedW) / 2;
    }

    const x = ((clientX - rect.left - offsetX) / renderedW) * cvs.width;
    const y = ((clientY - rect.top - offsetY) / renderedH) * cvs.height;

    return { x, y };
  };

  const handlePtrDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!anchors || isProcessing || isCameraActive) return;
    const pos = getCanvasCoords(e);
    if (!pos) return;

    let closest: 'tl' | 'tr' | 'bl' | 'br' | null = null;
    let minDist = 250;
    const keys: ('tl' | 'tr' | 'bl' | 'br')[] = ['tl', 'tr', 'bl', 'br'];
    keys.forEach(key => {
      const p = anchors[key];
      const dist = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (dist < minDist) {
        minDist = dist;
        closest = key;
      }
    });

    if (closest) {
      setDraggingNode(closest);
      if (e.cancelable) e.preventDefault();
    }
  };

  const handlePtrMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!draggingNode || !anchors || isCameraActive) return;
    const pos = getCanvasCoords(e);
    if (!pos) return;

    const newAnchors = { ...anchors, [draggingNode]: pos };
    setAnchors(newAnchors);

    const srcPts = [
      { x: DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.anchorMargin },
      { x: DEFAULT_OMR.paperW - DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.anchorMargin },
      { x: DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.paperH - DEFAULT_OMR.anchorMargin },
      { x: DEFAULT_OMR.paperW - DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.paperH - DEFAULT_OMR.anchorMargin }
    ];
    const dstPts = [newAnchors.tl, newAnchors.tr, newAnchors.bl, newAnchors.br];
    const H = getHomography(srcPts, dstPts);
    setHomographyMat(H);

    drawOverlay(newAnchors, H, laserMarks, getActiveOMR());
  };

  const handlePtrUp = () => {
    setDraggingNode(null);
  };

  // Homografi Düzeltmeli Milimetrik QR Tarayıcı
  const scanQRWithHomography = (ctx: CanvasRenderingContext2D, H: number[], omrToUse = OMR_SPECS): string | null => {
    try {
      const qrCanvas = document.createElement('canvas');
      qrCanvas.width = 240;
      qrCanvas.height = 240;
      const qctx = qrCanvas.getContext('2d');
      if (!qctx) return null;

      // QR kutusu A4 milimetrik koordinatları (getQrCodeBox ile merkezi motor)
      const qrBox = getQrCodeBox(omrToUse);
      const qrMargin = 1.5; // Perspektif toleransı için 1.5mm marj
      const qrW_mm = qrBox.w + (qrMargin * 2);
      const qrH_mm = qrBox.h + (qrMargin * 2);
      const qrX_mm = qrBox.x - qrMargin;
      const qrY_mm = qrBox.y - qrMargin;

      const qImgData = qctx.createImageData(240, 240);
      const qBytes = qImgData.data;
      const srcW = ctx.canvas.width;
      const srcH = ctx.canvas.height;
      const srcData = ctx.getImageData(0, 0, srcW, srcH).data;

      for (let y = 0; y < 240; y++) {
        const y_mm = qrY_mm + (y / 240) * qrH_mm;
        const rowOffset = y * 240 * 4;
        for (let x = 0; x < 240; x++) {
          const x_mm = qrX_mm + (x / 240) * qrW_mm;
          const pt = applyHomography(x_mm, y_mm, H);
          const px = Math.round(pt.x);
          const py = Math.round(pt.y);
          const dIdx = rowOffset + (x * 4);
          if (px >= 0 && px < srcW && py >= 0 && py < srcH) {
            const sIdx = (py * srcW + px) * 4;
            qBytes[dIdx] = srcData[sIdx];
            qBytes[dIdx + 1] = srcData[sIdx + 1];
            qBytes[dIdx + 2] = srcData[sIdx + 2];
            qBytes[dIdx + 3] = 255;
          } else {
            qBytes[dIdx] = 255;
            qBytes[dIdx + 1] = 255;
            qBytes[dIdx + 2] = 255;
            qBytes[dIdx + 3] = 255;
          }
        }
      }

      let code = decodeQR(qBytes, 240, 240, { inversionAttempts: "dontInvert" });
      if (code && code.data) return code.data;

      code = decodeQR(qBytes, 240, 240, { inversionAttempts: "invertFirst" });
      if (code && code.data) return code.data;

      for (const t of [128, 160, 95, 185]) {
        const binarized = new Uint8ClampedArray(qBytes);
        for (let i = 0; i < binarized.length; i += 4) {
          const luma = 0.299 * binarized[i] + 0.587 * binarized[i + 1] + 0.114 * binarized[i + 2];
          const v = luma > t ? 255 : 0;
          binarized[i] = binarized[i + 1] = binarized[i + 2] = v;
        }
        code = decodeQR(binarized, 240, 240, { inversionAttempts: "dontInvert" });
        if (code && code.data) return code.data;
      }
    } catch (e) {
      console.warn("Homografi QR tarama hatası:", e);
    }
    return null;
  };

  // Optik Formdaki Kodlanmış Öğrenci No, Adı Soyadı ve Kitapçık Baloncuklarını Okuma
  const scanInfoFields = (ctx: CanvasRenderingContext2D, H: number[], omrToUse = OMR_SPECS) => {
    try {
      const imgBytes = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const scalePxPerMm = w / (omrToUse.paperW || 210);
      const infoRadiusPx = (omrToUse.info.colW * 0.35) * scalePxPerMm;

      let bubbledNo = '';
      let bubbledName = '';
      let bubbledBk = '';

      // Öğrenci Numarası sütunları (5 hane, 0-9 rakamları)
      const noField = omrToUse.info.fields.find(f => f.id === 'no');
      if (noField) {
        for (let c = 0; c < noField.cols; c++) {
          const colCenterX_mm = noField.startX + (c * omrToUse.info.colW) + (omrToUse.info.colW / 2);
          const topMapped = applyHomography(colCenterX_mm, omrToUse.info.startY - 3, H);
          const colBgDarkness = sampleLocalBackground(imgBytes, w, h, topMapped.x, topMapped.y, 6);

          let bestScore = -1;
          let bestItem = '';
          let bestRatio = 0;

          for (let r = 0; r < noField.items.length; r++) {
            const y_mm = omrToUse.info.startY + (r * omrToUse.info.rowH);
            const mapped = applyHomography(colCenterX_mm, y_mm, H);
            const metric = evaluateBubbleFill(imgBytes, w, h, mapped.x, mapped.y, infoRadiusPx, colBgDarkness);
            if (metric.score > bestScore) {
              bestScore = metric.score;
              bestRatio = metric.fillRatio;
              bestItem = noField.items[r];
            }
          }
          if (bestScore >= 35 && bestRatio >= 0.28) {
            bubbledNo += bestItem;
          }
        }
      }

      // Öğrenci Adı Soyadı baloncukları (20 sütun alfabe)
      const nameField = omrToUse.info.fields.find(f => f.id === 'name');
      if (nameField) {
        for (let c = 0; c < nameField.cols; c++) {
          const colCenterX_mm = nameField.startX + (c * omrToUse.info.colW) + (omrToUse.info.colW / 2);
          const topMapped = applyHomography(colCenterX_mm, omrToUse.info.startY - 3, H);
          const colBgDarkness = sampleLocalBackground(imgBytes, w, h, topMapped.x, topMapped.y, 6);

          let bestScore = -1;
          let bestItem = '';
          let bestRatio = 0;

          for (let r = 0; r < nameField.items.length; r++) {
            const y_mm = omrToUse.info.startY + (r * omrToUse.info.rowH);
            const mapped = applyHomography(colCenterX_mm, y_mm, H);
            const metric = evaluateBubbleFill(imgBytes, w, h, mapped.x, mapped.y, infoRadiusPx, colBgDarkness);
            if (metric.score > bestScore) {
              bestScore = metric.score;
              bestRatio = metric.fillRatio;
              bestItem = nameField.items[r];
            }
          }
          if (bestScore >= 35 && bestRatio >= 0.28) {
            bubbledName += bestItem;
          } else {
            bubbledName += ' ';
          }
        }
      }

      // Kitapçık Türü alanı
      const bkField = omrToUse.info.fields.find(f => f.id === 'bk');
      if (bkField) {
        const colCenterX_mm = bkField.startX + (omrToUse.info.colW / 2);
        const topMapped = applyHomography(colCenterX_mm, omrToUse.info.startY - 3, H);
        const colBgDarkness = sampleLocalBackground(imgBytes, w, h, topMapped.x, topMapped.y, 6);

        let bestScore = -1;
        let bestItem = '';
        let bestRatio = 0;

        for (let r = 0; r < bkField.items.length; r++) {
          const y_mm = omrToUse.info.startY + (r * omrToUse.info.rowH);
          const mapped = applyHomography(colCenterX_mm, y_mm, H);
          const metric = evaluateBubbleFill(imgBytes, w, h, mapped.x, mapped.y, infoRadiusPx, colBgDarkness);
          if (metric.score > bestScore) {
            bestScore = metric.score;
            bestRatio = metric.fillRatio;
            bestItem = bkField.items[r];
          }
        }
        if (bestScore >= 35 && bestRatio >= 0.28) {
          bubbledBk = bestItem;
        }
      }

      return {
        bubbledNo: bubbledNo.trim(),
        bubbledName: bubbledName.trim(),
        bubbledBk: bubbledBk.trim()
      };
    } catch (e) {
      return { bubbledNo: '', bubbledName: '', bubbledBk: '' };
    }
  };

  const scanQRRobustly = (ctx: CanvasRenderingContext2D, w: number, h: number): string | null => {
    let code = decodeQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
    if (code && code.data) return code.data;

    // Sağ üst köşe QR alanı (w: %45, h: %35)
    const qrW = Math.floor(w * 0.45);
    const qrH = Math.floor(h * 0.35);
    const qrX = w - qrW;
    const qrY = 0;
    const qrImgData = ctx.getImageData(qrX, qrY, qrW, qrH);

    code = decodeQR(qrImgData.data, qrW, qrH, { inversionAttempts: "dontInvert" });
    if (code && code.data) return code.data;

    code = decodeQR(qrImgData.data, qrW, qrH, { inversionAttempts: "invertFirst" });
    if (code && code.data) return code.data;

    const thresholds = [128, 160, 95, 185];
    for (const t of thresholds) {
      const binarized = new Uint8ClampedArray(qrImgData.data);
      for (let i = 0; i < binarized.length; i += 4) {
        const luma = 0.299 * binarized[i] + 0.587 * binarized[i + 1] + 0.114 * binarized[i + 2];
        const v = luma > t ? 255 : 0;
        binarized[i] = binarized[i + 1] = binarized[i + 2] = v;
      }
      code = decodeQR(binarized, qrW, qrH, { inversionAttempts: "dontInvert" });
      if (code && code.data) return code.data;
    }
    return null;
  };

  useEffect(() => {
    let captureInterval: any;
    if (activeTab !== 'scan') {
      stopCamera();
    } else if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.warn("Video oynatma hatası:", e));

      captureInterval = setInterval(() => {
        if (isProcessing) return;
        const video = videoRef.current;
        const guide = arGuideRef.current;
        if (!video || !guide || video.videoWidth === 0) return;

        try {
          const canvas = document.createElement('canvas');
          canvas.width = 420; canvas.height = 594;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;

          const videoRect = video.getBoundingClientRect();
          const guideRect = guide.getBoundingClientRect();
          const videoRatio = video.videoWidth / video.videoHeight;
          const containerRatio = videoRect.width / videoRect.height;
          let drawWidth: number, drawHeight: number, offsetX = 0, offsetY = 0;

          if (videoRatio > containerRatio) {
            drawHeight = video.videoHeight; drawWidth = video.videoHeight * containerRatio;
            offsetX = (video.videoWidth - drawWidth) / 2;
          } else {
            drawWidth = video.videoWidth; drawHeight = video.videoWidth / containerRatio;
            offsetY = (video.videoHeight - drawHeight) / 2;
          }
          const scale = drawWidth / videoRect.width;
          const cropX = offsetX + (guideRect.left - videoRect.left) * scale;
          const cropY = offsetY + (guideRect.top - videoRect.top) * scale;
          const cropW = guideRect.width * scale;
          const cropH = guideRect.height * scale;

          ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          if (!scannedQrRef.current) {
            const qrRes = scanQRRobustly(ctx, canvas.width, canvas.height);
            if (qrRes) {
              scannedQrRef.current = qrRes;
              setDetectedQrCode(qrRes);
              scannedFormatRef.current = 'mebi';

              // QR'dan Sınav ve Öğrenciyi Çözme (Öncelikli Adım)
              const parts = qrRes.split('|');
              const qrObj: any = {};
              parts.forEach(p => { 
                const [k, v] = p.split(':'); 
                if (k && v) qrObj[k.trim()] = v.trim(); 
              });
              const qrExamId = qrObj.E;
              const qrStudentNo = qrObj.N;

              if (qrExamId) {
                const foundExam = state.exams.find(e => String(e.id) === String(qrExamId) || String(e.no) === String(qrExamId));
                if (foundExam) {
                  detectedExamRef.current = foundExam;
                  setSelectedExamId(String(foundExam.id));
                }
              }
              const targetExam = detectedExamRef.current || exam;
              const matchedStudent = qrStudentNo 
                ? (state.students.find(s => String(s.no) === String(qrStudentNo)) || targetExam.studentList?.find(s => String(s.no) === String(qrStudentNo))) 
                : null;
              setStatus(`🎯 ${matchedStudent ? matchedStudent.name : 'Öğrenci No: ' + (qrStudentNo || '')} (${targetExam.name})`);
            }
          }

          const getMinLumaInRegion = (cx: number, cy: number, radius: number) => {
            let minLuma = 255;
            for (let y = -radius; y <= radius; y++) {
              for (let x = -radius; x <= radius; x++) {
                const px = Math.floor(cx + x);
                const py = Math.floor(cy + y);
                if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) {
                  const i = (py * canvas.width + px) * 4;
                  const luma = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2];
                  if (luma < minLuma) minLuma = luma;
                }
              }
            }
            return minLuma;
          };

          const getAvgLumaInRegion = (cx: number, cy: number, radius: number) => {
            let sum = 0, count = 0;
            for (let y = -radius; y <= radius; y++) {
              for (let x = -radius; x <= radius; x++) {
                const px = Math.floor(cx + x);
                const py = Math.floor(cy + y);
                if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) {
                  sum += 0.299 * imgData.data[(py * canvas.width + px) * 4] + 0.587 * imgData.data[(py * canvas.width + px) * 4 + 1] + 0.114 * imgData.data[(py * canvas.width + px) * 4 + 2];
                  count++;
                }
              }
            }
            return sum / count;
          };

          const mX = DEFAULT_OMR.anchorMargin / DEFAULT_OMR.paperW;
          const mY = DEFAULT_OMR.anchorMargin / DEFAULT_OMR.paperH;
          const tl = getMinLumaInRegion(420 * mX, 594 * mY, 25);
          const tr = getMinLumaInRegion(420 * (1 - mX), 594 * mY, 25);
          const bl = getMinLumaInRegion(420 * mX, 594 * (1 - mY), 25);
          const br = getMinLumaInRegion(420 * (1 - mX), 594 * (1 - mY), 25);
          const center = getAvgLumaInRegion(210, 297, 10);

          const isStableAnchor = (val: number) => val < 130 && (center - val) > 45;

          if (center > 120 && isStableAnchor(tl) && isStableAnchor(tr) && isStableAnchor(bl) && isStableAnchor(br)) {
            lockCounter.current += 1;
            setLockLevel(lockCounter.current);

            if (lockCounter.current === 3) {
              setStatus("Hedef algılandı, mercek odaklanıyor... ⏳");
            } else if (lockCounter.current === 8) {
              setStatus("Geometrik analiz yapılıyor, sabit tutun... 🔒");
            } else if (lockCounter.current >= 15) {
              clearInterval(captureInterval);
              performCapture(video, guide);
            }
          } else {
            if (lockCounter.current > 0) {
              lockCounter.current = 0;
              setLockLevel(0);
              if (!scannedQrRef.current) setStatus("Siyah kareleri pencerelere yerleştirin.");
            }
          }
        } catch (e) {}
      }, 250);
    }

    return () => {
      if (captureInterval) clearInterval(captureInterval);
    };
  }, [isCameraActive, activeTab, isProcessing, expectedFormat]);

  const startCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    setIsProcessing(true);
    setRotation90(0); setFineAngle(0);
    setStatus("Kamera hazırlanıyor...");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsProcessing(false);
        setStatus("Sistem kamerası açılıyor...");
        if (nativeCameraRef.current) nativeCameraRef.current.click();
        return;
      }

      const streamPromise = navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 3000)
      );

      const stream = await Promise.race([streamPromise, timeoutPromise]);

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        setTorchAvailable(!!capabilities.torch);
        setIsTorchOn(false);
      }
      setCameraFacing(facing);
      setIsCameraActive(true);
      setImageLoaded(false);
      setOmrImg(null);
      setAnchors(null);
      setLaserMarks([]);
      setIsProcessing(false);
      scannedQrRef.current = null;
      setDetectedQrCode(null);
      lockCounter.current = 0;
      setLockLevel(0);
      setStatus("Kamera hazır. Optik formu vizöre hizalayın...");
    } catch (err) {
      setIsProcessing(false);
      setStatus("Kamera başlatılamadı. Sistem kamerası açılıyor...");
      if (nativeCameraRef.current) nativeCameraRef.current.click();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
    setLockLevel(0);
    setIsProcessing(false);
    setStatus("");
    setDetectedQrCode(null);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setIsTorchOn(nextTorch);
    } catch (e) {
      console.warn("Flaş kontrolü desteklenmiyor:", e);
    }
  };

  const switchCamera = async () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    stopCamera();
    setTimeout(() => {
      startCamera(nextFacing);
    }, 250);
  };

  const performCapture = (videoNode: HTMLVideoElement, guideNode: HTMLDivElement) => {
    setIsProcessing(true);
    setStatus("Fotoğraf analiz ediliyor...");

    const videoRect = videoNode.getBoundingClientRect();
    const guideRect = guideNode.getBoundingClientRect();
    const videoRatio = videoNode.videoWidth / videoNode.videoHeight;
    const containerRatio = videoRect.width / videoRect.height;

    let drawWidth: number, drawHeight: number, offsetX = 0, offsetY = 0;
    if (videoRatio > containerRatio) {
      drawHeight = videoNode.videoHeight; drawWidth = videoNode.videoHeight * containerRatio;
      offsetX = (videoNode.videoWidth - drawWidth) / 2;
    } else {
      drawWidth = videoNode.videoWidth; drawHeight = videoNode.videoWidth / containerRatio;
      offsetY = (videoNode.videoHeight - drawHeight) / 2;
    }

    const scale = drawWidth / videoRect.width;
    const cropX = offsetX + (guideRect.left - videoRect.left) * scale;
    const cropY = offsetY + (guideRect.top - videoRect.top) * scale;
    const cropW = guideRect.width * scale;
    const cropH = guideRect.height * scale;

    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoNode, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      setOmrImg(img);
      setImageLoaded(true);
      setAutoMode(true);
    };
    img.onerror = () => {
      setIsProcessing(false);
      setStatus("Görüntü alınamadı. Lütfen tekrar deneyin.");
    };
    img.src = canvas.toDataURL('image/jpeg', 0.95);
  };

  const captureImage = () => {
    if (!videoRef.current || !arGuideRef.current) return;
    performCapture(videoRef.current, arGuideRef.current);
  };

  const processSinglePageDirect = async (file: File): Promise<{
    success: boolean;
    result?: ExamResult;
    studentName?: string;
    studentNo?: string;
    booklet?: string;
    net?: number;
    error?: string;
    examId?: string;
    examName?: string;
  }> => {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Görsel yüklenemedi"));
      };
      image.src = url;
    });

    const baseW = 1600;
    const baseH = Math.round(img.height * (baseW / img.width));

    const rotations = [0, 90, 180, 270];
    let bestRot = 0;
    let bestAnchorData: { pts: Anchors; lockFailed: boolean } | null = null;
    let bestQrRes: string | null = null;
    let bestFineAngle = 0;

    for (const rot of rotations) {
      const rotW = Math.abs(rot) % 180 !== 0 ? baseH : baseW;
      const rotH = Math.abs(rot) % 180 !== 0 ? baseW : baseH;

      const tCvs = document.createElement('canvas');
      tCvs.width = rotW;
      tCvs.height = rotH;
      const tCtx = tCvs.getContext('2d', { willReadFrequently: true });
      if (!tCtx) continue;

      tCtx.save();
      tCtx.translate(rotW / 2, rotH / 2);
      tCtx.rotate(rot * Math.PI / 180);
      if (Math.abs(rot) % 180 !== 0) {
        tCtx.drawImage(img, -rotH / 2, -rotW / 2, rotH, rotW);
      } else {
        tCtx.drawImage(img, -rotW / 2, -rotH / 2, rotW, rotH);
      }
      tCtx.restore();

      const qr = scanQRRobustly(tCtx, rotW, rotH);
      const aData = findAnchorsCore(tCtx, rotW, rotH);

      if (!aData.lockFailed) {
        bestRot = rot;
        bestAnchorData = aData;
        bestQrRes = qr;

        const dy = aData.pts.tr.y - aData.pts.tl.y;
        const dx = aData.pts.tr.x - aData.pts.tl.x;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (Math.abs(angle) > 0.35 && Math.abs(angle) < 15) {
          bestFineAngle = -angle;
        }
        break;
      } else if (!bestAnchorData) {
        bestAnchorData = aData;
        bestQrRes = qr;
      }
    }

    if (!bestAnchorData || bestAnchorData.lockFailed) {
      return { success: false, error: 'Köşe referans kareleri kilitlenemedi (ışık veya açı yetersiz)' };
    }

    const finalRotW = Math.abs(bestRot) % 180 !== 0 ? baseH : baseW;
    const finalRotH = Math.abs(bestRot) % 180 !== 0 ? baseW : baseH;
    const finalCvs = document.createElement('canvas');
    finalCvs.width = finalRotW;
    finalCvs.height = finalRotH;
    const finalCtx = finalCvs.getContext('2d', { willReadFrequently: true });
    if (!finalCtx) return { success: false, error: 'Canvas oluşturulamadı' };

    finalCtx.save();
    finalCtx.translate(finalRotW / 2, finalRotH / 2);
    finalCtx.rotate((bestRot + bestFineAngle) * Math.PI / 180);
    if (Math.abs(bestRot) % 180 !== 0) {
      finalCtx.drawImage(img, -finalRotH / 2, -finalRotW / 2, finalRotH, finalRotW);
    } else {
      finalCtx.drawImage(img, -finalRotW / 2, -finalRotH / 2, finalRotW, finalRotH);
    }
    finalCtx.restore();

    const finalAnchors = findAnchorsCore(finalCtx, finalRotW, finalRotH);
    const pts = finalAnchors.lockFailed ? bestAnchorData.pts : finalAnchors.pts;

    const srcPts = [
      { x: DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.anchorMargin },
      { x: DEFAULT_OMR.paperW - DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.anchorMargin },
      { x: DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.paperH - DEFAULT_OMR.anchorMargin },
      { x: DEFAULT_OMR.paperW - DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.paperH - DEFAULT_OMR.anchorMargin }
    ];
    const dstPts = [pts.tl, pts.tr, pts.bl, pts.br];
    const H = getHomography(srcPts, dstPts);

    const imgBytes = finalCtx.getImageData(0, 0, finalRotW, finalRotH).data;

    const getFastAvg = (cx: number, cy: number, radius: number) => {
      let dSum = 0, dCnt = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = Math.floor(cx + dx);
          const py = Math.floor(cy + dy);
          if (px >= 0 && px < finalRotW && py >= 0 && py < finalRotH) {
            const i = (py * finalRotW + px) * 4;
            const whiteness = Math.max(imgBytes[i], imgBytes[i + 1], imgBytes[i + 2]);
            dSum += (255 - whiteness);
            dCnt++;
          }
        }
      }
      return dSum / (dCnt || 1);
    };

    const getDeepestDarkness = (cx: number, cy: number, searchRadiusX: number, searchRadiusY: number, coreRadius: number) => {
      let maxScore = -Infinity;
      let bestX = cx, bestY = cy;
      let actualVal = 0;

      for (let sy = -searchRadiusY; sy <= searchRadiusY; sy += 1) {
        for (let sx = -searchRadiusX; sx <= searchRadiusX; sx += 1) {
          const avgDark = getFastAvg(cx + sx, cy + sy, coreRadius);
          const dist = Math.hypot(sx, sy);
          const penalty = (dist * dist) * 0.35;
          const score = avgDark - penalty;

          if (score > maxScore) {
            maxScore = score;
            bestX = cx + sx;
            bestY = cy + sy;
            actualVal = avgDark;
          }
        }
      }
      return { val: actualVal, x: bestX, y: bestY };
    };

    const getTrueRowY = (expectedY_mm: number) => {
      const mappedLeft = applyHomography(5.5, expectedY_mm, H);
      let bestY = mappedLeft.y;
      let maxDarkness = -1;
      for (let dy = -15; dy <= 15; dy++) {
        const dark = getFastAvg(mappedLeft.x, mappedLeft.y + dy, 2);
        if (dark > maxDarkness) {
          maxDarkness = dark;
          bestY = mappedLeft.y + dy;
        }
      }
      return maxDarkness > 80 ? bestY : mappedLeft.y;
    };

    let qrDataObj: any = null;
    let qrRes = bestQrRes;
    if (!qrRes) {
      qrRes = scanQRWithHomography(finalCtx, H);
    }
    if (!qrRes) {
      qrRes = scanQRRobustly(finalCtx, finalRotW, finalRotH);
    }
    if (qrRes) {
      const parts = qrRes.split('|');
      qrDataObj = {};
      parts.forEach(p => { 
        const [k, v] = p.split(':'); 
        if (k && v) qrDataObj[k.trim()] = v.trim(); 
      });
    }

    // Hedef Sınav Şablonu: Kağıttaki karekod hangi sınava aitse, anında o sınavın şablonunu dinamik olarak belleğe yükle
    let targetExam = exam;
    const qrExamId = qrDataObj?.E;
    const qrStudentNo = qrDataObj?.N;

    if (qrExamId) {
      const foundExam = state.exams.find(e => String(e.id) === String(qrExamId) || String(e.no) === String(qrExamId));
      if (foundExam) {
        targetExam = foundExam;
        detectedExamRef.current = foundExam;
        setSelectedExamId(String(foundExam.id));
      }
    }

    // Milimetrik ve Hafızadaki OMR_MAP kullanımı
    const omrToUse = (targetExam?.omrMap?.specs) ? { ...OMR_SPECS, ...targetExam.omrMap.specs } : OMR_SPECS;
    let mebiCodedBk: string | null = null;
    const scalePxPerMm = finalRotW / (omrToUse.paperW || 210);
    const bubbleRadiusPx = (omrToUse.questions?.bubbleRadius || 1.75) * scalePxPerMm;
    const bookletRadiusPx = 2.4 * scalePxPerMm;

    // 1. Kitapçık Türü Tespiti (A - B - C - D) - Sınavın omr_map haritasından veya standart şablondan
    const bookletPositions = targetExam?.omrMap?.bookletPositions || getBookletBubblePositions(omrToUse);
    const bkEval = evaluateQuestionAnswer(
      bookletPositions.map((bp: any) => ({ option: bp.booklet || bp.option, x: bp.x, y: bp.y })),
      H,
      imgBytes,
      finalRotW,
      finalRotH,
      bookletRadiusPx
    );
    if (bkEval.answer) {
      mebiCodedBk = bkEval.answer;
    }

    // 2. Dinamik Sınav Şablonu ve Soru Baloncuklarını Okuma (omr_map öncelikli)
    const { items: layoutItems } = getQuestionsLayout(targetExam, omrToUse);
    const questionsCount = layoutItems.filter(i => i.type === 'question').length;
    const readAns = Array(questionsCount).fill("");

    layoutItems.forEach((item) => {
      if (item.type === 'question' && item.qIdx !== undefined) {
        const bubbles = (item.bubbleCenters || []).map(bc => ({
          option: bc.option,
          x: bc.x,
          y: bc.y
        }));

        const evalRes = evaluateQuestionAnswer(
          bubbles,
          H,
          imgBytes,
          finalRotW,
          finalRotH,
          bubbleRadiusPx
        );

        if (evalRes.answer) {
          readAns[item.qIdx] = evalRes.answer;
        }
      }
    });

    // 3. Öğrenci Kimliği ve Bilgilerini Çözme
    let finalNo = qrDataObj?.N ? String(qrDataObj.N) : "";
    let finalName = "İSİMSİZ";
    let cleanCls = "-";
    let cleanSec = "-";
    let matchedStudent: (Student | OmrStudent) | undefined = undefined;

    // QR'dan numara geldiyse hem sınavın öğrenci listesinde hem merkezi kütükte ara
    if (finalNo) {
      matchedStudent = targetExam.studentList?.find(s => 
        String(s.no) === String(finalNo) || 
        Number(s.no) === Number(finalNo) ||
        (('id' in s && s.id) ? String(s.id) === String(finalNo) : false)
      );
      if (!matchedStudent) {
        matchedStudent = state.students.find(s => 
          String(s.no) === String(finalNo) || 
          Number(s.no) === Number(finalNo) ||
          (s.id && String(s.id) === String(finalNo))
        );
      }
    }

    // QR okunamadıysa veya öğrenci bulunamadıysa kodlanmış baloncukları tara
    if (!matchedStudent || !finalNo) {
      const bubbled = scanInfoFields(finalCtx, H, omrToUse);
      if (bubbled.bubbledNo && !finalNo) {
        finalNo = bubbled.bubbledNo;
        matchedStudent = targetExam.studentList?.find(s => String(s.no) === String(finalNo) || Number(s.no) === Number(finalNo))
          || state.students.find(s => String(s.no) === String(finalNo) || Number(s.no) === Number(finalNo));
      }
      if (bubbled.bubbledName && finalName === "İSİMSİZ") {
        finalName = bubbled.bubbledName;
      }
      if (bubbled.bubbledBk && !mebiCodedBk) {
        mebiCodedBk = bubbled.bubbledBk;
      }
    }

    if (matchedStudent) {
      finalName = matchedStudent.name || finalName;
      finalNo = String(matchedStudent.no || finalNo);
      const studentCls = ('className' in matchedStudent ? matchedStudent.className : '') || matchedStudent.classStr || '';
      const { cls, sec } = formatClassSec(studentCls, matchedStudent.sectionStr);
      cleanCls = cls || cleanCls;
      cleanSec = sec || cleanSec;
    }

    const finalBk = mebiCodedBk || "A";

    const studentResultPayload = createUnifiedExamResult(
      {
        studentId: matchedStudent && 'id' in matchedStudent ? matchedStudent.id : undefined,
        studentNo: Number(finalNo) || undefined,
        studentName: finalName,
        name: finalName,
        no: finalNo || undefined,
        classStr: cleanCls,
        sectionStr: cleanSec,
        booklet: finalBk,
        answers: readAns
      },
      targetExam,
      matchedStudent
    );

    (studentResultPayload as any).__examId = String(targetExam.id);

    return {
      success: true,
      result: studentResultPayload,
      studentName: finalName,
      studentNo: finalNo || 'BOŞ',
      booklet: finalBk,
      net: studentResultPayload.evaluatedScore.total.net,
      examId: String(targetExam.id),
      examName: targetExam.name
    };
  };

  const selectThumbnailPage = (idx: number) => {
    if (idx < 0 || idx >= pageThumbnails.length) return;
    setBatchIndex(idx);
    batchIndexRef.current = idx;
    loadImage(pageThumbnails[idx].file, false, idx);
  };

  const moveThumbnailPage = (idx: number, direction: 'left' | 'right', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= pageThumbnails.length) return;

    const copyThumbs = [...pageThumbnails];
    const tempT = copyThumbs[idx];
    copyThumbs[idx] = copyThumbs[targetIdx];
    copyThumbs[targetIdx] = tempT;
    const reindexedThumbs = copyThumbs.map((t, i) => ({ ...t, index: i }));
    setPageThumbnails(reindexedThumbs);

    const copyFiles = [...batchFiles];
    const tempF = copyFiles[idx];
    copyFiles[idx] = copyFiles[targetIdx];
    copyFiles[targetIdx] = tempF;
    setBatchFiles(copyFiles);
    batchFilesRef.current = copyFiles;

    if (batchIndex === idx) {
      setBatchIndex(targetIdx);
      batchIndexRef.current = targetIdx;
      loadImage(reindexedThumbs[targetIdx].file, false, targetIdx);
    } else if (batchIndex === targetIdx) {
      setBatchIndex(idx);
      batchIndexRef.current = idx;
      loadImage(reindexedThumbs[idx].file, false, idx);
    }
  };

  const removeThumbnailPage = (idx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (pageThumbnails.length <= 1) {
      clearAllPages();
      return;
    }
    try { URL.revokeObjectURL(pageThumbnails[idx].thumbUrl); } catch (err) {}
    const updatedThumbs = pageThumbnails.filter((_, i) => i !== idx).map((t, i) => ({ ...t, index: i }));
    const updatedFiles = batchFiles.filter((_, i) => i !== idx);

    setPageThumbnails(updatedThumbs);
    setBatchFiles(updatedFiles);
    batchFilesRef.current = updatedFiles;

    const nextIdx = Math.min(batchIndex, updatedThumbs.length - 1);
    setBatchIndex(nextIdx);
    batchIndexRef.current = nextIdx;
    loadImage(updatedThumbs[nextIdx].file, false, nextIdx);
  };

  const clearAllPages = () => {
    pageThumbnails.forEach(t => {
      try { URL.revokeObjectURL(t.thumbUrl); } catch (e) {}
    });
    setPageThumbnails([]);
    setBatchFiles([]);
    batchFilesRef.current = [];
    setBatchIndex(-1);
    batchIndexRef.current = -1;
    setImageLoaded(false);
    setOmrImg(null);
    setAnchors(null);
    setStatus("");
  };

  const runBatchEngine = async (pagesToRun?: { file: File; originalName: string; pageNum: number }[]) => {
    const pages = pagesToRun || (pageThumbnails.length > 0
      ? pageThumbnails.map(t => ({
          file: t.file,
          originalName: t.fileName,
          pageNum: t.pageNum
        }))
      : (batchFilesRef.current || []).map((f, idx) => ({
          file: f,
          originalName: f.name || `Sayfa_${idx + 1}`,
          pageNum: idx + 1
        })));

    if (pages.length === 0) {
      showAlert("Taranacak sayfa bulunamadı. Lütfen önce bir PDF veya optik görsel yükleyin.", 'warning');
      return;
    }

    setIsBatchRunning(true);
    setBatchModalOpen(true);
    batchAbortRef.current = false;
    setBatchProgress({
      current: 0,
      total: pages.length,
      stage: 'processing',
      statusText: `Optik işaret ve QR kod algılama başlatılıyor (Toplam ${pages.length} Sayfa)...`
    });

    const initialItems: BatchProcessItem[] = pages.map((p, idx) => ({
      pageIndex: idx + 1,
      fileName: `${p.originalName} (Sayfa ${p.pageNum})`,
      status: 'pending',
      message: 'Sırada bekliyor...'
    }));
    setBatchItems(initialItems);

    const collectedResults: ExamResult[] = [];
    let successCount = 0;
    let warnCount = 0;

    for (let i = 0; i < pages.length; i++) {
      if (batchAbortRef.current) {
        showAlert("Toplu işlem kullanıcı tarafından durduruldu.", 'warning');
        break;
      }

      const currentPage = pages[i];
      const curMsg = `Sayfa ${i + 1} / ${pages.length}: QR ve optik işaretler algılanıyor...`;
      setStatus(curMsg);
      setBatchProgress({
        current: i + 1,
        total: pages.length,
        stage: 'processing',
        statusText: curMsg
      });

      setBatchItems(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'processing', message: 'Hizalanıyor, QR ve optik kabarcıklar okunuyor...' } : item
      ));

      setPageThumbnails(prev => prev.map((t, idx) =>
        idx === i ? { ...t, status: 'processing' } : t
      ));

      // Asenkron nefes aldır: UI render engellenmesin
      await new Promise(resolve => setTimeout(resolve, 30));

      try {
        const scanRes = await processSinglePageDirect(currentPage.file);

        if (scanRes.success && scanRes.result) {
          collectedResults.push(scanRes.result);
          successCount++;
          setBatchItems(prev => prev.map((item, idx) =>
            idx === i ? {
              ...item,
              status: 'success',
              studentName: scanRes.studentName,
              studentNo: scanRes.studentNo,
              booklet: scanRes.booklet,
              net: scanRes.net,
              message: `${scanRes.studentName} (${scanRes.booklet} Kit.) - ${scanRes.net?.toFixed(2)} Net`
            } : item
          ));
          setPageThumbnails(prev => prev.map((t, idx) =>
            idx === i ? {
              ...t,
              status: 'success',
              studentName: scanRes.studentName,
              studentNo: scanRes.studentNo,
              booklet: scanRes.booklet,
              net: scanRes.net
            } : t
          ));
        } else {
          warnCount++;
          setBatchItems(prev => prev.map((item, idx) =>
            idx === i ? {
              ...item,
              status: 'warning',
              message: scanRes.error || 'Referans noktaları okunamadı (form eğri veya ışıksız)'
            } : item
          ));
          setPageThumbnails(prev => prev.map((t, idx) =>
            idx === i ? { ...t, status: 'warning' } : t
          ));
        }
      } catch (err: any) {
        warnCount++;
        setBatchItems(prev => prev.map((item, idx) =>
          idx === i ? {
            ...item,
            status: 'error',
            message: err.message || 'Sayfa işlenirken hata oluştu'
          } : item
        ));
        setPageThumbnails(prev => prev.map((t, idx) =>
          idx === i ? { ...t, status: 'error' } : t
        ));
      }
    }

    if (collectedResults.length > 0) {
      try {
        // Sonuçları ait oldukları sınavlara göre grupla ve kaydet
        const resultsByExam: Record<string, ExamResult[]> = {};
        collectedResults.forEach(res => {
          const eId = (res as any).__examId || String(exam.id);
          if (!resultsByExam[eId]) resultsByExam[eId] = [];
          resultsByExam[eId].push(res);
        });

        for (const [eId, resList] of Object.entries(resultsByExam)) {
          await saveOmrExamResults(eId, resList);
        }
        playSuccessChime();
        const finishMsg = `🎉 Toplu tarama başarıyla tamamlandı! ${collectedResults.length} / ${pages.length} form kaydedildi.`;
        showAlert(finishMsg, 'success');
        setBatchProgress({
          current: pages.length,
          total: pages.length,
          stage: 'done',
          statusText: finishMsg
        });
      } catch (e: any) {
        showAlert("Sonuçlar kaydedilirken hata oluştu: " + e.message, 'error');
        setBatchProgress(prev => ({ ...prev, stage: 'done', statusText: "Kayıt sırasında hata oluştu: " + e.message }));
      }
    } else {
      showAlert("Optik formlar okunamadı. Form yönünü veya şablonu kontrol edin.", 'warning');
      setBatchProgress(prev => ({ ...prev, stage: 'done', statusText: "Okuma tamamlandı, ancak geçerli form tespit edilemedi." }));
    }

    setIsBatchRunning(false);
    setIsProcessing(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) {
      setIsProcessing(false);
      setStatus("");
      return;
    }

    stopCamera();
    scannedQrRef.current = null;
    setIsProcessing(true);
    setIsBatchRunning(true);
    setBatchModalOpen(true);
    batchAbortRef.current = false;
    setBatchProgress({
      current: 0,
      total: files.length,
      stage: 'extracting',
      statusText: "PDF dosyaları taranıyor ve sayfalar ayrıştırılıyor..."
    });
    setStatus("Dosyalar taranıyor ve PDF sayfaları ayrıştırılıyor...");

    let allProcessedFiles: { file: File; originalName: string; pageNum: number }[] = [];

    for (const file of files) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const pdfFiles = await processPdfToFiles(file, (cur, tot) => {
            const msg = `${file.name}: Sayfa ${cur} / ${tot} PDF'den yüksek netlikle ayıklanıyor...`;
            setStatus(msg);
            setBatchProgress({
              current: cur,
              total: tot,
              stage: 'extracting',
              statusText: msg
            });
          });
          pdfFiles.forEach((pf, idx) => {
            allProcessedFiles.push({ file: pf, originalName: file.name, pageNum: idx + 1 });
          });
        } catch (error: any) {
          console.error("PDF işleme hatası:", error);
          showAlert(`${file.name} PDF dönüştürülemedi: ` + (error?.message || error), 'error');
        }
      } else {
        allProcessedFiles.push({ file, originalName: file.name, pageNum: 1 });
      }
    }

    if (allProcessedFiles.length === 0) {
      setIsProcessing(false);
      setIsBatchRunning(false);
      setBatchModalOpen(false);
      setStatus("Geçerli bir resim veya PDF bulunamadı.");
      return;
    }

    // Küçük resimler (thumbnails) ve sayfa seçici veri yapısını oluştur
    const thumbs: PageThumbnail[] = allProcessedFiles.map((p, idx) => ({
      id: `${p.originalName}_${p.pageNum}_${idx}`,
      index: idx,
      fileName: p.originalName,
      pageNum: p.pageNum,
      file: p.file,
      thumbUrl: URL.createObjectURL(p.file),
      status: 'pending'
    }));
    setPageThumbnails(thumbs);

    const extractedRawFiles = allProcessedFiles.map(p => p.file);
    batchFilesRef.current = extractedRawFiles;
    batchIndexRef.current = 0;
    setBatchFiles(extractedRawFiles);
    setBatchIndex(0);

    // İlk sayfayı hemen canvas alanına yükle
    loadImage(allProcessedFiles[0].file, false, 0);

    // Modal'ı kapatıp Sayfa Seçici alanını öne çıkar:
    // Kullanıcı sayfaları sırayla inceleyebilir veya doğrudan "Tüm Sayfaları Tara" ile toplu okutabilir.
    setIsBatchRunning(false);
    setBatchModalOpen(false);
    showAlert(`📄 ${allProcessedFiles.length} sayfa yüklendi! Sayfa Seçici'den sayfaları inceleyebilir veya "Tüm Sayfaları Tara" butonuna basabilirsiniz.`, 'success');

    if (e.target) e.target.value = "";
  };

  const loadImage = (file: File, isAuto: boolean, currentIdx = 0) => {
    setImageLoaded(false);
    setOmrImg(null);
    setAnchors(null);
    setIsProcessing(true);
    setLaserMarks([]);
    setHomographyMat(null);
    setRotation90(0);
    setFineAngle(0);
    scannedQrRef.current = null;
    if (!lockToSelectedExam) {
      detectedExamRef.current = exam;
    }

    setAutoMode(isAuto);
    autoRotateTriedRef.current = 0;
    autoAlignTriedRef.current = false;

    setStatus(`Resim yükleniyor... (${currentIdx + 1} / ${batchFiles.length || 1})`);

    const img = new Image();
    img.onload = () => {
      setOmrImg(img);
      setImageLoaded(true);
    };
    img.onerror = () => {
      setIsProcessing(false);
      setStatus("Resim okunamadı. Başka bir dosya deneyin.");
    };
    img.src = URL.createObjectURL(file);
  };

  const handleAutoAlign = () => {
    if (!anchors) {
      showAlert("Otomatik hizalama için referans noktalarının analiz edilmiş olması gerekir.", 'warning');
      return;
    }
    const dy = anchors.tr.y - anchors.tl.y;
    const dx = anchors.tr.x - anchors.tl.x;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    if (Math.abs(angle) > 0.1) {
      setFineAngle(prev => {
        let newAngle = prev - angle;
        if (newAngle > 45) newAngle = 45;
        if (newAngle < -45) newAngle = -45;
        return parseFloat(newAngle.toFixed(2));
      });
      setAnchors(null);
      setIsProcessing(true);
      setStatus("Açı otomatik hizalandı. Yeniden işleniyor...");
    } else {
      showAlert("Kağıt zaten düz konumda.", 'success');
    }
  };

  useEffect(() => {
    if (!imageLoaded || !omrImg) return;

    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const baseW = 1600;
    const baseH = Math.round(omrImg.height * (baseW / omrImg.width));

    let rotW = baseW;
    let rotH = baseH;

    if (Math.abs(rotation90) % 180 !== 0) {
      rotW = baseH;
      rotH = baseW;
    }

    cvs.width = rotW;
    cvs.height = rotH;

    const processImage = async () => {
      ctx.clearRect(0, 0, rotW, rotH);
      ctx.save();
      ctx.translate(rotW / 2, rotH / 2);
      ctx.rotate((rotation90 + fineAngle) * Math.PI / 180);

      if (Math.abs(rotation90) % 180 !== 0) {
        ctx.drawImage(omrImg, -rotH / 2, -rotW / 2, rotH, rotW);
      } else {
        ctx.drawImage(omrImg, -rotW / 2, -rotH / 2, rotW, rotH);
      }
      ctx.restore();

      const imgData = ctx.getImageData(0, 0, rotW, rotH);

      if (!scannedQrRef.current) {
        const qrRes = scanQRRobustly(ctx, rotW, rotH);
        if (qrRes) {
          scannedQrRef.current = qrRes;
          scannedFormatRef.current = qrRes.includes('N:') ? 'mebi' : 'standard';
        }
      }

      if (isProcessing && anchors === null) {
        setStatus(`Deep-Scan devrede. Saf Homografi analizi yapılıyor...`);
        await new Promise(r => setTimeout(r, 50));

        const anchorData = findAnchorsCore(ctx, rotW, rotH);
        const pts = anchorData.pts;

        if (autoMode) {
          if (anchorData.lockFailed && autoRotateTriedRef.current < 3) {
            autoRotateTriedRef.current += 1;
            setStatus(`Kağıt yönü aranıyor (Deneme ${autoRotateTriedRef.current})...`);
            setRotation90(prev => prev + 90);
            setAnchors(null);
            return;
          }

          if (!anchorData.lockFailed && !autoAlignTriedRef.current) {
            const dy = pts.tr.y - pts.tl.y;
            const dx = pts.tr.x - pts.tl.x;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            if (Math.abs(angle) > 0.4) {
              autoAlignTriedRef.current = true;
              setFineAngle(prev => {
                let newAngle = prev - angle;
                if (newAngle > 45) newAngle = 45;
                if (newAngle < -45) newAngle = -45;
                return parseFloat(newAngle.toFixed(2));
              });
              setAnchors(null);
              setStatus("Açı otomatik ince ayarlanıyor...");
              return;
            }
          }
        }

        setAnchors(pts);
        const srcPts = [
          { x: DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.anchorMargin },
          { x: DEFAULT_OMR.paperW - DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.anchorMargin },
          { x: DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.paperH - DEFAULT_OMR.anchorMargin },
          { x: DEFAULT_OMR.paperW - DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.paperH - DEFAULT_OMR.anchorMargin }
        ];
        const dstPts = [pts.tl, pts.tr, pts.bl, pts.br];
        const H = getHomography(srcPts, dstPts);
        setHomographyMat(H);

        if (!scannedQrRef.current) {
          const qrRes = scanQRWithHomography(ctx, H);
          if (qrRes) {
            scannedQrRef.current = qrRes;
            try {
              const parts = qrRes.split('|');
              const qrObj: any = {};
              parts.forEach(p => { 
                const [k, v] = p.split(':'); 
                if (k && v) qrObj[k.trim()] = v.trim(); 
              });
              if (qrObj.E && !lockToSelectedExam) {
                const found = state.exams.find(e => String(e.id) === String(qrObj.E) || String(e.no) === String(qrObj.E));
                if (found) {
                  detectedExamRef.current = found;
                  setSelectedExamId(String(found.id));
                }
              }
            } catch (e) {}
          }
        }

        const currentOMR = getActiveOMR();

        if (autoMode && !anchorData.lockFailed) {
          setTimeout(() => readForm(pts, H, currentOMR), 50);
        } else {
          setAutoMode(false);
          if (anchorData.lockFailed) {
            setStatus("⚠️ Otomatik kilitleme başarısız. Lütfen kağıt yönünü düzeltin veya kırmızı halkaları köşelerdeki siyah karelere taşıyın.");
          } else {
            setStatus("Referans noktaları bulundu. Nişangahları manuel düzeltebilirsiniz.");
          }
          setIsProcessing(false);
        }
      } else if (anchors !== null) {
        const currentOMR = getActiveOMR();
        const srcPts = [
          { x: DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.anchorMargin },
          { x: DEFAULT_OMR.paperW - DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.anchorMargin },
          { x: DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.paperH - DEFAULT_OMR.anchorMargin },
          { x: DEFAULT_OMR.paperW - DEFAULT_OMR.anchorMargin, y: DEFAULT_OMR.paperH - DEFAULT_OMR.anchorMargin }
        ];
        const dstPts = [anchors.tl, anchors.tr, anchors.bl, anchors.br];
        const H = getHomography(srcPts, dstPts);
        setHomographyMat(H);
        drawOverlay(anchors, H, laserMarks, currentOMR);
      }
    };

    processImage();
  }, [imageLoaded, omrImg, isProcessing, anchors, laserMarks, expectedFormat, rotation90, fineAngle]);

  const drawOverlay = (
    pts: Anchors,
    H: number[] | null,
    marks: LaserMark[] = [],
    omrToUse: typeof DEFAULT_OMR = OMR_SPECS,
    examToUse: Exam = (detectedExamRef.current || exam)
  ) => {
    const overCvs = overlayCanvasRef.current;
    const cvs = canvasRef.current;
    if (!overCvs || !cvs || !H || !omrToUse) return;

    overCvs.width = cvs.width; 
    overCvs.height = cvs.height;
    const ctx = overCvs.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overCvs.width, overCvs.height);

    // 1. Dört köşe kırmızı kalibrasyon halkaları ve nişangah
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    Object.values(pts).forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 25, 0, 2 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x - 35, p.y); ctx.lineTo(p.x + 35, p.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 35); ctx.lineTo(p.x, p.y + 35); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 0, 0, 0.25)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 25, 0, 2 * Math.PI); ctx.fill();
    });

    // 2. Kitapçık Türü Baloncukları (A, B, C, D)
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.85)';
    ctx.lineWidth = 1.5;
    const bookletPositions = getBookletBubblePositions(omrToUse);
    bookletPositions.forEach(bp => {
      const mapped = applyHomography(bp.x, bp.y, H);
      ctx.strokeRect(mapped.x - 6, mapped.y - 6, 13, 13);
    });

    // 3. QR Kod Konum Çerçevesi
    const qrBox = getQrCodeBox(omrToUse);
    const qtl = applyHomography(qrBox.x, qrBox.y, H);
    const qtr = applyHomography(qrBox.x + qrBox.w, qrBox.y, H);
    const qbr = applyHomography(qrBox.x + qrBox.w, qrBox.y + qrBox.h, H);
    const qbl = applyHomography(qrBox.x, qrBox.y + qrBox.h, H);
    ctx.strokeStyle = scannedQrRef.current ? 'rgba(16, 185, 129, 0.95)' : 'rgba(245, 158, 11, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(qtl.x, qtl.y);
    ctx.lineTo(qtr.x, qtr.y);
    ctx.lineTo(qbr.x, qbr.y);
    ctx.lineTo(qbl.x, qbl.y);
    ctx.closePath();
    ctx.stroke();

    // 4. İlgili Sınavın Soru ve Şık Baloncukları (layoutItems)
    const { items: layoutItems } = getQuestionsLayout(examToUse, omrToUse);
    ctx.strokeStyle = 'rgba(0, 150, 255, 0.7)';
    ctx.lineWidth = 1;
    layoutItems.forEach((item) => {
      if (item.type === 'question') {
        const bubbles = item.bubbleCenters || [];
        bubbles.forEach((bc) => {
          const mapped = applyHomography(bc.x, bc.y, H);
          ctx.strokeRect(mapped.x - 5, mapped.y - 5, 11, 11);
        });
      }
    });

    // 5. İşaretlenen Lazer Noktaları
    if (marks && marks.length > 0) {
      marks.forEach(m => {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.type === 'info' ? 3.5 : 4.5, 0, 2 * Math.PI);
        ctx.strokeStyle = m.type === 'info' ? 'cyan' : 'magenta';
        ctx.lineWidth = 3;
        ctx.stroke();
      });
    }
  };

  const readForm = (pts: Anchors | null = anchors, currentH: number[] | null = homographyMat, specificOMR: typeof DEFAULT_OMR | null = null) => {
    const omrToUse = specificOMR || OMR_SPECS;

    if (!pts || !currentH) return showAlert("Önce kalibrasyon yapılmalı.", 'warning');
    setIsProcessing(true);

    setTimeout(async () => {
      try {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
        const imgBytes = imgData.data;

        const foundMarks: LaserMark[] = [];
        let qrDataObj: any = null;

        if (!scannedQrRef.current) {
          const qrRes = scanQRWithHomography(ctx, currentH) || scanQRRobustly(ctx, cvs.width, cvs.height);
          if (qrRes) {
            scannedQrRef.current = qrRes;
          }
        }

        if (scannedQrRef.current) {
          const parts = scannedQrRef.current.split('|');
          qrDataObj = {};
          parts.forEach(p => { 
            const [k, v] = p.split(':'); 
            if (k && v) qrDataObj[k.trim()] = v.trim(); 
          });
        }

        // 1. HEDEF SINAV ŞABLONUNU BELİRLEME
        // Ekrandaki aktif sınav seçimine bağlı kalmadan, karekoddaki sınava anında dinamik geçiş
        const qrExamId = qrDataObj?.E;
        const qrStudentNo = qrDataObj?.N;

        let targetExam = exam;
        if (qrExamId) {
          const found = state.exams.find(e => String(e.id) === String(qrExamId) || String(e.no) === String(qrExamId));
          if (found) {
            targetExam = found;
            setSelectedExamId(String(found.id));
          }
        } else if (detectedExamRef.current) {
          targetExam = detectedExamRef.current;
        }
        detectedExamRef.current = targetExam;

        let finalNo = qrStudentNo ? String(qrStudentNo) : "";

        // Seri Okuma Koruması (2.5 saniyelik okuma kilidi / debounce / cooldown)
        const scanKey = `${targetExam.id}-${finalNo || 'anon'}`;
        const now = Date.now();
        if (scanCooldownRef.current.key === scanKey && (now - scanCooldownRef.current.time) < 2500) {
          setIsProcessing(false);
          return;
        }

        const getFastAvg = (cx: number, cy: number, radius: number) => {
          let dSum = 0, dCnt = 0;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const px = Math.floor(cx + dx);
              const py = Math.floor(cy + dy);
              if (px >= 0 && px < cvs.width && py >= 0 && py < cvs.height) {
                const i = (py * cvs.width + px) * 4;
                const r = imgBytes[i];
                const g = imgBytes[i + 1];
                const b = imgBytes[i + 2];
                const whiteness = Math.max(r, g, b);
                dSum += (255 - whiteness);
                dCnt++;
              }
            }
          }
          return dSum / (dCnt || 1);
        };

        const getDeepestDarkness = (cx: number, cy: number, searchRadiusX: number, searchRadiusY: number, coreRadius: number) => {
          let maxScore = -Infinity;
          let bestX = cx, bestY = cy;
          let actualVal = 0;

          for (let sy = -searchRadiusY; sy <= searchRadiusY; sy += 1) {
            for (let sx = -searchRadiusX; sx <= searchRadiusX; sx += 1) {
              const avgDark = getFastAvg(cx + sx, cy + sy, coreRadius);
              const dist = Math.hypot(sx, sy);

              const penalty = (dist * dist) * 0.35;
              const score = avgDark - penalty;

              if (score > maxScore) {
                maxScore = score;
                bestX = cx + sx;
                bestY = cy + sy;
                actualVal = avgDark;
              }
            }
          }
          return { val: actualVal, x: bestX, y: bestY };
        };

        const scalePxPerMm = cvs.width / (omrToUse.paperW || 210);
        const bubbleRadiusPx = (omrToUse.questions.bubbleRadius || 1.8) * scalePxPerMm;
        const bookletRadiusPx = 2.4 * scalePxPerMm;

        // 2. Kitapçık Türü Tespiti (A - B - C - D)
        let mebiCodedBk: string | null = null;
        const bookletPositions = getBookletBubblePositions(omrToUse);
        const bkEval = evaluateQuestionAnswer(
          bookletPositions.map(bp => ({ option: bp.booklet, x: bp.x, y: bp.y })),
          currentH,
          imgBytes,
          cvs.width,
          cvs.height,
          bookletRadiusPx
        );
        if (bkEval.answer) {
          mebiCodedBk = bkEval.answer;
          if (bkEval.markedPoint) {
            foundMarks.push({ x: bkEval.markedPoint.x, y: bkEval.markedPoint.y, type: 'info' });
          }
        }

        // 3. İşaretlemelerin Okunması (Bubble Sampling) - İlgili Sınavın OmrMap'ı kullanılır
        const { items: layoutItems } = getQuestionsLayout(targetExam, omrToUse);
        const qItems = layoutItems.filter(i => i.type === 'question');
        const readAns = Array(qItems.length).fill("");

        layoutItems.forEach((item) => {
          if (item.type === 'question' && item.qIdx !== undefined) {
            const bubbles = (item.bubbleCenters || []).map(bc => ({
              option: bc.option,
              x: bc.x,
              y: bc.y
            }));

            const evalRes = evaluateQuestionAnswer(
              bubbles,
              currentH,
              imgBytes,
              cvs.width,
              cvs.height,
              bubbleRadiusPx
            );

            if (evalRes.answer) {
              readAns[item.qIdx] = evalRes.answer;
              if (evalRes.markedPoint) {
                foundMarks.push({ x: evalRes.markedPoint.x, y: evalRes.markedPoint.y, type: 'question' });
              }
            }
          }
        });

        setLaserMarks(foundMarks);

        let finalName = "İSİMSİZ";
        let cleanCls = "-";
        let cleanSec = "-";
        let autoCorrected = false;

        // 4. MERKEZİ ÖĞRENCİ KÜTÜĞÜ VE SINAV LİSTESİ İLE EŞLEŞTİRME
        let matchedStudent: (Student | OmrStudent) | undefined = undefined;

        if (finalNo) {
          matchedStudent = targetExam.studentList?.find(s => 
            String(s.no) === String(finalNo) || 
            Number(s.no) === Number(finalNo) ||
            (('id' in s && s.id) ? String(s.id) === String(finalNo) : false)
          );
          if (!matchedStudent) {
            matchedStudent = state.students.find(s => 
              String(s.no) === String(finalNo) || 
              Number(s.no) === Number(finalNo) ||
              (s.id && String(s.id) === String(finalNo))
            );
          }
        }

        // QR kod yoksa veya eşleşmediyse form üzerindeki kodlanmış baloncukları oku
        if (!matchedStudent || !finalNo) {
          const bubbled = scanInfoFields(ctx, currentH, omrToUse);
          if (bubbled.bubbledNo && !finalNo) {
            finalNo = bubbled.bubbledNo;
            matchedStudent = targetExam.studentList?.find(s => String(s.no) === String(finalNo) || Number(s.no) === Number(finalNo))
              || state.students.find(s => String(s.no) === String(finalNo) || Number(s.no) === Number(finalNo));
          }
          if (bubbled.bubbledName && finalName === "İSİMSİZ") {
            finalName = bubbled.bubbledName;
          }
          if (bubbled.bubbledBk && !mebiCodedBk) {
            mebiCodedBk = bubbled.bubbledBk;
          }
        }

        if (matchedStudent) {
          autoCorrected = true;
          finalName = matchedStudent.name || finalName;
          finalNo = String(matchedStudent.no || finalNo);
          const studentCls = ('className' in matchedStudent ? matchedStudent.className : '') || matchedStudent.classStr || '';
          const { cls, sec } = formatClassSec(studentCls, matchedStudent.sectionStr);
          cleanCls = cls || cleanCls;
          cleanSec = sec || cleanSec;
        }

        const finalBk = mebiCodedBk || "A";

        // 5. SONUÇ KAYDI VE AKADEMİPANEL SENKRONİZASYONU
        const studentResultPayload = createUnifiedExamResult(
          {
            studentId: matchedStudent && 'id' in matchedStudent ? matchedStudent.id : undefined,
            studentNo: Number(finalNo) || undefined,
            studentName: finalName,
            name: finalName,
            no: finalNo || undefined,
            classStr: cleanCls,
            sectionStr: cleanSec,
            booklet: finalBk,
            answers: readAns
          },
          targetExam,
          matchedStudent
        );

        const evaluatedScore = studentResultPayload.evaluatedScore;

        // Firestore / Context üzerine doğru sınav ID'si ile kaydet
        await saveOmrExamResults(String(targetExam.id), [studentResultPayload]);
        scanCooldownRef.current = { key: scanKey, time: now };
        playSuccessChime();

        setScanSuccessCard({
          studentName: finalName,
          studentNo: finalNo || 'BOŞ',
          booklet: finalBk,
          net: Math.round(evaluatedScore.total.net * 100) / 100,
          examName: targetExam.name
        });
        setTimeout(() => {
          setScanSuccessCard(null);
        }, 3500);

        if (batchIndexRef.current >= 0) {
          const curIdx = batchIndexRef.current;
          setPageThumbnails(prev => prev.map((t, idx) =>
            idx === curIdx ? {
              ...t,
              status: 'success',
              studentName: finalName,
              studentNo: finalNo,
              booklet: finalBk,
              net: evaluatedScore.total.net
            } : t
          ));
        }

        if (isCameraActive) {
          let successMsg = `✅ ${finalName} kaydedildi! (${finalBk} Kit.) - ${evaluatedScore.total.net.toFixed(2)} Net`;
          if (autoCorrected) successMsg = `✨ ${finalName} (Kütükten Doğrulandı) - ${evaluatedScore.total.net.toFixed(2)} Net`;

          setStatus(successMsg);
          showAlert(successMsg, 'success');

          setTimeout(() => {
            if (!isCameraActive) return;
            setImageLoaded(false);
            setOmrImg(null);
            setAnchors(null);
            setLaserMarks([]);
            setIsProcessing(false);
            lockCounter.current = 0;
            setLockLevel(0);
            scannedQrRef.current = null;
            setStatus("Sıradaki optiği vizöre hizalayın...");
          }, 1200);
        } else if (batchFilesRef.current.length > 1 && batchIndexRef.current + 1 < batchFilesRef.current.length) {
          const nextIdx = batchIndexRef.current + 1;
          batchIndexRef.current = nextIdx;
          setBatchIndex(nextIdx);
          setStatus(`Sıradaki forma geçiliyor... (${nextIdx + 1} / ${batchFilesRef.current.length})`);

          setTimeout(() => {
            setImageLoaded(false);
            setOmrImg(null);
            setAnchors(null);
            setLaserMarks([]);
            setHomographyMat(null);
            scannedQrRef.current = null;
            loadImage(batchFilesRef.current[nextIdx], true, nextIdx);
          }, 800);
        } else {
          setIsProcessing(false);
          setAutoMode(false);
          scannedQrRef.current = null;
          setStatus(`✅ Tarama tamamlandı: ${finalName} sisteme işlendi.`);
          showAlert(`Form başarıyla okundu: ${finalName} (${evaluatedScore.total.net.toFixed(2)} Net)`, 'success');
          setBatchFiles([]);
          batchFilesRef.current = [];
          batchIndexRef.current = -1;
        }
      } catch (err: any) {
        if (batchIndexRef.current >= 0) {
          const curIdx = batchIndexRef.current;
          setPageThumbnails(prev => prev.map((t, idx) =>
            idx === curIdx ? { ...t, status: 'error' } : t
          ));
        }
        showAlert("Okuma sırasında hata oluştu: " + err.message, 'error');
        setIsProcessing(false);
        setStatus("Hata oluştu.");
      }
    }, 50);
  };

  const handleExamChange = (newExamId: string) => {
    setSelectedExamId(newExamId);
    try { sessionStorage.setItem('active_exam_id', newExamId); } catch(e) {}
    const target = state.exams.find(e => String(e.id) === String(newExamId));
    if (target) {
      detectedExamRef.current = target;
      const qCount = target.subjects?.reduce((sum, s) => sum + s.count, 0) || (target.keys?.A?.length) || 0;
      showAlert(`🎯 Aktif OMR Şablonu: "${target.name}" (${qCount > 0 ? `${qCount} Soru` : ''})`, 'success');
      if (anchors && homographyMat) {
        drawOverlay(anchors, homographyMat, laserMarks, getActiveOMR(), target);
      }
    }
  };

  const anchorTargets = [
    { top: '2.5%', left: '3.5%' },
    { top: '2.5%', left: '96.5%' },
    { top: '97.5%', left: '3.5%' },
    { top: '97.5%', left: '96.5%' }
  ];

  return (
    <div className="bg-slate-900 rounded-none md:rounded-2xl shadow-xl border-0 md:border border-slate-800 overflow-hidden h-full flex flex-col text-white relative">
      {/* Yeşil Başarı Kartı (Öğrenci Adı, No, Kitapçık ve Net) */}
      {scanSuccessCard && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[300] w-[92%] max-w-md bg-emerald-600/95 backdrop-blur-md text-white px-5 py-4 rounded-2xl shadow-2xl border-2 border-emerald-300 flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-emerald-100 font-bold truncate">
                {scanSuccessCard.examName}
              </div>
              <div className="text-base font-black truncate leading-tight">
                {scanSuccessCard.studentName}
              </div>
              <div className="text-xs font-semibold text-emerald-100 flex items-center gap-2 mt-0.5">
                <span>No: <strong className="text-white font-mono">{scanSuccessCard.studentNo}</strong></span>
                <span>•</span>
                <span>Kitapçık: <strong className="text-white">{scanSuccessCard.booklet}</strong></span>
              </div>
            </div>
          </div>
          <div className="bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-center shrink-0">
            <div className="text-[10px] uppercase font-bold text-emerald-100">Toplam Net</div>
            <div className="text-xl font-black leading-tight text-white">{scanSuccessCard.net}</div>
          </div>
        </div>
      )}

      {/* Toast Alert Bildirimi */}
      {toastAlert && (
        <div className={`fixed top-4 right-4 z-[200] px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-top-3 duration-200 text-xs font-bold ${
          toastAlert.type === 'success' 
            ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500/50' 
            : toastAlert.type === 'error'
            ? 'bg-red-950/95 text-red-200 border-red-500/50'
            : 'bg-amber-950/95 text-amber-200 border-amber-500/50'
        }`}>
          {toastAlert.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <span>{toastAlert.message}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/30 shrink-0">
            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                Akıllı Optik Tarayıcı & OMR
              </h3>
              <div className="flex items-center gap-1.5 bg-slate-800/90 border border-emerald-500/40 rounded-lg px-2 py-0.5">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-300 shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Şablon:
                </span>
                <select
                  value={lockToSelectedExam ? selectedExamId : 'auto'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'auto') {
                      setLockToSelectedExam(false);
                      showAlert("🤖 Otomatik QR Sınav Tespiti aktif. Taranan formun QR kodundaki sınav şablonu yüklenecektir.", 'success');
                    } else {
                      setLockToSelectedExam(true);
                      handleExamChange(val);
                    }
                  }}
                  className="bg-slate-900 text-emerald-400 font-bold text-xs rounded border border-slate-700 px-2 py-0.5 outline-none cursor-pointer max-w-[200px] sm:max-w-xs truncate"
                  title="Okutulacak Sınav Şablonu"
                >
                  <option value="auto">⚡ Otomatik (QR Kodundan Algıla)</option>
                  {allExams.map(e => {
                    const qCount = e.subjects?.reduce((sum, s) => sum + s.count, 0) || (e.keys?.A?.length) || 0;
                    return (
                      <option key={e.id} value={e.id}>
                        {e.name} {qCount > 0 ? `(${qCount} Soru)` : ''}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  onClick={() => setLockToSelectedExam(prev => !prev)}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer ${
                    lockToSelectedExam 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                  title={lockToSelectedExam ? "Bu sınav şablonuna kilitlendi (QR sınavını aramaz)." : "Akıllı Mod Aktif: QR kodundan sınav ID'si otomatik algılanır."}
                >
                  {lockToSelectedExam ? <Lock className="w-2.5 h-2.5 text-amber-400" /> : <Unlock className="w-2.5 h-2.5 text-emerald-400" />}
                  <span className="hidden sm:inline">{lockToSelectedExam ? 'Kilitli' : 'QR Otomatik'}</span>
                </button>
              </div>
            </div>
            <p className="text-slate-400 text-[11px] sm:text-xs hidden sm:flex items-center gap-2 truncate mt-0.5">
              <span className="text-slate-200 font-bold">{exam.name}</span>
              <span>•</span>
              <span>{totalQ} Soru OMR Haritası</span>
              <span>•</span>
              <span>{state.students.length} Kayıtlı Öğrenci</span>
              {!lockToSelectedExam && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 rounded font-semibold">
                  <Sparkles className="w-2.5 h-2.5" /> Dinamik QR Tespiti
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (onNavigate) {
                onNavigate('keys_print');
              } else if (typeof window !== 'undefined' && (window as any).__navigateToTab) {
                (window as any).__navigateToTab('keys_print');
              }
              if (typeof window !== 'undefined' && (window as any).__keysPrintSetTab) {
                (window as any).__keysPrintSetTab('print');
              }
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-purple-600/50 cursor-pointer shadow-xs"
            title="Karekodlu Optik Form Baskı ve Canlı Önizleme Merkezine Git"
          >
            <span>🖨️ Form Yazdır / Önizle</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-300">
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span><strong className="text-emerald-400 font-mono">{(exam.results || []).length}</strong> Okundu</span>
          </div>

          {imageLoaded && !isCameraActive && (
            <button
              onClick={() => {
                setImageLoaded(false);
                setOmrImg(null);
                setAnchors(null);
                setBatchFiles([]);
                setStatus("");
              }}
              className="px-2.5 py-1 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition-colors border border-slate-700 cursor-pointer font-medium"
              title="Formu Temizle"
            >
              Temizle
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {exam.examType === 'publisher' && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold">⚠️ Bilgilendirme:</span>
            <span>"{exam.name}" bir <strong>Yayıncı Denemesidir</strong>. Yayıncı denemeleri için sonuçlar 'Öğrenci & Sonuçlar' sekmesinden Excel yüklemesiyle alınır; optik okuma gerektirmez. Optik okuma için lütfen 'Kurum İçi Optik Deneme' türünde bir sınav seçiniz.</span>
          </div>
        </div>
      )}

      {/* Üst Kayan Toplu Tarama & Progress Bar Bildirimi */}
      {isBatchRunning && (
        <div className="bg-gradient-to-r from-blue-950/95 via-slate-900/95 to-indigo-950/95 border-b border-blue-500/40 px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-white shadow-lg shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Toplu PDF Tarama Sürüyor</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                  {batchProgress.stage === 'extracting' ? '1. Aşama: PDF Ayrıştırma' : '2. Aşama: QR & Optik Okuma'}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                {batchProgress.statusText || `Sayfa ${batchProgress.current} / ${batchProgress.total}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-72">
            <div className="flex-1 bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/80">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
                style={{ width: `${Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-blue-400 font-mono shrink-0">
              %{Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100)}
            </span>
            <button
              onClick={() => setBatchModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-[11px] font-bold text-white shrink-0 cursor-pointer shadow transition-colors"
            >
              Detayları Göster
            </button>
          </div>
        </div>
      )}

      {/* Main Layout Area */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden relative bg-slate-950">
        {/* Left Control Panel */}
        <div className="w-full lg:w-96 flex flex-col gap-3 p-3 sm:p-4 lg:border-r border-slate-800 shrink-0 overflow-y-auto custom-scrollbar">
          {/* Sınav ve OMR Şablonu Kontrol Kartı */}
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700/80 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hedef Sınav OMR Şablonu:</span>
              </label>
              <button
                type="button"
                onClick={() => setLockToSelectedExam(prev => !prev)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                  lockToSelectedExam 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
                title={lockToSelectedExam ? "Şablon kilitli. Yalnızca bu sınavın OMR haritası ve cevap anahtarı kullanılır." : "QR kodundaki sınav bilgisine göre otomatik geçilir."}
              >
                {lockToSelectedExam ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3 text-slate-400" />}
                <span>{lockToSelectedExam ? 'Şablon Kilitli' : 'Otomatik QR'}</span>
              </button>
            </div>

            <select
              value={selectedExamId}
              onChange={(e) => handleExamChange(e.target.value)}
              className="w-full bg-slate-800 text-white font-bold text-xs rounded-lg border border-slate-600 px-2.5 py-2 outline-none focus:border-emerald-500 cursor-pointer"
            >
              {allExams.map(e => {
                const qCount = e.subjects?.reduce((sum, s) => sum + s.count, 0) || (e.keys?.A?.length) || 0;
                return (
                  <option key={e.id} value={e.id}>
                    {e.name} {qCount > 0 ? `(${qCount} Soru)` : ''}
                  </option>
                );
              })}
            </select>

            <div className="flex items-center justify-between text-[10px] text-slate-300 pt-1.5 border-t border-slate-800/80">
              <span className="font-medium">
                {exam.subjects && exam.subjects.length > 0
                  ? `${exam.subjects.length} Ders • ${totalQ} Soru (${exam.optionsCount || 4} Şık)`
                  : `${totalQ} Soru`}
              </span>
              <span className={exam.keys?.A && exam.keys.A.length > 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                {exam.keys?.A && exam.keys.A.length > 0 ? "✅ Anahtar Hazır" : "⚠️ Anahtar Eksik"}
              </span>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-2">
            {/* Live Camera Button */}
            <button
              type="button"
              onClick={() => startCamera('environment')}
              disabled={isProcessing}
              className={`w-full group px-4 py-3.5 sm:py-4 rounded-xl font-bold transition-all text-left flex items-center justify-between shadow-lg cursor-pointer ${
                isProcessing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40 active:scale-[0.99] border border-emerald-400/30'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                  <Video className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-bold leading-tight">Canlı Kamerayı Aç</div>
                  <div className="text-[11px] sm:text-xs text-emerald-100/80 font-normal mt-0.5 truncate">
                    Otomatik odaklama & anında tarama
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold text-white shrink-0 transition-colors">
                Başlat
              </span>
            </button>

            {/* File or PDF Upload & Native System Camera */}
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer relative overflow-hidden group shadow-sm ${
                  isProcessing
                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-b from-blue-900/40 to-slate-900/90 hover:from-blue-900/70 hover:to-slate-800 text-slate-200 border-blue-500/40 hover:border-blue-400 active:scale-[0.98]'
                }`}
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-white flex items-center gap-1">
                  Dosya / Çoklu PDF
                </span>
                <span className="text-[9px] sm:text-[10px] text-blue-300/80 font-normal">
                  Görsel veya Çok Sayfalı PDF
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg, image/png, image/jpg, application/pdf"
                  onChange={handleImageUpload}
                  disabled={isProcessing}
                  className="hidden"
                />
              </label>

              <label
                htmlFor="nativeCameraInput"
                className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                  isProcessing
                    ? 'bg-slate-800 text-slate-500 border-slate-700 pointer-events-none opacity-50'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 active:scale-[0.98]'
                }`}
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-1">
                  <Smartphone className="w-4 h-4" />
                </div>
                <span className="text-[11px] sm:text-xs">Cihaz Kamerası</span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-normal">Tek Çekim</span>
                <input
                  id="nativeCameraInput"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  disabled={isProcessing}
                  className="hidden"
                />
              </label>
            </div>

            {/* Auto-save toggle */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <label htmlFor="autoSaveToggle" className="text-xs text-slate-300 font-medium cursor-pointer select-none">
                Tekli fotoğrafları otomatik kaydet
              </label>
              <input
                type="checkbox"
                id="autoSaveToggle"
                checked={autoSaveSingle}
                onChange={e => setAutoSaveSingle(e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-slate-800 border-slate-600 rounded cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Batch Status Progress */}
          {isProcessing && !isCameraActive && (
            <div className="bg-slate-900/90 p-3 rounded-xl border border-blue-500/30 space-y-2 text-left shadow-md">
              <div className="flex justify-between text-xs font-bold text-blue-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  Toplu İşlem Sürüyor
                </span>
                <span>{batchIndex + 1} / {batchFiles.length || 1}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${((batchIndex + 1) / (batchFiles.length || 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Status Message */}
          {status && !isCameraActive && (
            <div className="text-emerald-300 text-xs font-semibold bg-emerald-950/40 p-2.5 sm:p-3 rounded-xl border border-emerald-500/30 flex items-start gap-2 shadow-sm">
              <span className="text-emerald-400 shrink-0 mt-0.5">ℹ️</span>
              <span className="leading-snug">{status}</span>
            </div>
          )}

          {/* Image Alignment & Rotation Controls (When an image is loaded) */}
          {imageLoaded && !isCameraActive && (
            <div className="bg-slate-900/90 p-3 sm:p-3.5 rounded-xl border border-slate-800 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Hizalama & Açı
                </h4>
                <button
                  type="button"
                  onClick={handleAutoAlign}
                  className="text-[11px] font-bold text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/60 px-2 py-0.5 rounded-lg border border-indigo-700/40 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Otomatik Düzelt
                </button>
              </div>

              {/* 90-degree Rotation Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setRotation90(prev => prev - 90); setAnchors(null); setIsProcessing(true); }}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-1.5 rounded-lg transition-colors text-xs border border-slate-700 active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sola 90°</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setRotation90(prev => prev + 90); setAnchors(null); setIsProcessing(true); }}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-1.5 rounded-lg transition-colors text-xs border border-slate-700 active:scale-95 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Sağa 90°</span>
                </button>
              </div>

              {/* Fine Angle Slider */}
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1 font-bold">
                  <span>İnce Açı</span>
                  <span className="text-blue-400 font-mono text-xs px-1.5 py-0.2 bg-blue-950/60 rounded border border-blue-800/40">
                    {fineAngle > 0 ? `+${fineAngle}` : fineAngle}°
                  </span>
                  <button
                    type="button"
                    onClick={() => { setFineAngle(0); setAnchors(null); setIsProcessing(true); }}
                    className="text-slate-400 hover:text-white text-[10px] cursor-pointer"
                  >
                    Sıfırla
                  </button>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  step="0.5"
                  value={fineAngle}
                  onChange={(e) => { setFineAngle(parseFloat(e.target.value)); setAnchors(null); setIsProcessing(true); }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Manual Confirmation Button */}
              {!isProcessing && !autoMode && (
                <button
                  type="button"
                  onClick={() => readForm(anchors)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-950/40 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ONAYLA VE FORMU OKU</span>
                </button>
              )}
            </div>
          )}

          {/* Quick Guidance Info */}
          <div className="mt-auto pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> İpuçları
            </div>
            <p className="leading-relaxed text-[10px] sm:text-[11px]">
              Optik formu düz bir zemine koyun ve 4 siyah köşe karesinin vizörde net görünmesini sağlayın. Okunan sonuçlar doğrudan Firestore veritabanına işlenir.
            </p>
          </div>
        </div>

        {/* Right Preview Viewport Area */}
        <div className="flex-1 bg-slate-950 flex flex-col justify-between items-center relative min-h-[50vh] lg:min-h-0 overflow-hidden">
          {imageLoaded && !isCameraActive ? (
            <div className="relative flex-1 w-full flex flex-col justify-center items-center p-2 sm:p-4 overflow-hidden">
              <div
                className="relative rounded-lg overflow-hidden border border-slate-700 shadow-2xl bg-white"
                style={{
                  height: '100%',
                  aspectRatio: '210 / 297',
                  maxHeight: pageThumbnails.length > 0 ? '56vh' : '82vh',
                  maxWidth: '94vw'
                }}
              >
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-contain bg-white" />
                <canvas
                  ref={overlayCanvasRef}
                  className={`absolute top-0 left-0 w-full h-full object-contain z-10 ${
                    (!isCameraActive && imageLoaded && !isProcessing)
                      ? 'pointer-events-auto touch-none cursor-crosshair'
                      : 'pointer-events-none'
                  }`}
                  onMouseDown={handlePtrDown}
                  onMouseMove={handlePtrMove}
                  onMouseUp={handlePtrUp}
                  onMouseLeave={handlePtrUp}
                  onTouchStart={handlePtrDown}
                  onTouchMove={handlePtrMove}
                  onTouchEnd={handlePtrUp}
                />
              </div>

              <div className="mt-1.5 text-center text-[11px] text-slate-400 select-none">
                Gerekirse kırmızı noktaları parmağınızla siyah köşe karelerine sürükleyebilirsiniz
              </div>
            </div>
          ) : (
            !isCameraActive && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
                  <Camera className="w-8 h-8 text-slate-600" />
                </div>
                <h4 className="text-base font-bold text-slate-200 mb-1">
                  Taramaya Hazır
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Optik formları okumak için <strong>Canlı Kamerayı Aç</strong> veya optik form görselini/PDF dosyasını yükleyin.
                </p>
                <button
                  type="button"
                  onClick={() => startCamera('environment')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
                >
                  <Video className="w-4 h-4" /> Canlı Kamerayı Başlat
                </button>
              </div>
            )
          )}

          {/* Sayfa Seçici (Thumbnail Filmstrip / Page Review Area) */}
          {pageThumbnails.length > 0 && (
            <div className="w-full bg-slate-900/95 border-t border-slate-800 p-2.5 sm:p-3 flex flex-col gap-2 shrink-0 z-20 shadow-2xl backdrop-blur-md">
              {/* Sayfa Seçici Üst Başlık & Kontroller */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="p-1 rounded-md bg-blue-500/20 text-blue-400">
                    <ListOrdered className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        Sayfa Seçici & Tarama Sırası
                        <span className="px-2 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                          {pageThumbnails.length} Sayfa
                        </span>
                      </span>

                      {/* Optik Tanınma Durum Özeti (Yeşil / Kırmızı / Bekleyen Rozetleri) */}
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>{pageThumbnails.filter(t => t.status === 'success').length} Başarılı</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-2xs">
                          <XCircle className="w-3 h-3 text-rose-400" />
                          <span>{pageThumbnails.filter(t => t.status === 'error' || t.status === 'warning').length} Hatalı</span>
                        </span>
                        {pageThumbnails.filter(t => t.status === 'pending' || t.status === 'processing').length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{pageThumbnails.filter(t => t.status === 'pending' || t.status === 'processing').length} Bekliyor</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Aktif: <strong>Sayfa {batchIndex + 1}</strong> • Önizlemek veya tekli okumak için sayfaya tıklayın
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => selectThumbnailPage(batchIndex - 1)}
                    disabled={batchIndex <= 0 || isBatchRunning}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1 border border-slate-700 cursor-pointer transition-colors"
                    title="Önceki Sayfayı İncele"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Önceki</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectThumbnailPage(batchIndex + 1)}
                    disabled={batchIndex >= pageThumbnails.length - 1 || isBatchRunning}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1 border border-slate-700 cursor-pointer transition-colors"
                    title="Sonraki Sayfayı İncele"
                  >
                    <span className="hidden sm:inline">Sonraki</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => runBatchEngine()}
                    disabled={isBatchRunning}
                    className="px-3 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-[11px] font-bold text-white flex items-center gap-1.5 shadow-md shadow-blue-950/40 cursor-pointer transition-all disabled:opacity-50"
                    title="Listedeki Tüm Sayfaları Otomatik Oku"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Tüm Sayfaları Tara ({pageThumbnails.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={clearAllPages}
                    disabled={isBatchRunning}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer border border-transparent hover:border-rose-900/40"
                    title="Tüm Sayfaları Listeden Kaldır"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Küçük Resimler (Thumbnails) Şeridi */}
              <div
                ref={thumbContainerRef}
                className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-1 px-1 custom-scrollbar select-none"
              >
                {pageThumbnails.map((t, idx) => {
                  const isCurrent = batchIndex === idx;
                  const isSuccess = t.status === 'success';
                  const isError = t.status === 'error' || t.status === 'warning';
                  const isProcessingItem = t.status === 'processing';

                  return (
                    <div
                      key={t.id}
                      onClick={() => selectThumbnailPage(idx)}
                      className={`relative group shrink-0 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col ${
                        isCurrent
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-[1.03] z-10 shadow-xl'
                          : ''
                      } ${
                        isSuccess
                          ? 'border-2 border-emerald-500 bg-emerald-950/30 shadow-md shadow-emerald-950/50 hover:border-emerald-400'
                          : isError
                          ? 'border-2 border-rose-500 bg-rose-950/30 shadow-md shadow-rose-950/50 hover:border-rose-400'
                          : isProcessingItem
                          ? 'border-2 border-blue-500 bg-blue-950/30 shadow-md shadow-blue-950/50 hover:border-blue-400 animate-pulse'
                          : 'border border-slate-700 bg-slate-900 hover:border-slate-500'
                      }`}
                      style={{ width: '92px', height: '136px' }}
                      title={`Sayfa ${t.pageNum || (idx + 1)} - ${isSuccess ? 'Optik Başarıyla Okundu' : isError ? 'Optik Tanınamadı (Hatalı)' : 'İncelemek veya okumak için tıklayın'}`}
                    >
                      {/* Üst Sayfa Numarası Rozeti (Sol) */}
                      <div className="absolute top-1 left-1 z-10 bg-slate-950/85 backdrop-blur-xs text-[9.5px] font-bold text-white px-1.5 py-0.2 rounded shadow border border-white/10">
                        #{idx + 1}
                      </div>

                      {/* Optik Tanınma Durum Göstergesi (Sağ Üst - Yeşil / Kırmızı / Mavi / Gri) */}
                      {isSuccess ? (
                        <div className="absolute top-1 right-1 z-10 flex items-center gap-1 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-md border border-emerald-400/50 animate-in fade-in duration-200">
                          <CheckCircle2 className="w-2.5 h-2.5 text-white shrink-0" />
                          <span>Başarılı</span>
                        </div>
                      ) : isError ? (
                        <div className="absolute top-1 right-1 z-10 flex items-center gap-1 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-md border border-rose-400/50 animate-in fade-in duration-200">
                          <XCircle className="w-2.5 h-2.5 text-white shrink-0" />
                          <span>Hatalı</span>
                        </div>
                      ) : isProcessingItem ? (
                        <div className="absolute top-1 right-1 z-10 flex items-center gap-1 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-md border border-blue-400/50 animate-pulse">
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-white shrink-0" />
                          <span>Okunuyor</span>
                        </div>
                      ) : (
                        <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 bg-slate-800/90 text-slate-300 text-[8.5px] font-semibold px-1.5 py-0.5 rounded shadow border border-slate-700">
                          <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          <span>Bekliyor</span>
                        </div>
                      )}

                      {/* Sıra Değiştirme Butonları (Hover üzerinde çıkar) */}
                      <div className="absolute top-7 right-1 z-20 flex items-center gap-0.5 bg-slate-950/95 backdrop-blur-xs rounded p-0.5 shadow-md border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={(e) => moveThumbnailPage(idx, 'left', e)}
                            className="p-0.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                            title="Sola / Öne Taşı"
                          >
                            <ChevronLeft className="w-2.5 h-2.5" />
                          </button>
                        )}
                        {idx < pageThumbnails.length - 1 && (
                          <button
                            type="button"
                            onClick={(e) => moveThumbnailPage(idx, 'right', e)}
                            className="p-0.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                            title="Sağa / Arkaya Taşı"
                          >
                            <ChevronRight className="w-2.5 h-2.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => removeThumbnailPage(idx, e)}
                          className="p-0.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded cursor-pointer"
                          title="Bu Sayfayı Kaldır"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* Küçük Resim Görseli */}
                      <div className="flex-1 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                        <img
                          src={t.thumbUrl}
                          alt={`Sayfa ${idx + 1}`}
                          className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none"
                          loading="lazy"
                        />
                      </div>

                      {/* Alt Durum Çubuğu (Geniş Renkli Şerit) */}
                      {isSuccess ? (
                        <div className="w-full bg-emerald-600 text-white border-t border-emerald-500/50 px-1 py-1 text-center truncate">
                          <span className="text-[9px] font-black flex items-center justify-center gap-1 truncate">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-100 shrink-0" />
                            <span className="truncate">{t.studentName || `${t.booklet || 'A'} Kit.`} {t.net !== undefined ? `(${t.net.toFixed(1)}N)` : ''}</span>
                          </span>
                        </div>
                      ) : isError ? (
                        <div className="w-full bg-rose-600 text-white border-t border-rose-500/50 px-1 py-1 text-center truncate">
                          <span className="text-[9px] font-black flex items-center justify-center gap-1 truncate">
                            <XCircle className="w-2.5 h-2.5 text-rose-100 shrink-0" />
                            <span className="truncate">Optik Hata</span>
                          </span>
                        </div>
                      ) : isProcessingItem ? (
                        <div className="w-full bg-blue-600 text-white border-t border-blue-500/50 px-1 py-1 text-center truncate">
                          <span className="text-[9px] font-black flex items-center justify-center gap-1 animate-pulse truncate">
                            <Loader2 className="w-2.5 h-2.5 animate-spin text-white shrink-0" />
                            <span className="truncate">İşleniyor...</span>
                          </span>
                        </div>
                      ) : (
                        <div className="w-full bg-slate-950/90 text-slate-400 border-t border-slate-800/80 px-1 py-1 text-center truncate">
                          <span className="text-[9px] text-slate-400 truncate flex items-center justify-center gap-0.5">
                            <Clock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                            <span className="truncate">Beklemede</span>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FULLSCREEN CAMERA OVERLAY */}
      {isCameraActive && (
        <div className="fixed inset-0 z-[150] bg-black flex flex-col overflow-hidden select-none">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* TOP HUD */}
          <div className="fixed top-0 left-0 right-0 z-50 p-2.5 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between gap-2 pointer-events-none">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/85 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-full shadow-2xl pointer-events-auto">
              <span className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full transition-all shrink-0 ${
                lockLevel >= 8
                  ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] animate-ping'
                  : lockLevel >= 3
                  ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse'
                  : 'bg-red-400'
              }`} />
              <span className="text-[11px] sm:text-xs font-bold text-slate-100 whitespace-nowrap">
                {lockLevel >= 8 ? 'Hedef Kilitlendi ⚡' : lockLevel >= 3 ? 'Odaklanıyor... ⏳' : 'Hizalanıyor...'}
              </span>
              {detectedQrCode && (
                <span className="bg-blue-500/30 text-blue-300 border border-blue-400/40 text-[9px] px-1.5 py-0.5 rounded-full font-black">
                  MEBİ
                </span>
              )}
            </div>

            <div className="hidden md:flex items-center bg-slate-950/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-xs text-slate-200 font-medium shadow-lg pointer-events-auto">
              Siyah 4 köşe karesini vizörün köşelerine oturtun
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
              <div className="flex items-center gap-1 sm:gap-1.5 bg-emerald-950/85 border border-emerald-500/40 text-emerald-300 text-[11px] sm:text-xs px-2.5 sm:px-3 py-1.5 rounded-full font-bold backdrop-blur-md shadow-lg">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{(exam.results || []).length} Form</span>
              </div>

              {torchAvailable && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleTorch(); }}
                  className={`p-2 sm:p-2.5 rounded-full backdrop-blur-md border transition-all cursor-pointer ${
                    isTorchOn
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.7)]'
                      : 'bg-slate-900/80 text-white border-white/15 hover:bg-slate-800'
                  }`}
                  title="Flaş / Işık"
                >
                  <Zap className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); switchCamera(); }}
                className="p-2 sm:p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-white/15 backdrop-blur-md transition-colors shadow-lg cursor-pointer"
                title="Kamera Değiştir"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); stopCamera(); }}
                className="p-2 sm:p-2.5 rounded-full bg-red-600/80 hover:bg-red-600 text-white border border-red-400/30 backdrop-blur-md transition-colors shadow-lg cursor-pointer"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* AR GUIDE VİZÖR */}
          {!imageLoaded && (
            <div className="relative w-full h-full flex justify-center items-center pointer-events-none">
              <div
                ref={arGuideRef}
                className={`relative z-10 transition-all duration-300 rounded-lg ${
                  lockLevel >= 8
                    ? 'border-[3px] border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.6)]'
                    : lockLevel >= 3
                    ? 'border-[2.5px] border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                    : 'border-[2px] border-white/40'
                }`}
                style={{
                  width: '94vw',
                  maxWidth: 'calc(80vh * (210 / 297))',
                  aspectRatio: '210 / 297',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.82)'
                }}
              >
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#34d399] animate-scanlaser pointer-events-none" />

                {anchorTargets.map((pos, i) => (
                  <div
                    key={i}
                    className={`absolute border-[2.5px] rounded-lg flex items-center justify-center transition-all ${
                      lockLevel >= 8
                        ? 'border-emerald-400 bg-emerald-400/20 scale-105'
                        : lockLevel >= 3
                        ? 'border-amber-400 bg-amber-400/15'
                        : 'border-red-500/70 bg-red-500/10'
                    }`}
                    style={{
                      left: pos.left,
                      top: pos.top,
                      width: '16%',
                      height: '11%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <div className={`w-[2px] h-3.5 ${lockLevel >= 8 ? 'bg-emerald-400' : lockLevel >= 3 ? 'bg-amber-400' : 'bg-red-500/60'} absolute`} />
                    <div className={`h-[2px] w-3.5 ${lockLevel >= 8 ? 'bg-emerald-400' : lockLevel >= 3 ? 'bg-amber-400' : 'bg-red-500/60'} absolute`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Captured Canvas Preview */}
          {imageLoaded && (
            <div className="absolute z-20 w-full h-full flex justify-center items-center pointer-events-none bg-black/75">
              <div
                className="relative border-2 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.5)] rounded-lg overflow-hidden"
                style={{ width: '94vw', maxWidth: 'calc(80vh * (210 / 297))', aspectRatio: '210 / 297' }}
              >
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-contain shadow-2xl" />
                <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 w-full h-full object-contain" />
              </div>
            </div>
          )}

          {/* BOTTOM CONTROLS & MANUAL SHUTTER */}
          <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 z-50 flex flex-col items-center gap-2 pointer-events-none">
            <div className="flex items-center gap-4 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isProcessing) captureImage();
                }}
                disabled={isProcessing}
                className="group relative flex items-center justify-center w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 border-white/90 bg-white/20 active:scale-95 transition-transform backdrop-blur-md shadow-2xl cursor-pointer"
                title="Fotoğraf Çek ve Oku"
              >
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-emerald-500 group-hover:bg-emerald-400 group-active:scale-90 transition-all shadow-inner" />
              </button>
            </div>

            <p className="text-[10px] sm:text-[11px] text-white/90 font-medium bg-black/70 px-3.5 py-1 rounded-full backdrop-blur-md shadow pointer-events-auto">
              {status ? status : "Sabit tuttuğunuzda otomatik çeker veya butona dokunun"}
            </p>
          </div>

          {/* Process Success Message Floating Toast */}
          {status && isProcessing && (
            <div className="fixed bottom-24 left-0 right-0 flex justify-center z-50 pointer-events-none px-4">
              <div className="bg-emerald-600 text-white px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-2xl border-2 border-white flex items-center gap-2 animate-bounce">
                <span>⚡</span>
                <span>{status}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toplu Optik Form Tarama ve Okuma Modalı */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl text-white overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    Toplu Optik Tarama Motoru
                    {isBatchRunning ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse font-medium">
                        İşleniyor
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                        Tamamlandı
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 truncate max-w-md">
                    {exam.name} • {batchProgress.total} Sayfalık Toplu İşlem
                  </p>
                </div>
              </div>

              {!isBatchRunning && (
                <button
                  onClick={() => setBatchModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Progress & Stat Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-300 flex items-center gap-2">
                  {isBatchRunning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                      <span>
                        {batchProgress.stage === 'extracting'
                          ? `1. Aşama: PDF Sayfaları Ayrıştırılıyor (${batchProgress.current} / ${batchProgress.total})`
                          : `2. Aşama: QR ve Optik Veriler Okunuyor (${batchProgress.current} / ${batchProgress.total})`}
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{batchProgress.statusText || `Tüm sayfalar işlendi (${batchProgress.total} Sayfa)`}</span>
                    </>
                  )}
                </span>
                <span className="text-blue-400 font-bold font-mono">
                  %{Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100)}
                </span>
              </div>

              {/* Glowing Progress Track */}
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700/60 p-0.5">
                <div
                  className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100)}%` }}
                />
              </div>

              {batchProgress.statusText && isBatchRunning && (
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span className="truncate">{batchProgress.statusText}</span>
                  <span className="shrink-0 text-slate-500 text-[10px] ml-2">pdfjsLib & Optik Motor</span>
                </div>
              )}

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-slate-400">Toplam Sayfa</div>
                  <div className="text-sm font-bold text-white">{batchProgress.total}</div>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-emerald-400">Başarılı Okunan</div>
                  <div className="text-sm font-bold text-emerald-300">
                    {batchItems.filter(b => b.status === 'success').length}
                  </div>
                </div>
                <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-amber-400">Uyarı / Boş</div>
                  <div className="text-sm font-bold text-amber-300">
                    {batchItems.filter(b => b.status === 'warning' || b.status === 'error').length}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Form List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[220px] max-h-[350px]">
              {batchItems.map((item) => (
                <div
                  key={item.pageIndex}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 transition-all ${
                    item.status === 'success'
                      ? 'bg-emerald-950/20 border-emerald-600/30 text-emerald-200'
                      : item.status === 'processing'
                      ? 'bg-blue-950/30 border-blue-500/50 text-blue-200 shadow-md ring-1 ring-blue-500/30'
                      : item.status === 'warning'
                      ? 'bg-amber-950/20 border-amber-600/30 text-amber-200'
                      : item.status === 'error'
                      ? 'bg-red-950/20 border-red-600/30 text-red-200'
                      : 'bg-slate-950/30 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 font-bold flex items-center justify-center shrink-0 text-[10px] text-slate-300">
                      {item.pageIndex}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {item.studentName ? (
                          <span className="text-white font-bold">{item.studentName} {item.studentNo ? `(${item.studentNo})` : ''}</span>
                        ) : (
                          <span>{item.fileName}</span>
                        )}
                      </div>
                      <div className="text-[11px] opacity-80 truncate">
                        {item.message}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {item.booklet && (
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px]">
                        {item.booklet} Kit.
                      </span>
                    )}
                    {item.net !== undefined && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                        {item.net.toFixed(2)} Net
                      </span>
                    )}
                    {item.status === 'processing' && (
                      <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                    )}
                    {item.status === 'success' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    {item.status === 'warning' && (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    {item.status === 'error' && (
                      <X className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
              {isBatchRunning ? (
                <>
                  <span className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    Lütfen pencereyi kapatmayın, optik formlar okunuyor...
                  </span>
                  <button
                    onClick={() => { batchAbortRef.current = true; }}
                    className="px-3 py-1.5 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/20 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Durdur
                  </button>
                </>
              ) : (
                <div className="w-full flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => setBatchModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Kapat
                  </button>
                  {onNavigate && (
                    <button
                      onClick={() => {
                        setBatchModalOpen(false);
                        onNavigate('results');
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <FileCheck className="w-4 h-4" />
                      Sonuçlar ve Analiz Ekranına Git
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ScanView;
