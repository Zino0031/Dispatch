"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import mammoth from "mammoth/mammoth.browser";
import { backendUrl } from "./backend";
import { detectDocument, warpQuad, type DocPoint } from "./scan";

const statuses = ["Uploading", "Queued", "Sent to kiosk", "Printing", "Completed"];
const wizardSteps = ["Mode", "Document", "Options", "Review", "Checkout", "Send"];

const UNIT_PRICE = { bw: 5, color: 20 };
const shortLabels = ["Upload", "Queued", "Sent", "Print", "Done"];

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTS = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];

const presets = [
  { id: "draft", label: "Draft", detail: "B&W · Single", copies: 1, color: "bw", duplex: false },
  { id: "thesis", label: "Thesis", detail: "B&W · Double", copies: 1, color: "bw", duplex: true },
  { id: "slides", label: "Slides", detail: "Color · Single", copies: 1, color: "color", duplex: false },
] as const;

type ScanFilter = "auto" | "bw" | "gray" | "photo";

const FILTERS: Record<ScanFilter, string> = {
  auto: "grayscale(1) contrast(1.4) brightness(1.1)",
  bw: "grayscale(1) contrast(2.4) brightness(1.2)",
  gray: "grayscale(1) contrast(1.15) brightness(1.03)",
  photo: "contrast(1.12) saturate(1.2)",
};

const scanFilters: { id: ScanFilter; label: string }[] = [
  { id: "auto", label: "Enhance" },
  { id: "bw", label: "B&W" },
  { id: "gray", label: "Gray" },
  { id: "photo", label: "Color" },
];

type DocSize = { id: string; label: string; wMm: number; hMm: number };

const DOC_SIZES: DocSize[] = [
  { id: "a4", label: "A4", wMm: 210, hMm: 297 },
  { id: "letter", label: "Letter", wMm: 216, hMm: 279 },
  { id: "a5", label: "A5", wMm: 148, hMm: 210 },
  { id: "photo46", label: '4×6"', wMm: 102, hMm: 152 },
  { id: "card", label: "Card", wMm: 85.6, hMm: 54 },
  { id: "receipt", label: "Receipt", wMm: 80, hMm: 200 },
];

function validateFile(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTS.includes(ext)) return "That file type isn't supported. Use PDF, JPG, PNG or Word.";
  if (file.size > MAX_FILE_BYTES) return "That file is over 50 MB. Compress it or split it first.";
  if (file.size === 0) return "That file looks empty. Pick another one.";
  return "";
}

function formatSize(bytes: number) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  return mb >= 10 ? `${mb.toFixed(1)} MB` : `${mb.toFixed(2)} MB`;
}

function fileKind(file: File | null) {
  if (!file) return "";
  if (file.type === "application/pdf") return "PDF";
  if (file.type.startsWith("image/")) return "IMAGE";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "doc" || ext === "docx") return "DOCX";
  return ext?.toUpperCase() ?? "FILE";
}

export default function Home() {
  const [stage, setStage] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [stageHint, setStageHint] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [copies, setCopies] = useState(1);
  const [color, setColor] = useState<"bw" | "color">("bw");
  const [duplex, setDuplex] = useState(false);
  const [kiosk, setKiosk] = useState("");
  const [status, setStatus] = useState("Select a document to begin");
  const [step, setStep] = useState(-1);
  const [kiosks, setKiosks] = useState<{ kioskId: string; displayName: string }[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [docxPreview, setDocxPreview] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewApproved, setPreviewApproved] = useState(false);
  const [mode, setMode] = useState<"print" | "copy" | null>(null);
  const [captureUrl, setCaptureUrl] = useState("");
  const [scanFilter, setScanFilter] = useState<ScanFilter>("auto");
  const [rotation, setRotation] = useState(0);
  const [pages, setPages] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanImgRef = useRef<HTMLImageElement | null>(null);
  const [autoCrop, setAutoCrop] = useState(true);
  const [cropNote, setCropNote] = useState("");
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [paperFit, setPaperFit] = useState<"fill" | "fit" | "original">("fit");
  const [docSizeId, setDocSizeId] = useState("auto");
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");
  const [customUnit, setCustomUnit] = useState("mm");
  const [paid, setPaid] = useState(false);
  const [payState, setPayState] = useState<"idle" | "processing" | "done">("idle");
  const [baseSize, setBaseSize] = useState({ w: 3, h: 4 });
  const [adjusting, setAdjusting] = useState(false);
  const [quad, setQuad] = useState<DocPoint[] | null>(null);
  const [rotSize, setRotSize] = useState({ w: 3, h: 4 });
  const rotatedRef = useRef<HTMLCanvasElement | null>(null);
  const filterRef = useRef<HTMLCanvasElement | null>(null);
  const dragIdx = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      setDocxPreview("");
      setPreviewApproved(false);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setDocxPreview("");
    setPreviewApproved(false);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "doc" || extension === "docx") {
      setPreviewLoading(true);
      void file
        .arrayBuffer()
        .then((buffer) => mammoth.convertToHtml({ arrayBuffer: buffer }))
        .then((result) => setDocxPreview(result.value))
        .catch(() => setDocxPreview("<p>Could not preview this Word document in the browser.</p>"))
        .finally(() => setPreviewLoading(false));
    }
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const url = backendUrl();
    fetch(`${url}/api/kiosks`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { kiosks?: { kioskId: string; displayName: string }[] }) => {
        const online = data.kiosks ?? [];
        setKiosks(online);
        if (online[0]) setKiosk(online[0].kioskId);
      })
      .catch(() => setKiosks([]));
  }, []);

  useEffect(() => {
    if (!captureUrl) {
      scanImgRef.current = null;
      baseCanvasRef.current = null;
      rotatedRef.current = null;
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      scanImgRef.current = img;
      if (!refreshBase()) return;
      if (cancelled) return;
      drawComposed();
    };
    img.src = captureUrl;
    return () => {
      cancelled = true;
    };
  }, [captureUrl]);

  useEffect(() => {
    if (captureUrl && scanImgRef.current && !adjusting) {
      if (refreshBase()) drawComposed();
    }
  }, [rotation, autoCrop]);

  useEffect(() => {
    if (!captureUrl) return;
    if (adjusting) drawAdjust();
    else if (baseCanvasRef.current) drawComposed();
  }, [adjusting]);

  useEffect(() => {
    if (captureUrl && !adjusting && baseCanvasRef.current) drawComposed();
  }, [scanFilter, paperFit]);

  useEffect(() => {
    if (captureUrl && adjusting) drawAdjust();
  });

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(5, next));
    setStage(clamped);
    setMaxReached((prev) => Math.max(prev, clamped));
    setStageHint("");
    setError("");
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function canLeave(current: number): string {
    if (current === 0 && !mode) return "Choose Print or Copy to continue.";
    if (current === 1 && !file)
      return mode === "copy" ? "Photograph your document to continue." : "Upload a document to continue.";
    if (current === 2 && !kiosk) return "Select a pickup kiosk to continue.";
    if (current === 3 && !previewApproved) return "Approve the preview to continue.";
    if (current === 4 && !paid) return "Complete the test payment to continue.";
    return "";
  }

  function next() {
    const block = canLeave(stage);
    if (block) {
      setStageHint(block);
      return;
    }
    goTo(stage + 1);
  }

  function back() {
    goTo(stage - 1);
  }

  async function submitPrintJob() {
    if (!file || sending || !previewApproved) return;
    const url = backendUrl();
    setSending(true);
    setError("");
    setStep(0);
    setStatus("Uploading document");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResponse = await fetch(`${url}/api/upload`, {
        method: "POST",
        body: formData,
      });
      const uploaded = (await uploadResponse.json()) as { fileUrl?: string; error?: string };
      if (!uploadResponse.ok || !uploaded.fileUrl) throw new Error(uploaded.error ?? "Upload failed");

      setStep(1);
      setStatus("Sending to kiosk");
      const jobResponse = await fetch(`${url}/api/print-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        kioskId: kiosk,
        fileUrl: uploaded.fileUrl,
        copies,
        color,
        duplex,
        ...(pages ? { pages } : {}),
      }),
      });
      const job = (await jobResponse.json()) as { printJobId?: string; accessToken?: string; error?: string };
      if (!jobResponse.ok || !job.printJobId || !job.accessToken) throw new Error(job.error ?? "Could not create print job");

      setStep(2);
      setStatus("Sent to kiosk");
      const socket: Socket = io(url, {
        auth: { role: "user", printJobId: job.printJobId },
        transports: ["websocket"],
      });
      let complete = false;
      socket.on("JOB_STATUS", (event: { event: string; message?: string }) => {
        const statusMap: Record<string, { label: string; step: number }> = {
          SENT_TO_KIOSK: { label: "Sent to kiosk", step: 2 },
          DOWNLOAD_START: { label: "Kiosk downloading document", step: 2 },
          DOWNLOAD_COMPLETE: { label: "Document downloaded", step: 2 },
          PRINTING_STARTED: { label: "Printing document", step: 3 },
          PRINT_SUCCESS: { label: "Print complete", step: 4 },
          ERROR: { label: event.message ?? "Print failed", step: 2 },
          PRINTER_ERROR: { label: event.message ?? "Printer error", step: 3 },
        };
        const next = statusMap[event.event];
        if (next) {
          setStatus(next.label);
          setStep(next.step);
        }
        if (["PRINT_SUCCESS", "ERROR", "PRINTER_ERROR"].includes(event.event)) {
          complete = true;
          socket.close();
          setSending(false);
        }
      });
      socket.on("connect_error", () => {
        setError("Could not reach the live-status channel. The job was sent — check Operations, or tap Send to retry.");
        setSending(false);
      });
      socket.on("disconnect", (reason) => {
        if (!complete && reason !== "io client disconnect") {
          setError("Live connection lost. If the print does not progress, tap Send to retry.");
          setSending(false);
        }
      });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Print request failed");
      setStatus("Print request failed");
      setSending(false);
    }
  }

  function startOver() {
    if (captureUrl) URL.revokeObjectURL(captureUrl);
    setCaptureUrl("");
    scanImgRef.current = null;
    baseCanvasRef.current = null;
    setCropNote("");
    setQuad(null);
    setAdjusting(false);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMode(null);
    setStep(-1);
    setStatus("Select a document to begin");
    setError("");
    setStageHint("");
    setMaxReached(0);
    setPaid(false);
    setPayState("idle");
    goTo(0);
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function pickFile(next: File | null) {
    if (!next) {
      clearFile();
      return;
    }
    const problem = validateFile(next);
    if (problem) {
      setStageHint(problem);
      return;
    }
    setFile(next);
    setStageHint("");
  }

  function changeMode(next: "print" | "copy" | null) {
    if (captureUrl) URL.revokeObjectURL(captureUrl);
    setCaptureUrl("");
    scanImgRef.current = null;
    baseCanvasRef.current = null;
    setCropNote("");
    setQuad(null);
    setAdjusting(false);
    clearFile();
    setMode(next);
    setStageHint("");
    goTo(next ? 1 : 0);
  }

  function handleCapture(next: File | null) {
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      setStageHint("Please use a photo — image files only.");
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setStageHint("That photo is over 50 MB. Lower your camera resolution and retry.");
      return;
    }
    if (captureUrl) URL.revokeObjectURL(captureUrl);
    setCaptureUrl(URL.createObjectURL(next));
    setRotation(0);
    setScanFilter("auto");
    setAdjusting(false);
    setStageHint("");
  }

  function retakePhoto() {
    if (captureUrl) URL.revokeObjectURL(captureUrl);
    setCaptureUrl("");
    scanImgRef.current = null;
    baseCanvasRef.current = null;
    setCropNote("");
    setQuad(null);
    setAdjusting(false);
  }

  function getRotated(): HTMLCanvasElement | null {
    const img = scanImgRef.current;
    if (!img || !img.naturalWidth) return null;
    const swap = rotation === 90 || rotation === 270;
    const scale = Math.min(1, 3500 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const tmp = document.createElement("canvas");
    tmp.width = swap ? h : w;
    tmp.height = swap ? w : h;
    const tctx = tmp.getContext("2d");
    if (!tctx) return null;
    tctx.save();
    tctx.translate(tmp.width / 2, tmp.height / 2);
    tctx.rotate((rotation * Math.PI) / 180);
    tctx.drawImage(img, -w / 2, -h / 2, w, h);
    tctx.restore();
    return tmp;
  }

  function fullFrame(c: HTMLCanvasElement): DocPoint[] {
    return [
      { x: 0, y: 0 },
      { x: c.width, y: 0 },
      { x: c.width, y: c.height },
      { x: 0, y: c.height },
    ];
  }

  function refreshBase(): boolean {
    const rotated = getRotated();
    if (!rotated) return false;
    rotatedRef.current = rotated;
    setRotSize({ w: rotated.width, h: rotated.height });
    let q: DocPoint[];
    if (autoCrop) {
      const detected = detectDocument(rotated);
      if (detected) {
        q = detected;
        setCropNote("Document auto-cropped ✓ — tap Adjust to fine-tune.");
      } else {
        q = fullFrame(rotated);
        setCropNote("Couldn't find the page edges — showing the full photo. Tap Adjust to crop by hand.");
      }
    } else {
      q = fullFrame(rotated);
      setCropNote("");
    }
    setQuad(q);
    const warped = warpQuad(rotated, q);
    const finalBase = warped ?? rotated;
    baseCanvasRef.current = finalBase;
    setBaseSize({ w: finalBase.width, h: finalBase.height });
    return true;
  }

  function drawComposed() {
    const canvas = canvasRef.current;
    const base = baseCanvasRef.current;
    if (!canvas || !base) return;
    let filtered = filterRef.current;
    if (!filtered) {
      filtered = document.createElement("canvas");
      filterRef.current = filtered;
    }
    filtered.width = base.width;
    filtered.height = base.height;
    const fctx = filtered.getContext("2d");
    if (!fctx) return;
    fctx.filter = FILTERS[scanFilter];
    fctx.drawImage(base, 0, 0);
    const L = computeLayout(base.width, base.height);
    canvas.width = L.W;
    canvas.height = L.H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.filter = "none";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, L.W, L.H);
    ctx.drawImage(filtered, L.sx, L.sy, L.sw, L.sh, L.dx, L.dy, L.dw, L.dh);
  }

  function drawAdjust() {
    const canvas = canvasRef.current;
    const r = rotatedRef.current;
    if (!canvas || !r) return;
    canvas.width = r.width;
    canvas.height = r.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.filter = "none";
    ctx.drawImage(r, 0, 0);
    const q = quad ?? fullFrame(r);
    const lw = Math.max(2, Math.round(canvas.width / 300));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = "rgba(10,10,10,.55)";
    ctx.fill("evenodd");
    ctx.restore();
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = lw;
    ctx.setLineDash([lw * 4, lw * 3]);
    ctx.beginPath();
    q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderDisplay() {
    if (adjusting) drawAdjust();
    else drawComposed();
  }

  function startAdjust() {
    const r = rotatedRef.current;
    if (!r) return;
    if (!quad) setQuad(fullFrame(r));
    setAdjusting(true);
  }

  function commitAdjust() {
    const r = rotatedRef.current;
    if (r && quad) {
      const warped = warpQuad(r, quad);
      if (warped) {
        baseCanvasRef.current = warped;
        setBaseSize({ w: warped.width, h: warped.height });
      }
    }
    dragIdx.current = null;
    setAdjusting(false);
    drawComposed();
  }

  function cancelAdjust() {
    dragIdx.current = null;
    setAdjusting(false);
    if (refreshBase()) drawComposed();
  }

  function onHandleDown(event: React.PointerEvent, index: number) {
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    dragIdx.current = index;
  }

  function onHandleMove(event: React.PointerEvent) {
    if (dragIdx.current === null || dragIdx.current === undefined) return;
    const r = rotatedRef.current;
    if (!r) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.min(r.width, Math.max(0, ((event.clientX - rect.left) / rect.width) * r.width));
    const y = Math.min(r.height, Math.max(0, ((event.clientY - rect.top) / rect.height) * r.height));
    const idx = dragIdx.current;
    setQuad((q) => (q ? q.map((p, i) => (i === idx ? { x, y } : p)) : q));
  }

  function onHandleUp() {
    dragIdx.current = null;
  }

  function acceptScan() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        setStageHint("Could not process that photo. Please retake it.");
        return;
      }
      const scanned = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
      if (scanned.size > MAX_FILE_BYTES) {
        setStageHint("Processed image is too large. Please retake it.");
        return;
      }
      if (captureUrl) URL.revokeObjectURL(captureUrl);
      setCaptureUrl("");
      scanImgRef.current = null;
      baseCanvasRef.current = null;
      setCropNote("");
      setFile(scanned);
      setStageHint("");
      goTo(2);
    }, "image/jpeg", 0.92);
  }

  function applyPreset(preset: (typeof presets)[number]) {
    setCopies(preset.copies);
    setColor(preset.color);
    setDuplex(preset.duplex);
    setStageHint("");
  }

  const docMm = useMemo<{ w: number; h: number } | null>(() => {
    if (docSizeId === "auto") return null;
    if (docSizeId === "custom") {
      const w = Number(customW);
      const h = Number(customH);
      if (!w || !h || w <= 0 || h <= 0) return null;
      const f = customUnit === "cm" ? 10 : customUnit === "in" ? 25.4 : 1;
      return { w: w * f, h: h * f };
    }
    const preset = DOC_SIZES.find((d) => d.id === docSizeId);
    return preset ? { w: preset.wMm, h: preset.hMm } : null;
  }, [docSizeId, customW, customH, customUnit]);

  function computeLayout(bw: number, bh: number) {
    const doc = docMm;
    const landscape = doc ? doc.w > doc.h : bw > bh;
    const W = landscape ? 2480 : 1754;
    const H = landscape ? 1754 : 2480;
    if (paperFit === "fill") {
      const targetAspect = W / H;
      const srcAspect = bw / bh;
      let sw = bw;
      let sh = bh;
      if (srcAspect > targetAspect) sw = bh * targetAspect;
      else sh = bw / targetAspect;
      return { W, H, sx: (bw - sw) / 2, sy: (bh - sh) / 2, sw, sh, dx: 0, dy: 0, dw: W, dh: H, scaled: false, dpi: 0 };
    }
    if (paperFit === "fit" || !doc) {
      const s = Math.min(W / bw, H / bh);
      const dw = bw * s;
      const dh = bh * s;
      return {
        W, H, sx: 0, sy: 0, sw: bw, sh: bh,
        dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh,
        scaled: s < 1, dpi: 0,
      };
    }
    const pxPerMm = W / (landscape ? 297 : 210);
    let dw = doc.w * pxPerMm;
    let dh = doc.h * pxPerMm;
    let scaled = false;
    if (dw > W || dh > H) {
      const s = Math.min(W / dw, H / dh);
      dw *= s;
      dh *= s;
      scaled = true;
    }
    const dpiAvg = Math.round((bw / (doc.w / 25.4) + bh / (doc.h / 25.4)) / 2);
    return {
      W, H, sx: 0, sy: 0, sw: bw, sh: bh,
      dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh,
      scaled, dpi: dpiAvg,
    };
  }

  const printLayout = useMemo(
    () => computeLayout(baseSize.w, baseSize.h),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseSize, docMm, paperFit],
  );

  const activePresetId =
    presets.find((preset) => preset.copies === copies && preset.color === color && preset.duplex === duplex)?.id ??
    "";

  function tapTest() {
    if (payState === "processing" || paid) return;
    setPayState("processing");
    window.setTimeout(() => {
      setPayState("done");
      setPaid(true);
      setStageHint("");
      goTo(5);
    }, 1200);
  }

  const total = copies * (color === "color" ? UNIT_PRICE.color : UNIT_PRICE.bw);

  const selectedKiosk = kiosks.find((item) => item.kioskId === kiosk)?.displayName ?? "";
  const progress = step < 0 ? ((stage + 1) / 6) * 100 : Math.min(100, ((step + 1) / statuses.length) * 100);
  const jobActive = sending || step >= 0;
  const canSubmit = Boolean(file) && previewApproved && !sending && Boolean(kiosk);
  const done = step >= 4;

  return (
    <main className={`shell home${stage > 0 ? " compact" : ""}`}>
      <header className="topbar">
        {stage > 0 ? (
          <button type="button" className="nav-back" onClick={back} disabled={sending} aria-label="Go back">
            ‹
          </button>
        ) : (
          <span className="mark" aria-hidden>
            <span>PK</span>
          </span>
        )}
        <strong className="app-title">Campus Print</strong>
        <span className="kiosk-pill" title={kiosks.length ? `${kiosks.length} kiosk(s) online` : "No kiosks online"}>
          <span className={`fleet-dot ${kiosks.length ? "online" : "offline"}`} />
          {kiosks.length ? `${kiosks.length} online` : "Offline"}
        </span>
        <a className="ops-link" href="/admin" aria-label="Operations console">
          ⚙
        </a>
      </header>

      <section className="tracker" aria-label="Progress">
        <div className="segbar" role="group" aria-label="Steps">
          {wizardSteps.map((label, index) => {
            const state = index < stage ? "done" : index === stage ? "current" : "";
            const reachable = index <= maxReached || index === 0;
            return (
              <button
                key={label}
                type="button"
                className={`seg-part ${state}`}
                disabled={!reachable || sending}
                onClick={() => goTo(index)}
                aria-current={index === stage ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${label}`}
              >
                <span className="seg-fill" />
              </button>
            );
          })}
        </div>
        <div className="step-label">
          <span>
            Step {stage + 1} of 6
          </span>
          <strong>{wizardSteps[stage]}</strong>
        </div>
        <div className="live-strip" aria-live="polite">
          <div className="live-row">
            <div className="live-text">
              <span className="summary-kicker">{status}</span>
              <strong title={file?.name ?? ""}>{file ? file.name : "No document yet"}</strong>
            </div>
            {(sending || step >= 0) && (
              <span className="live-badge">
                <span className="online-dot pulse" />
                Live
              </span>
            )}
          </div>
          {jobActive && (
            <>
              <div className="progress" aria-hidden>
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <ol className="mini-timeline" aria-label="Print job status">
            {statuses.map((item, index) => (
              <li className={index <= step ? "active" : ""} key={item} title={item}>
                <span className="mini-dot">{index <= step ? "✓" : index + 1}</span>
                <span className="mini-label">{shortLabels[index]}</span>
              </li>
              ))}
              </ol>
            </>
          )}
          <p className="live-meta">
            {selectedKiosk || "No kiosk"} · {copies} {copies === 1 ? "copy" : "copies"} ·{" "}
            {color === "bw" ? "B&W" : "Color"} · {duplex ? "Duplex" : "Simplex"}
            {file && fileKind(file) ? ` · ${previewApproved ? "Reviewed ✓" : "Unreviewed"}` : ""}
          </p>
        </div>
      </section>

      <section className="workspace">
        <div className="panel upload-panel" ref={cardRef}>
          <div key={stage} className="stage-enter">
          {stage === 0 && (
            <section aria-label="Step 1 — Choose mode">
              <div className="panel-heading">
                <div>
                  <span className="step-number">01 / 06</span>
                  <h2>What do you need?</h2>
                </div>
              </div>

              <div className="mode-row" role="radiogroup" aria-label="What do you want to do?">
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "print"}
                  className={`mode-card ${mode === "print" ? "active" : ""}`}
                  onClick={() => changeMode("print")}
                >
                  <span className="mode-icon" aria-hidden>
                    🖨
                  </span>
                  <b>Print</b>
                  <small>A file from this device</small>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "copy"}
                  className={`mode-card ${mode === "copy" ? "active" : ""}`}
                  onClick={() => changeMode("copy")}
                >
                  <span className="mode-icon" aria-hidden>
                    📷
                  </span>
                  <b>Copy</b>
                  <small>Photo via camera</small>
                </button>
              </div>
              <p className="format-disclaimer">
                Tapping a choice takes you straight to the next step. Print sends a file from this device; Copy
                photographs a paper page and cleans it up like a scanner.
              </p>
            </section>
          )}

          {stage === 1 && (
            <section aria-label="Step 2 — Provide document">
              <div className="panel-heading">
                <div>
                  <span className="step-number">02 / 06</span>
                  <h2>{mode === "copy" ? "Copy a document" : "Upload your file"}</h2>
                </div>
                <span className="format-note">PDF · JPG · PNG · DOCX*</span>
              </div>

              <button type="button" className="link-btn" onClick={() => changeMode(null)}>
                ‹ Print or copy?
              </button>
              {mode === "print" && (!file ? (
                <label
                  className={`dropzone ${dragging ? "dragging" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    pickFile(event.dataTransfer.files?.[0] ?? null);
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
                  />
                  <span className="upload-icon" aria-hidden>
                    ↑
                  </span>
                  <strong>{dragging ? "Release to upload" : "Drag & drop your file"}</strong>
                  <span>or browse from this device · max 50 MB</span>
                  <span className="format-chips" aria-hidden>
                    <i>PDF</i>
                    <i>JPG</i>
                    <i>PNG</i>
                    <i>DOCX</i>
                  </span>
                  <span className="drop-cta">Select file</span>
                </label>
                  ) : (
                    <div className="file-chip">
                      <span className="file-kind">{fileKind(file)}</span>
                      <div className="file-meta">
                        <strong title={file.name}>{file.name}</strong>
                        <small>{formatSize(file.size)} · looks good, continue →</small>
                      </div>
                      <button type="button" className="file-remove" onClick={clearFile} aria-label="Remove file">
                        ✕
                      </button>
                    </div>
                  ))}
                  {mode === "copy" &&
                    (!captureUrl ? (
                      <div className="capture-box">
                        <span className="upload-icon" aria-hidden>
                          📷
                        </span>
                        <strong>Photograph your document</strong>
                        <span>Lay it flat in good light · under 50 MB</span>
                        <label className="capture-btn primary">
                          Take photo
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(event) => handleCapture(event.target.files?.[0] ?? null)}
                          />
                        </label>
                        <label className="capture-btn">
                          Choose from gallery
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => handleCapture(event.target.files?.[0] ?? null)}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="scan-editor">
                        {adjusting ? (
                          <>
                            <div className="crop-row">
                              <span className="opt-label">Drag each corner onto the page edge</span>
                            </div>
                            <div
                              className="scan-wrap"
                              onPointerMove={onHandleMove}
                              onPointerUp={onHandleUp}
                              onPointerCancel={onHandleUp}
                            >
                              <canvas
                                ref={canvasRef}
                                className="scan-canvas"
                                style={{ aspectRatio: `${rotSize.w} / ${rotSize.h}` }}
                              />
                              {(quad ?? []).map((p, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  className="crop-handle"
                                  style={{
                                    left: `${(p.x / rotSize.w) * 100}%`,
                                    top: `${(p.y / rotSize.h) * 100}%`,
                                  }}
                                  onPointerDown={(event) => onHandleDown(event, i)}
                                  aria-label={`Move corner ${i + 1}`}
                                />
                              ))}
                            </div>
                            <div className="scan-actions adjust-actions">
                              <button type="button" className="btn-ghost" onClick={cancelAdjust}>
                                Cancel
                              </button>
                              <button type="button" className="btn-primary" onClick={commitAdjust}>
                                Done
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="crop-row">
                              <span className="opt-label">Document edges</span>
                              <button
                                type="button"
                                className={`crop-toggle ${autoCrop ? "active" : ""}`}
                                onClick={() => setAutoCrop((value) => !value)}
                                aria-pressed={autoCrop}
                              >
                                ✂ Auto-crop {autoCrop ? "on" : "off"}
                              </button>
                            </div>
                            {cropNote && <p className="crop-note">{cropNote}</p>}
                            <canvas ref={canvasRef} className="scan-canvas" />
                            <div className="scan-filters" role="radiogroup" aria-label="Scan filter">
                              {scanFilters.map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={scanFilter === option.id}
                                  className={`filter-chip ${scanFilter === option.id ? "active" : ""}`}
                                  onClick={() => setScanFilter(option.id)}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                            <div className="paper-row">
                              <span className="opt-label">Paper fit · A4</span>
                              <div className="paper-chips" role="radiogroup" aria-label="Fit on A4 paper">
                                {(["fill", "fit", "original"] as const).map((f) => (
                                  <button
                                    key={f}
                                    type="button"
                                    role="radio"
                                    aria-checked={paperFit === f}
                                    className={`filter-chip ${paperFit === f ? "active" : ""}`}
                                    onClick={() => setPaperFit(f)}
                                  >
                                    {f === "fill" ? "Fill page" : f === "fit" ? "Fit page" : "True size"}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {paperFit === "original" && (
                              <div className="size-row">
                                <span className="opt-label">Original size · how big is the real page?</span>
                                <div className="size-chips" role="radiogroup" aria-label="Original document size">
                                  <button
                                    type="button"
                                    role="radio"
                                    aria-checked={docSizeId === "auto"}
                                    className={`filter-chip ${docSizeId === "auto" ? "active" : ""}`}
                                    onClick={() => setDocSizeId("auto")}
                                  >
                                    Unknown
                                  </button>
                                  {DOC_SIZES.map((d) => (
                                    <button
                                      key={d.id}
                                      type="button"
                                      role="radio"
                                      aria-checked={docSizeId === d.id}
                                      className={`filter-chip ${docSizeId === d.id ? "active" : ""}`}
                                      onClick={() => setDocSizeId(d.id)}
                                    >
                                      {d.label}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    role="radio"
                                    aria-checked={docSizeId === "custom"}
                                    className={`filter-chip ${docSizeId === "custom" ? "active" : ""}`}
                                    onClick={() => setDocSizeId("custom")}
                                  >
                                    Custom
                                  </button>
                                </div>
                                {docSizeId === "custom" && (
                                  <div className="size-custom">
                                    <input
                                      inputMode="decimal"
                                      value={customW}
                                      onChange={(event) => setCustomW(event.target.value)}
                                      aria-label="Custom width"
                                      placeholder="Width"
                                    />
                                    <span aria-hidden>×</span>
                                    <input
                                      inputMode="decimal"
                                      value={customH}
                                      onChange={(event) => setCustomH(event.target.value)}
                                      aria-label="Custom height"
                                      placeholder="Height"
                                    />
                                    <select
                                      value={customUnit}
                                      onChange={(event) => setCustomUnit(event.target.value)}
                                      aria-label="Size unit"
                                    >
                                      <option value="mm">mm</option>
                                      <option value="cm">cm</option>
                                      <option value="in">in</option>
                                    </select>
                                  </div>
                                )}
                                <p
                                  className={`sharp-note ${
                                    printLayout.dpi > 0 && printLayout.dpi < 150 ? "warn" : ""
                                  }`}
                                >
                                  {printLayout.dpi > 0
                                    ? `≈ ${printLayout.dpi} dpi · ${
                                        printLayout.dpi >= 200
                                          ? "Sharp print."
                                          : printLayout.dpi >= 150
                                            ? "Looks OK."
                                            : "May look soft — move closer and retake."
                                      }${printLayout.scaled ? " Scaled down to fit A4." : ""}`
                                    : docSizeId === "custom"
                                      ? "Enter width and height to check sharpness."
                                      : "Pick the real page size — photo distance stops mattering, and sharpness gets checked."}
                                </p>
                              </div>
                            )}
                            <div className="scan-actions">
                              <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => setRotation((value) => (value + 270) % 360)}
                                aria-label="Rotate left"
                              >
                                ⟲
                              </button>
                              <button type="button" className="btn-ghost" onClick={startAdjust}>
                                Adjust
                              </button>
                              <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => setRotation((value) => (value + 90) % 360)}
                                aria-label="Rotate right"
                              >
                                ⟳
                              </button>
                            </div>
                            <button type="button" className="submit" onClick={() => void acceptScan()}>
                              Use this scan
                            </button>
                            <div className="retake-wrap">
                              <button type="button" className="link-btn" onClick={retakePhoto}>
                                Retake photo
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}

              <p className="format-disclaimer">
                {mode === "copy"
                  ? "Auto-enhance clears shadows and boosts contrast like a scanner app. Rotate if the photo is sideways."
                  : "Campus printers accept PDF, JPG, PNG and Word. Word preview is approximate — the original is what prints."}
              </p>
            </section>
          )}

          {stage === 2 && (
            <section aria-label="Step 3 — Print options">
              <div className="panel-heading">
                <div>
                  <span className="step-number">03 / 06</span>
                  <h2>How should it print?</h2>
                </div>
                <span className="format-note">
                  {copies} {copies === 1 ? "copy" : "copies"} · {color === "bw" ? "B&W" : "Color"} ·{" "}
                  {duplex ? "Duplex" : "Simplex"}
                </span>
              </div>

              <div className="preset-row" role="group" aria-label="Quick presets">
                <span className="opt-label">Quick presets</span>
                <div className="preset-chips">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-chip ${activePresetId === preset.id ? "active" : ""}`}
                      onClick={() => applyPreset(preset)}
                      aria-pressed={activePresetId === preset.id}
                    >
                      <b>{preset.label}</b>
                      <small>{preset.detail}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="options-grid">
                <div className="opt">
                  <span className="opt-label" id="copies-label">
                    Copies
                  </span>
                  <div className="stepper-input" role="group" aria-labelledby="copies-label">
                    <button
                      type="button"
                      onClick={() => setCopies((value) => Math.max(1, value - 1))}
                      disabled={copies <= 1}
                      aria-label="Fewer copies"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={copies}
                      onChange={(event) => setCopies(Math.min(50, Math.max(1, Number(event.target.value) || 1)))}
                      aria-label="Copies"
                    />
                    <button
                      type="button"
                      onClick={() => setCopies((value) => Math.min(50, value + 1))}
                      disabled={copies >= 50}
                      aria-label="More copies"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="opt">
                  <span className="opt-label">Color</span>
                  <div className="seg" role="radiogroup" aria-label="Color">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={color === "bw"}
                      className={color === "bw" ? "active" : ""}
                      onClick={() => setColor("bw")}
                    >
                      <i className="swatch bw" aria-hidden /> B&W
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={color === "color"}
                      className={color === "color" ? "active" : ""}
                      onClick={() => setColor("color")}
                    >
                      <i className="swatch color" aria-hidden /> Color
                    </button>
                  </div>
                </div>

                <div className="opt">
                  <span className="opt-label">Sides</span>
                  <div className="seg" role="radiogroup" aria-label="Finish">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!duplex}
                      className={!duplex ? "active" : ""}
                      onClick={() => setDuplex(false)}
                    >
                      ▤ Single
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={duplex}
                      className={duplex ? "active" : ""}
                      onClick={() => setDuplex(true)}
                    >
                      ▦ Double
                    </button>
                  </div>
                </div>

                {fileKind(file) === "PDF" && (
                  <div className="opt">
                    <span className="opt-label">Pages</span>
                    <div className="seg" role="radiogroup" aria-label="Pages">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={pages === null}
                        className={pages === null ? "active" : ""}
                        onClick={() => setPages(null)}
                      >
                        All pages
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={pages !== null}
                        className={pages !== null ? "active" : ""}
                        onClick={() => setPages(pages !== null ? pages : "")}
                      >
                        Custom
                      </button>
                    </div>
                    {pages !== null && (
                      <>
                        <input
                          type="text"
                          autoComplete="off"
                          value={pages}
                          onChange={(event) => setPages(event.target.value)}
                          placeholder="e.g. 1-3, 5"
                          aria-label="Page range"
                          style={{
                            width: "100%",
                            border: 0,
                            background: "transparent",
                            color: "var(--ink)",
                            fontWeight: 600,
                            fontSize: 17,
                            outline: "none",
                            paddingLeft: 4,
                          }}
                        />
                        <p
                          className="format-disclaimer"
                          style={{ marginTop: 6, fontSize: 11.5, color: "var(--muted)" }}
                        >
                          Comma-separated pages or ranges, e.g. 1-3, 5
                        </p>
                      </>
                    )}
                  </div>
                )}
                <div className="opt opt-kiosk">
                  <span className="opt-label">Pickup kiosk · {kiosks.length || 0} online</span>
                  {kiosks.length ? (
                    <div className="kiosk-cards" role="radiogroup" aria-label="Pickup kiosk">
                      {kiosks.map((item) => (
                        <button
                          key={item.kioskId}
                          type="button"
                          role="radio"
                          aria-checked={kiosk === item.kioskId}
                          className={`kiosk-card ${kiosk === item.kioskId ? "active" : ""}`}
                          onClick={() => {
                            setKiosk(item.kioskId);
                            setStageHint("");
                          }}
                        >
                          <span className="fleet-dot online" />
                          <span className="kiosk-card-text">
                            <strong>{item.displayName}</strong>
                            <small>{item.kioskId}</small>
                          </span>
                          <span className="kiosk-check">{kiosk === item.kioskId ? "✓" : ""}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="kiosk-empty">No kiosks online right now. Go back — your upload is safe.</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {stage === 3 && (
            <section className="preview-panel wizard-step" aria-label="Step 4 — Review document">
              <div className="preview-heading">
                <div>
                  <span className="step-number">04 / 06</span>
                  <h2>Does it look right?</h2>
                </div>
                <span className="preview-type">
                  {file ? `${fileKind(file)} · ${formatSize(file.size)}` : "No file"}
                </span>
              </div>
              {!file ? (
                <p className="kiosk-empty">Nothing to preview yet. Go back to step 2 and add your document.</p>
              ) : (
                <>
                  <div className="preview-toolbar">
                    <strong title={file.name}>{file.name}</strong>
                    {previewUrl && (
                      <a href={previewUrl} target="_blank" rel="noreferrer" className="preview-open">
                        Open full ↗
                      </a>
                    )}
                  </div>
                  <div className="preview-frame">
                    {previewLoading && <p className="preview-message">Preparing preview…</p>}
                    {!previewLoading && docxPreview && (
                      <article className="docx-preview" dangerouslySetInnerHTML={{ __html: docxPreview }} />
                    )}
                    {!previewLoading && !docxPreview && previewUrl && file.type === "application/pdf" && (
                      <iframe title="PDF document preview" src={previewUrl} />
                    )}
                    {!previewLoading && !docxPreview && previewUrl && file.type.startsWith("image/") && (
                      <img src={previewUrl} alt="Selected document preview" />
                    )}
                    {!previewLoading && !docxPreview && !previewUrl && (
                      <p className="preview-message">Preview unavailable for this file type.</p>
                    )}
                  </div>
                  <label className="preview-approval">
                    <input
                      type="checkbox"
                      checked={previewApproved}
                      onChange={(event) => {
                        setPreviewApproved(event.target.checked);
                        setStageHint("");
                      }}
                    />
                    <span className="approval-switch" aria-hidden />
                    <span>
                      Yes, this preview looks correct.
                      <small>Required — the original file is what the kiosk prints.</small>
                    </span>
                  </label>
                </>
              )}
            </section>
          )}

          {stage === 4 && (
            <section aria-label="Step 5 — Checkout (test)">
              <div className="panel-heading">
                <div>
                  <span className="step-number">05 / 06</span>
                  <h2>Checkout</h2>
                </div>
                <span className="test-badge">Test mode</span>
              </div>

              <div className="send-summary">
                <div className="send-row">
                  <span>Document</span>
                  <strong title={file?.name ?? ""}>{file?.name ?? "—"}</strong>
                </div>
                <div className="send-row">
                  <span>Job</span>
                  <strong>
                    {copies} {copies === 1 ? "copy" : "copies"} · {color === "bw" ? "B&W" : "Color"} ·{" "}
                    {duplex ? "Double-sided" : "Single-sided"}
                  </strong>
                </div>
                <div className="send-row">
                  <span>Total</span>
                  <strong>{total} DA</strong>
                </div>
                {pages && (
                  <div className="send-row">
                    <span>Pages</span>
                    <strong>{pages}</strong>
                  </div>
                )}
              </div>
              <p className="format-disclaimer">
                Test checkout only — no real payment is processed and no payment SDK is connected.
              </p>

              <div className="rfid-hero" aria-hidden>
                <span>((•))</span>
              </div>
              <p className="rfid-title">Pay at the kiosk</p>
              <p className="format-disclaimer" style={{ marginTop: 0 }}>
                Go to <strong>{selectedKiosk || "your kiosk"}</strong> and tap your campus card on its RFID
                reader to pay {total} DA. Test checkout only — the tap is simulated, no real payment is processed.
              </p>

              {!paid ? (
                <button
                  type="button"
                  className="submit"
                  disabled={payState === "processing"}
                  onClick={() => void tapTest()}
                >
                  {payState === "processing" ? "Waiting for card tap…" : `Simulate card tap · ${total} DA (test)`}
                </button>
              ) : (
                <p className="pay-success" role="status">
                  ✓ Tag accepted — continue to send your print.
                </p>
              )}
            </section>
          )}

          {stage === 5 && (
            <section aria-label="Step 6 — Send and collect">
              <div className="panel-heading">
                <div>
                  <span className="step-number">06 / 06</span>
                  <h2>{done ? "Print complete 🎉" : "Send it to the kiosk"}</h2>
                </div>
                <span className="format-note">{selectedKiosk || "No kiosk"}</span>
              </div>

              <div className="send-summary">
                <div className="send-row">
                  <span>Document</span>
                  <strong title={file?.name ?? ""}>{file?.name ?? "—"}</strong>
                  <button type="button" className="edit-link" onClick={() => goTo(1)}>
                    Edit
                  </button>
                </div>
                <div className="send-row">
                  <span>Job</span>
                  <strong>
                    {copies} {copies === 1 ? "copy" : "copies"} · {color === "bw" ? "B&W" : "Color"} ·{" "}
                    {duplex ? "Double-sided" : "Single-sided"}
                  </strong>
                  <button type="button" className="edit-link" onClick={() => goTo(2)}>
                    Edit
                  </button>
                </div>
                <div className="send-row">
                  <span>Pickup</span>
                  <strong>{selectedKiosk || "—"}</strong>
                  <button type="button" className="edit-link" onClick={() => goTo(2)}>
                    Edit
                  </button>
                </div>
                <div className="send-row">
                  <span>Payment</span>
                  <strong>{paid ? `Test payment ✓ ${total} DA` : "Unpaid"}</strong>
                  <button type="button" className="edit-link" onClick={() => goTo(4)}>
                    Edit
                  </button>
                </div>
                {pages && (
                  <div className="send-row">
                    <span>Pages</span>
                    <strong>{pages}</strong>
                  </div>
                )}
              </div>

              {!done ? (
                <button className="submit" type="button" disabled={!canSubmit} onClick={() => void submitPrintJob()}>
                  {sending ? "Sending to kiosk…" : "Send to print"}
                </button>
              ) : (
                <button className="submit" type="button" onClick={startOver}>
                  Print another file
                </button>
              )}
              {!kiosk && <p className="hint">Pick a kiosk in step 3 to enable sending.</p>}
              {error && (
                <p className="admin-error" role="alert">
                  {error}
                </p>
              )}
              <p className="format-disclaimer">
                Stay on this screen — live status appears in the tracker at the top. Collect at {selectedKiosk || "your kiosk"}{" "}
                when it says Completed.
              </p>
            </section>
          )}

          </div>

          {stageHint && (
            <p className="admin-error" role="alert">
              {stageHint}
            </p>
          )}

          <nav className="wizard-nav" aria-label="Wizard navigation">
            {stage < 5 ? (
              <>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={back}
                  disabled={stage === 0 || sending}
                  aria-label="Go back one step"
                >
                  ‹ Back
                </button>
                <button type="button" className="btn-primary" onClick={next}>
                  Continue
                </button>
              </>
            ) : (
              <button type="button" className="btn-ghost btn-block" onClick={startOver} disabled={sending}>
                Start over
              </button>
            )}
          </nav>
        </div>
      </section>

      <footer className="foot">
        <span>Campus print · self-service</span>
        <span>
          Need help? <a href="/admin">Open operations →</a>
        </span>
      </footer>
    </main>
  );
}
