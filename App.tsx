import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StylePreset, GeneratorState, GeneratedPrompt } from './types';
import { generateInfographicPrompts } from './services/geminiService';
import { PromptCard } from './components/PromptCard';
import { ProgressTracker } from './components/ProgressTracker';
import {
  auth,
  addLead,
  savePromptHistory,
  getUserPromptHistory,
  getTotalLeadsCount,
  getLeadByEmail,
  getAllLeads,
  updateLeadStatus
} from './services/firebaseService';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import {
  Sparkles,
  Settings,
  TrendingUp,
  Layers,
  Video,
  Copy,
  Check,
  Compass,
  Activity,
  ArrowRight,
  RefreshCw,
  Lock,
  Mail,
  Users,
  Award,
  BookOpen,
  LogOut,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Keyboard,
  Share2,
  RotateCcw
} from 'lucide-react';

// ═══════════════════════════════════════════════════════
// CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════════════

const STORAGE_KEYS = {
  RUNS_REMAINING: 'future_stats_runs_remaining',
  VIP_LEAD: 'future_stats_vip_lead',
  LAST_PROMPTS: 'future_stats_last_prompts',
  LAST_TOPIC: 'future_stats_last_topic',
  LAST_STYLE: 'future_stats_last_style',
};

const PRESET_IDEAS = [
  { emoji: '💰', label_en: 'Richest People (2026)', label_uz: 'Eng Boy Odamlar (2026)', value: 'Wealthiest People in the World (Net Worth)' },
  { emoji: '📸', label_en: 'Instagram Stars', label_uz: 'Instagram Yulduzlari', value: 'Most Followed Instagram Accounts' },
  { emoji: '🏎️', label_en: 'Fastest Cars (Top)', label_uz: 'Eng Tezkor Avtolar', value: 'Fastest Production Cars (Top Speed)' },
  { emoji: '📺', label_en: 'YouTubers List', label_uz: 'YouTuberlar', value: 'Most Subscribed YouTube Channels' },
  { emoji: '🌍', label_en: 'GDP Ranking 2026', label_uz: 'Yalpi Ichki Mahsulot', value: 'Countries by Nominal GDP' },
  { emoji: '🏙️', label_en: 'Megacities Growth', label_uz: 'Megapolis Shaharlar', value: 'Most Populated Cities in the World' },
  { emoji: '⚽', label_en: 'Footballers Wealth', label_uz: 'Futbolchilar', value: 'Highest Paid Football Players' },
  { emoji: '💎', label_en: 'Substances Cost', label_uz: 'Eng Qimmat Moddalar', value: 'Most Expensive Substances on Earth' },
  { emoji: '🍔', label_en: 'Fast Food Chains', label_uz: 'Fastfud Tarmoqlari', value: 'Largest Fast Food Chains by Revenue' }
];

const TRANSLATIONS = {
  uz: {
    title: "Kelajak",
    subtitle: "Stats Arxitektor",
    yearSuffix: "Premium",
    description: "O'ta aniq prognozlarga asoslangan 15 qismli taqqoslash infografika ssenariy generatori. Reels, Shorts va TikTok video ijodkorlari uchun maxsus tayyorlangan premium interfeys.",
    labelTopic: "Ssenariy yoki Kanal Mavzusi",
    placeholderTopic: "Mavzuni kiriting... (masalan: Eng kuchli armiyalar, Eng ko'p sotilgan telefonlar)",
    labelStyle: "Art Stil / Vizual Uslub",
    labelAspect: "Rasm O'lchami",
    labelYear: "Bashorat Yili",
    labelSorting: "Saralash Tartibi",
    btnGenerate: "15 Ta Promptni Yaratish",
    generating: "Hisoblanmoqda va Arxitektura tayyorlanmoqda...",
    readyIdeas: "✨ Tezkor Mavzular (Presets)",
    loadingTip: "Gemini stats-kompilyatori ma'lumotlarni saralab, xronologik tartibda joylashtirmoqda...",
    errorTitle: "Xatolik yuz berdi",
    promptsReady: "Ssenariy uchun 15 xil mukammal rasm blueprinti tayyor!",
    emptyTitle: "Ssenariy tayyorlashni boshlang",
    emptyDescription: "Taqqoslash mavzusi va art stilini tanlab, infografik visual qoliplarni oling.",
    guideTab: "Gem Qo'llanmasi",
    promptTab: "Yaratilgan Loyihalar",
    historyTab: "Tarixi 📜",
    dashboardTab: "CRM 📈",
    gemGuideTitle: "💡 Gemini Advanced'da rasm botini (Gem) sozlash",
    gemGuideDescription: "Hamma rasmlaringiz bir xil qolipda (o'lcham, hoshiya, tana masshtabi) chizilib, egizaklardek tushishi uchun quyidagi ko'rsatmalarni nusxalab maxsus bot yaratib oling:",
    gemName: "Gem Bot Nomi:",
    gemDescription: "Klaviatura tavsifi (Description):",
    gemInstructions: "Tizim Ko'rsatmalari (System Instructions):",
    copyOk: "Nusxalandi!",
    copyText: "Nusxa olish",
    stepTitle: "Shorts Video Qanday Tayyorlanadi?",
    step1: "1. Promptlarni ketma-ket nusxalang va o'zingiz sozlagan Gem botga yuboring.",
    step2: "2. Gem bot 3-panel ko'rinishidagi rasm qoliplarini chizib beradi.",
    step3: "3. Ushbu rasmlarni bitta reels/tiktok videosiga jamlab, ovoz bering va e'lon qiling.",
    copyAll: "Barchasini Nusxalash",
    downloadAllTxt: "TXT Yuklash",
    downloadAllJson: "JSON Yuklash",
    batchActions: "Ommaviy Eksport",
    copiedAll: "Barcha 15 ta prompt nusxalandi!",
    retryBtn: "Qayta urinish",
    duplicateTitle: "Dublikat Tekshiruvi",
    duplicateClean: "✅ Barcha 45 ta qahramon noyob — takrorlanish yo'q!",
    duplicateFound: "⚠️ Takrorlangan qahramonlar topildi:",
    shareTitle: "Ulashish",
    shareCopied: "Nusxalandi!",
    keyboardHint: "Ctrl+Enter = Yaratish • Ctrl+Shift+C = Barchani Nusxalash",
    totalLeads: "Jami Leadlar",
    connectedTelegram: "Telegram Ulanganlar",
    unsubscribedPending: "Marketing Target (Sotib olmaganlar)",
    marketingDashboard: "Marketing Boshqaruv Bo'limi",
    broadcastTitle: "Ommaviy Xabar Tarqatish (Broadcast)",
    broadcastTgLabel: "Telegram Ommaviy Broadcast",
    broadcastEmailLabel: "Email Ommaviy Broadcast",
    subject: "Mavzu",
    message: "Xabar matni",
    sendBroadcast: "Xabarni yuborish",
    triggerScheduler: "Kampaniyalarni Hozir Tekshirish (Manual Trigger)",
    gemInstructValue: "You are an expert infographic designer and AI image generation specialist. Your sole purpose is to generate 3-panel comparison infographics based on the prompts provided by the user.\n\nCRITICAL RULES FOR EVERY IMAGE YOU GENERATE:\n1. LAYOUT: The image MUST be divided into exactly 3 equal panels (based on chosen layout).\n2. TOP SECTION: Each panel must have a light grey header bar with the Country Name in bold white text. Below the header, there MUST be a large, shield-shaped flag with a silver metallic bevel/border.\n3. MIDDLE SECTION: Below the flag, there MUST be a solid navy blue banner containing the Subject's Name and their Statistic in bold white text.\n4. BOTTOM SECTION (PORTRAITS): Inside a white-bordered frame, you must draw the subject.\n5. STRICT STRUCTURAL CONSISTENCY (THE \"CLONE\" RULE): All 3 portraits in the 3 panels MUST have the EXACT SAME camera framing, scale, and proportions. They must all be front-facing, medium shots (waist-up), perfectly centered, with the exact same head size and eye level. The background for all portraits must be a plain parchment texture.\n6. MASTER TEMPLATE: Panel 1 is the master template. Panel 2 and Panel 3 MUST perfectly mirror its structural layout and character scale."
  },
  en: {
    title: "Future",
    subtitle: "Stats Architect",
    yearSuffix: "Premium",
    description: "High-yield prompt compiler with real futurist statistics. Custom designed to double user retention on Reels, TikTok, and YouTube Shorts in premium space dark mode.",
    labelTopic: "Series Topic",
    placeholderTopic: "e.g. Cyberpunk armored vehicles, Tallest monuments comparison",
    styleConceptArt: "Concept Art",
    labelStyle: "Art Style Preset",
    labelAspect: "Aspect Ratio",
    labelYear: "Prediction Year",
    labelSorting: "Sorting Order",
    btnGenerate: "Generate 15 Prompt Series",
    generating: "Analyzing and compiling data structures...",
    readyIdeas: "✨ Curated Presets",
    loadingTip: "Gemini is building sorted arrays and applying structural layouts inside JSON frames...",
    errorTitle: "An error occurred",
    promptsReady: "15-image infographic blueprint successfully compiled!",
    emptyTitle: "Launch the Architecture",
    emptyDescription: "Enter any topic to generate highly structured visual prompts dynamically.",
    guideTab: "Gem Guide",
    promptTab: "Active Prompts",
    historyTab: "History 📜",
    dashboardTab: "CRM 📈",
    gemGuideTitle: "💡 Tutorial: Creating custom Gemini Gem",
    gemGuideDescription: "To guarantee perfectly balanced layouts without canvas drifting, create a dedicated Gemini Gem using this specification:",
    gemName: "Gem Name:",
    gemDescription: "Description:",
    gemInstructions: "System Instructions:",
    copyOk: "Copied!",
    copyText: "Copy Template",
    stepTitle: "Shorts Video Automation Pipeline",
    step1: "1. Prompt each of the 15 output cards in succession into your configured Gem.",
    step2: "2. The Gem maintains identical anchor sizing and generates beautiful panels.",
    step3: "3. Import into Premiere/CapCut, stitch with music, and publish for viral feeds.",
    copyAll: "Copy All Prompts",
    downloadAllTxt: "Download TXT",
    downloadAllJson: "Download JSON",
    batchActions: "Bulk Export",
    copiedAll: "All 15 prompts copied!",
    retryBtn: "Retry",
    duplicateTitle: "Duplicate Check",
    duplicateClean: "✅ All 45 subjects are unique — no duplicates!",
    duplicateFound: "⚠️ Duplicate subjects found:",
    shareTitle: "Share",
    shareCopied: "Link copied!",
    keyboardHint: "Ctrl+Enter = Generate • Ctrl+Shift+C = Copy All",
    totalLeads: "Total Leads",
    connectedTelegram: "Connected Telegram Users",
    unsubscribedPending: "Marketing Targets (Pending/Free)",
    marketingDashboard: "Marketing Automation Dashboard",
    broadcastTitle: "Bulk Message Broadcasting",
    broadcastTgLabel: "Telegram Broadcast Campaign",
    broadcastEmailLabel: "Email Broadcast Campaign",
    subject: "Subject",
    message: "Message Body",
    sendBroadcast: "Send Broadcast Campaign",
    triggerScheduler: "Trigger Marketing Scheduler Check (Manual Run)",
    gemInstructValue: "You are an expert infographic designer and AI image generation specialist. Your sole purpose is to generate 3-panel comparison infographics based on the prompts provided by the user.\n\nCRITICAL RULES FOR EVERY IMAGE YOU GENERATE:\n1. LAYOUT: The image MUST be divided into exactly 3 equal panels (based on chosen layout).\n2. TOP SECTION: Each panel must have a light grey header bar with the Country Name in bold white text. Below the header, there MUST be a large, shield-shaped flag with a silver metallic bevel/border.\n3. MIDDLE SECTION: Below the flag, there MUST be a solid navy blue banner containing the Subject's Name and their Statistic in bold white text.\n4. BOTTOM SECTION (PORTRAITS): Inside a white-bordered frame, you must draw the subject.\n5. STRICT STRUCTURAL CONSISTENCY (THE \"CLONE\" RULE): All 3 portraits in the 3 panels MUST have the EXACT SAME camera framing, scale, and proportions. They must all be front-facing, medium shots (waist-up), perfectly centered, with the exact same head size and eye level. The background for all portraits must be a plain parchment texture.\n6. MASTER TEMPLATE: Panel 1 is the master template. Panel 2 and Panel 3 MUST perfectly mirror its structural layout and character scale."
  }
};

// ═══════════════════════════════════════════════════════
// DUPLICATE CHECKER UTILITY
// ═══════════════════════════════════════════════════════

function findDuplicateSubjects(prompts: GeneratedPrompt[]): string[] {
  const seen = new Map<string, number>();
  const dupes: string[] = [];
  for (const p of prompts) {
    for (const panel of (p.panels || [])) {
      const key = (panel.subject || '').toLowerCase().trim();
      if (!key) continue;
      const count = (seen.get(key) || 0) + 1;
      seen.set(key, count);
      if (count === 2) dupes.push(panel.subject);
    }
  }
  return dupes;
}

// ═══════════════════════════════════════════════════════
// APP COMPONENT
// ═══════════════════════════════════════════════════════

const App: React.FC = () => {
  // Localization and tabs
  const [lang, setLang] = useState<'uz' | 'en'>('uz');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<'prompts' | 'setup' | 'history' | 'dashboard' | 'admin'>('prompts');
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'marketing'>('users');

  // Marketing automation states
  const [marketingMetrics, setMarketingMetrics] = useState({ totalLeads: 0, connectedTelegram: 0, unsubscribedPending: 0 });
  const [broadcastTgMessage, setBroadcastTgMessage] = useState('');
  const [broadcastEmailSubject, setBroadcastEmailSubject] = useState('');
  const [broadcastEmailMessage, setBroadcastEmailMessage] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  // Firebase Auth states
  const [user, setUser] = useState<User | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [isRegisteredLead, setIsRegisteredLead] = useState(false);
  const [leadsCount, setLeadsCount] = useState<number>(142);
  const [historyList, setHistoryList] = useState<any[]>([]);

  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [userStatus, setUserStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [allLeads, setAllLeads] = useState<any[]>([]);

  // Advanced Dynamic States
  const [predictionYear, setPredictionYear] = useState<string>('2026');
  const [sortingOrder, setSortingOrder] = useState<string>('Ascending');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9 Landscape');

  // Freemium states / Paywalls / Lead Wall
  const [freeRunsRemaining, setFreeRunsRemaining] = useState<number>(2);
  const [showLeadWallModal, setShowLeadWallModal] = useState<boolean>(false);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);

  // Progress & Animation states
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [showDuplicateCheck, setShowDuplicateCheck] = useState<boolean>(false);

  const formRef = useRef<HTMLFormElement>(null);

  const [state, setState] = useState<GeneratorState>({
    topic: '',
    style: StylePreset.ConceptArt,
    isLoading: false,
    prompts: [],
    error: null,
  });

  const t = TRANSLATIONS[lang];

  // ─── Auth listener ───
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setIsRegisteredLead(true);
        if (u.email) {
          const leadInfo = await getLeadByEmail(u.email);
          if (leadInfo) {
            setUserRole(leadInfo.role || 'user');
            setUserStatus(leadInfo.status || 'pending');
            if (leadInfo.role === 'admin') {
              const leads = await getAllLeads();
              setAllLeads(leads);
            }
          } else {
             // Just registered? Add them
             await addLead(u.email, 'free');
             const newLeadInfo = await getLeadByEmail(u.email);
             if (newLeadInfo) {
               setUserRole(newLeadInfo.role || 'user');
               setUserStatus(newLeadInfo.status || 'pending');
             }
          }
        }
        loadUserHistory(u.uid);
      } else {
        setUserRole(null);
        setUserStatus(null);
      }
    });

    // Check Local Storage for free runs count
    const storedRuns = localStorage.getItem(STORAGE_KEYS.RUNS_REMAINING);
    if (storedRuns !== null) {
      setFreeRunsRemaining(parseInt(storedRuns, 10));
    } else {
      localStorage.setItem(STORAGE_KEYS.RUNS_REMAINING, '2');
      setFreeRunsRemaining(2);
    }

    // Restore last session from localStorage
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.LAST_PROMPTS);
      const cachedTopic = localStorage.getItem(STORAGE_KEYS.LAST_TOPIC);
      const cachedStyle = localStorage.getItem(STORAGE_KEYS.LAST_STYLE);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setState(prev => ({ ...prev, prompts: parsed, topic: cachedTopic || prev.topic, style: (cachedStyle as StylePreset) || prev.style }));
        }
      }
    } catch (e) { /* ignore parse errors */ }

    // Load total CRM leads count
    getTotalLeadsCount().then(res => setLeadsCount(res));

    return () => unsub();
  }, []);

  // ─── Keyboard Shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Enter = Generate
      if (e.ctrlKey && e.key === 'Enter' && !state.isLoading && state.topic.trim()) {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
      // Ctrl+Shift+C = Copy All
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c') && state.prompts.length > 0) {
        e.preventDefault();
        copyAllToClipboard();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.isLoading, state.topic, state.prompts]);

  const loadUserHistory = async (uid: string) => {
    try {
      const logs = await getUserPromptHistory(uid);
      if (logs) setHistoryList(logs);
    } catch (e) {
      console.warn('History logs unreadable');
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user && result.user.email) {
        await addLead(result.user.email, isPremium ? 'premium' : 'free');
        setIsRegisteredLead(true);
        loadUserHistory(result.user.uid);
        getTotalLeadsCount().then(res => setLeadsCount(res));

        const leadInfo = await getLeadByEmail(result.user.email);
        if (leadInfo) {
           setUserRole(leadInfo.role || 'user');
           setUserStatus(leadInfo.status || 'pending');
           if (leadInfo.role === 'admin') {
              const leads = await getAllLeads();
              setAllLeads(leads);
           }
        }
      }
    } catch (err: any) {
      console.error('Google login error details:', err);
      const errMsg = err.code || err.message || JSON.stringify(err);
      alert(lang === 'uz'
        ? `Tizimga kirishda xatolik yuz berdi: ${errMsg}\n\nAgarda 'auth/operation-not-allowed' bo'lsa, Firebase konsolida Google Auth yoqilganini tekshiring.`
        : `Sign in failed: ${errMsg}`);
    }
  };

  const handleEmailSubscriberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    try {
      await addLead(emailInput.trim(), isPremium ? 'premium' : 'free');
      setIsRegisteredLead(true);
      setShowLeadWallModal(false);
      localStorage.setItem(STORAGE_KEYS.VIP_LEAD, emailInput.trim());
      getTotalLeadsCount().then(res => setLeadsCount(res));
      alert(lang === 'uz' ? 'Ajoyib! VIP ssenaristlar ro\'yxatiga qo\'shildingiz.' : 'Excellent! You are added to the VIP Newsletter.');
    } catch (e: any) {
      console.error(e);
      alert('Ma\'lumot saqlashda xatolik.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsRegisteredLead(false);
    setHistoryList([]);
  };

  const handleUpgradeToPremium = () => {
    setIsPremium(true);
    setShowUpgradeModal(false);
    if (user?.email) {
      addLead(user.email, 'premium');
    }
    alert(lang === 'uz' ? 'Tabriklaymiz! Premium status muvaffaqiyatli faollashtirildi.' : 'Congrats! Premium features successfully unlocked.');
  };

  // ─── MARKETING AUTOMATION API CALLS ───
  const loadMarketingMetrics = async () => {
    try {
      const res = await fetch('/api/admin/marketing-metrics');
      const data = await res.json();
      if (data && !data.error) {
        setMarketingMetrics(data);
      }
    } catch (e) {
      console.warn('Failed to fetch marketing metrics');
    }
  };

  const handleBroadcastTelegram = async () => {
    if (!broadcastTgMessage.trim()) return;
    setBroadcastStatus('Telegram xabarlar yuborilmoqda...');
    try {
      const res = await fetch('/api/admin/broadcast-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastTgMessage })
      });
      const data = await res.json();
      setBroadcastStatus(data.message || 'Telegram tarqatish muvaffaqiyatli yakunlandi!');
      setBroadcastTgMessage('');
      loadMarketingMetrics();
      setTimeout(() => setBroadcastStatus(null), 5000);
    } catch (e: any) {
      setBroadcastStatus('Xatolik: ' + e.message);
      setTimeout(() => setBroadcastStatus(null), 5000);
    }
  };

  const handleBroadcastEmail = async () => {
    if (!broadcastEmailSubject.trim() || !broadcastEmailMessage.trim()) return;
    setBroadcastStatus('Email xabarlar yuborilmoqda...');
    try {
      const res = await fetch('/api/admin/broadcast-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: broadcastEmailSubject, message: broadcastEmailMessage })
      });
      const data = await res.json();
      setBroadcastStatus(data.message || 'Email tarqatish muvaffaqiyatli yakunlandi!');
      setBroadcastEmailSubject('');
      setBroadcastEmailMessage('');
      loadMarketingMetrics();
      setTimeout(() => setBroadcastStatus(null), 5000);
    } catch (e: any) {
      setBroadcastStatus('Xatolik: ' + e.message);
      setTimeout(() => setBroadcastStatus(null), 5000);
    }
  };

  const handleTriggerScheduler = async () => {
    try {
      const res = await fetch('/api/admin/trigger-scheduler', { method: 'POST' });
      const data = await res.json();
      alert(lang === 'uz' ? `Kampaniyalar tekshirildi: ${data.message}` : `Scheduler checked: ${data.message}`);
      loadMarketingMetrics();
    } catch (e: any) {
      alert('Error triggering scheduler: ' + e.message);
    }
  };

  // ─── GENERATE (with simulated progress) ───
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.topic.trim()) return;

    if (!user) {
      alert(lang === 'uz' ? 'Tizimga kirish majburiy!' : 'Sign in required!');
      return;
    }

    if (userStatus !== 'approved') {
      alert(lang === 'uz' ? 'Admindan ruxsat kutilmoqda.' : 'Pending admin approval.');
      return;
    }

    // Premium check
    if (state.style !== StylePreset.ConceptArt && !isPremium) {
      setShowUpgradeModal(true);
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, prompts: [] }));
    setGenerationProgress(0);
    setShowCelebration(false);
    setShowDuplicateCheck(false);

    // Simulate progress ticks while Gemini processes
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 13) { clearInterval(progressInterval); return 13; }
        return prev + 1;
      });
    }, 1200);

    try {
      const results = await generateInfographicPrompts(
        state.topic,
        state.style,
        predictionYear,
        sortingOrder,
        aspectRatio
      );

      clearInterval(progressInterval);

      const newPrompts = results.map((p, i) => ({
        id: i,
        content: p.content,
        panels: p.panels
      }));

      // Quick ramp to 15
      setGenerationProgress(14);
      await new Promise(r => setTimeout(r, 300));
      setGenerationProgress(15);

      setState(prev => ({
        ...prev,
        isLoading: false,
        prompts: newPrompts,
      }));

      // Celebration effect
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);

      // Auto-save to localStorage
      try {
        localStorage.setItem(STORAGE_KEYS.LAST_PROMPTS, JSON.stringify(newPrompts));
        localStorage.setItem(STORAGE_KEYS.LAST_TOPIC, state.topic);
        localStorage.setItem(STORAGE_KEYS.LAST_STYLE, state.style);
      } catch (e) { /* quota exceeded */ }

      // Consume free run if not logged in
      if (!user && !isRegisteredLead) {
        const nextRuns = Math.max(0, freeRunsRemaining - 1);
        setFreeRunsRemaining(nextRuns);
        localStorage.setItem(STORAGE_KEYS.RUNS_REMAINING, nextRuns.toString());
      }

      // Record logs to Firestore if logged in
      if (user) {
        await savePromptHistory(user.uid, state.topic, state.style, 15);
        loadUserHistory(user.uid);
      }

      setActiveViewTab('prompts');
    } catch (err: any) {
      clearInterval(progressInterval);
      setGenerationProgress(0);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Xatolik yuz berdi.',
      }));
    }
  };

  // ─── Edit Prompt Handler ───
  const handleEditPrompt = useCallback((id: number, newContent: string) => {
    setState(prev => ({
      ...prev,
      prompts: prev.prompts.map(p => p.id === id ? { ...p, content: newContent } : p)
    }));
  }, []);

  // ─── Clipboard & Export Helpers ───
  const copyToClipboard = async (text: string, identifier: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSection(identifier);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyAllToClipboard = async () => {
    const body = state.prompts.map((p, i) => {
      return `=== INFOGRAPHIC PROMPT ${i + 1}/15 ===\n${p.content}`;
    }).join('\n\n================================================================================\n\n');

    await navigator.clipboard.writeText(body);
    setCopiedSection('all_prompts');
    setTimeout(() => setCopiedSection(null), 3000);
  };

  const exportAllAsTxt = () => {
    const header = `================================================================================
FUTURESTATS PROMPT ARCHITECT - ALL 15 PROMPTS SERIES
Topic: ${state.topic}
Style: ${state.style}
Prediction Year: ${predictionYear}
Aspect Ratio: ${aspectRatio}
Generated Date: ${new Date().toLocaleString()}
================================================================================\n\n`;

    const body = state.prompts.map((p, i) => {
      return `=== INFOGRAPHIC PROMPT ${i + 1}/15 ===\n${p.content}\n\n================================================================================`;
    }).join('\n\n');

    const fileContent = header + body;
    const element = document.createElement("a");
    const file = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);

    const safeTopic = state.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    element.download = `futurestats-all-15-prompts-${safeTopic || 'prompts'}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const exportAllAsJson = () => {
    const data = {
      metadata: {
        topic: state.topic,
        style: state.style,
        predictionYear: predictionYear,
        aspectRatio: aspectRatio,
        sortingOrder: sortingOrder,
        timestamp: new Date().toISOString()
      },
      prompts: state.prompts
    };

    const element = document.createElement("a");
    const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    element.href = URL.createObjectURL(file);

    const safeTopic = state.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    element.download = `futurestats-all-15-prompts-${safeTopic || 'prompts'}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleSharePrompts = async () => {
    const shareText = `FutureStats Architect — ${state.topic}\n\n${state.prompts.length} ta professional infografika prompt tayyor!\n\nPlatforma: https://futurestats.app`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'FutureStats Architect', text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        setCopiedSection('share_link');
        setTimeout(() => setCopiedSection(null), 2000);
      }
    } catch (e) {
      await navigator.clipboard.writeText(shareText);
      setCopiedSection('share_link');
      setTimeout(() => setCopiedSection(null), 2000);
    }
  };

  const setTopic = (topic: string) => setState(prev => ({ ...prev, topic }));
  const setStyle = (style: StylePreset) => setState(prev => ({ ...prev, style }));

  const duplicates = state.prompts.length > 0 ? findDuplicateSubjects(state.prompts) : [];

  return (
    <div className="min-h-screen bg-[#020617] text-[#f8fafc] mesh-bg font-sans pb-20 relative">

      {/* ═══ Premium Navigation Bar ═══ */}
      <nav className="bg-slate-950/75 border-b border-slate-800/80 sticky top-0 z-50 px-4 sm:px-6 lg:px-8 py-3 shadow-xl backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/20 neon-glow-indigo">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-white text-lg tracking-tight">FutureStats</span>
              <span className="text-[10px] bg-indigo-900/30 text-indigo-400 border border-indigo-500/20 font-black px-2 py-0.5 rounded-full ml-2">v2026.5</span>
              {isPremium && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-black px-2 py-0.5 rounded-full ml-1 border border-amber-500/30">
                  ★ PRO
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* User Profile / Status */}
            {user ? (
              <div className="hidden sm:flex items-center space-x-2 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                <img src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'} alt="Avatar" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                <span className="font-bold text-slate-300 max-w-20 truncate">{user.displayName || user.email}</span>
                <button onClick={handleLogout} title="Logout" className="text-red-400 hover:text-red-300 transition ml-1">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/10"
              >
                <span>🔑</span>
                <span>{lang === 'uz' ? 'Kirish' : 'Sign in'}</span>
              </button>
            )}

            {/* Language Switcher */}
            <div className="bg-slate-900/50 p-0.5 rounded-xl flex items-center text-xs font-bold border border-slate-800 shadow-inner">
              <button
                onClick={() => setLang('uz')}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  lang === 'uz' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🇺🇿
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  lang === 'en' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🇬🇧
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-7 relative z-10">

        {/* ═══ Brand Hero Card ═══ */}
        <div className="text-center space-y-4 animate-fade-in-up">
          <div className="inline-flex items-center justify-center p-2.5 bg-gradient-to-tr from-amber-500 to-indigo-600 rounded-2xl shadow-xl text-white neon-glow-indigo">
            <Sparkles className="w-5 h-5" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight sm:text-5xl">
            {t.title} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{t.subtitle}</span> <span className="text-slate-500 font-light text-2xl sm:text-3xl">{t.yearSuffix}</span>
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
            {t.description}
          </p>
          {/* Keyboard shortcut hint */}
          <p className="text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
            <Keyboard className="w-3 h-3" />
            {t.keyboardHint}
          </p>
        </div>

        {/* ═══ Access Control ═══ */}
        {!user ? (
          <div className="bg-gradient-to-r from-amber-950/20 via-amber-900/10 to-orange-950/20 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in-up">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-amber-300">
                  {lang === 'uz' ? 'Tizimga kirish majburiy' : 'Login Required'}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lang === 'uz' ? 'Generatsiya qilish uchun hisobingizga kiring.' : 'Please sign in to generate prompts.'}
                </p>
              </div>
            </div>
            <button
              onClick={handleGoogleLogin}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition shadow-lg active:scale-95"
            >
              🔑 {lang === 'uz' ? 'Kirish' : 'Sign in'}
            </button>
          </div>
        ) : userStatus !== 'approved' && (
          <div className="bg-gradient-to-r from-red-950/30 via-red-900/20 to-orange-950/30 border border-red-500/30 p-5 rounded-2xl shadow-lg animate-fade-in-up relative overflow-hidden">
            <div className="absolute inset-0 bg-mesh opacity-10 pointer-events-none"></div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-start sm:items-center space-x-3">
                <div className="p-3 bg-red-500/20 rounded-xl text-red-400 shadow-inner">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-red-300">
                    {lang === 'uz' ? 'Admindan ruxsat kutilmoqda' : 'Pending Admin Approval'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed font-medium">
                    {lang === 'uz' 
                      ? 'Sizning hisobingiz hozircha tasdiqlanmagan. Tizimdan foydalanish uchun Telegram orqali admin bilan bog\'laning.' 
                      : 'Your account is pending approval. Please contact the administrator via Telegram.'}
                  </p>
                </div>
              </div>
              <a 
                href={`https://t.me/FutureStats_bot?start=${user?.email ? btoa(user.email) : ''}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2.5 bg-[#0088cc] hover:bg-[#0077b3] text-white rounded-xl text-xs font-black transition shadow-lg shadow-[#0088cc]/20 flex items-center justify-center space-x-2 active:scale-95"
              >
                <span>💬</span>
                <span>{lang === 'uz' ? 'Telegram orqali ruxsat so\'rash' : 'Request Access'}</span>
              </a>
            </div>
          </div>
        )}

        {/* ═══ Setup & Form Container ═══ */}
        <div className="glass-tier-2 rounded-3xl overflow-hidden shadow-2xl relative animate-fade-in-up">
          <div className="p-6 sm:p-8 space-y-5">
            <form ref={formRef} onSubmit={handleGenerate} className="space-y-5">

              {/* Row 1: Topic */}
              <div>
                <label htmlFor="topic" className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  {t.labelTopic}
                </label>
                <input
                  id="topic"
                  type="text"
                  required
                  maxLength={500}
                  placeholder={t.placeholderTopic}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-800 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-slate-200 bg-slate-950/80 font-medium placeholder:text-slate-600 text-sm"
                  value={state.topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              {/* Row 2: Parameters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Style Selection */}
                <div>
                  <label htmlFor="style" className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Compass className="w-3 h-3 text-indigo-400" />
                    {t.labelStyle}
                  </label>
                  <select
                    id="style"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-800 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-slate-300 bg-slate-950/80 font-medium text-xs cursor-pointer"
                    value={state.style}
                    onChange={(e) => setStyle(e.target.value as StylePreset)}
                  >
                    {Object.values(StylePreset).map((s) => {
                      const requiresPremi = s !== StylePreset.ConceptArt;
                      return (
                        <option key={s} value={s}>
                          {requiresPremi && !isPremium ? `🔓 ${s} (PRO)` : s}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label htmlFor="aspectRatio" className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-400" />
                    {t.labelAspect}
                  </label>
                  <select
                    id="aspectRatio"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-800 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-slate-300 bg-slate-950/80 font-medium text-xs cursor-pointer"
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                  >
                    <option value="16:9 Landscape">16:9 Landscape</option>
                    <option value="9:16 Portrait">9:16 Portrait</option>
                    <option value="1:1 Square">1:1 Square</option>
                  </select>
                </div>

                {/* Prediction Year */}
                <div>
                  <label htmlFor="predictionYear" className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Settings className="w-3 h-3 text-indigo-400" />
                    {t.labelYear}
                  </label>
                  <select
                    id="predictionYear"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-800 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-slate-300 bg-slate-950/80 font-medium text-xs cursor-pointer"
                    value={predictionYear}
                    onChange={(e) => setPredictionYear(e.target.value)}
                  >
                    <option value="2026">2026</option>
                    <option value="2030">2030</option>
                    <option value="2040">2040</option>
                    <option value="2050">2050</option>
                  </select>
                </div>

                {/* Sorting Order */}
                <div>
                  <label htmlFor="sortingOrder" className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-indigo-400" />
                    {t.labelSorting}
                  </label>
                  <select
                    id="sortingOrder"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-800 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-slate-300 bg-slate-950/80 font-medium text-xs cursor-pointer"
                    value={sortingOrder}
                    onChange={(e) => setSortingOrder(e.target.value)}
                  >
                    <option value="Ascending">{lang === 'uz' ? "O'sish Tartibi" : "Ascending"}</option>
                    <option value="Descending">{lang === 'uz' ? "Kamayish Tartibi" : "Descending"}</option>
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={state.isLoading || !state.topic.trim() || !user || userStatus !== 'approved'}
                  className={`w-full py-4 rounded-xl font-black text-sm shadow-lg transition-all flex items-center justify-center space-x-2 btn-premium ${
                    state.isLoading
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white hover:opacity-95 hover:shadow-indigo-500/20 hover:-translate-y-0.5 shimmer-btn active:scale-[0.98]'
                  }`}
                >
                  {state.isLoading ? (
                    <>
                      <RefreshCw className="animate-spin h-5 w-5 mr-2 text-slate-400" />
                      <span>{t.generating}</span>
                    </>
                  ) : (
                    <>
                      <span>{t.btnGenerate}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Interactive Presets */}
            <div className="border-t border-slate-800/80 pt-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                {t.readyIdeas}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {PRESET_IDEAS.map((idea) => (
                  <button
                    key={idea.value}
                    type="button"
                    onClick={() => setTopic(idea.value)}
                    className="flex items-center space-x-2.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-900 hover:border-indigo-500/40 hover:shadow-md transition-all text-left group active:scale-[0.98]"
                  >
                    <span className="text-sm bg-slate-900 p-1 rounded-lg border border-slate-800 shadow-inner group-hover:scale-110 transition-transform">
                      {idea.emoji}
                    </span>
                    <span className="text-[11px] font-extrabold text-slate-300 group-hover:text-indigo-400 truncate">
                      {lang === 'uz' ? idea.label_uz : idea.label_en}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ═══ Progress Tracker (during generation) ═══ */}
        {(state.isLoading || (generationProgress > 0 && generationProgress < 15)) && (
          <ProgressTracker
            currentStep={generationProgress}
            isActive={state.isLoading}
            lang={lang}
          />
        )}

        {/* ═══ Celebration Success Banner ═══ */}
        {showCelebration && state.prompts.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-emerald-950/30 to-indigo-950/20 border border-emerald-500/20 rounded-2xl flex items-center justify-center space-x-3 celebration-pop">
            <span className="text-2xl">🎉</span>
            <span className="text-sm font-black text-emerald-300">{t.promptsReady}</span>
            <span className="text-2xl">✨</span>
          </div>
        )}

        {/* ═══ Tab Selection Area ═══ */}
        <div className="space-y-5">
          <div className="flex border-b border-slate-800 overflow-x-auto scroller-hide gap-1">
            {([
              { key: 'prompts' as const, icon: '🚀', label: `${t.promptTab} (${state.prompts.length})` },
              { key: 'setup' as const, icon: '🤖', label: t.guideTab },
              { key: 'history' as const, icon: '📜', label: lang === 'uz' ? "Tarixi" : "History" },
              { key: 'dashboard' as const, icon: '📈', label: 'CRM' },
              ...(userRole === 'admin' ? [{ key: 'admin' as const, icon: '🛡️', label: 'Admin' }] : [])
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveViewTab(tab.key);
                  if (tab.key === 'admin') {
                    loadMarketingMetrics();
                  }
                }}
                className={`pb-2.5 text-[11px] font-extrabold border-b-2 px-3 flex-shrink-0 transition-all ${
                  activeViewTab === tab.key
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ═══ CRM Dashboard Tab ═══ */}
          {activeViewTab === 'dashboard' && (
            <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in-up">
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  {lang === 'uz' ? 'Real-Vaqtda Creator CRM' : 'Real-Time Creator Economy'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {lang === 'uz'
                    ? 'Growth Hacker hisoboti va Firebase NoSQL drayveridagi saqlangan ma\'lumotlar.'
                    : 'Growth analytics paired with CRM subscriber metrics.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center space-x-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] text-indigo-400 font-extrabold uppercase">Leads</span>
                    <h4 className="text-lg font-black text-white">{leadsCount}</h4>
                  </div>
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center space-x-3">
                  <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] text-amber-400 font-extrabold uppercase">Conversion</span>
                    <h4 className="text-lg font-black text-white">14.8%</h4>
                  </div>
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center space-x-3">
                  <div className="p-2.5 bg-slate-800 text-indigo-400 rounded-xl">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase">Clones</span>
                    <h4 className="text-lg font-black text-white">2,410</h4>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ ADMIN TAB ═══ */}
          {activeViewTab === 'admin' && userRole === 'admin' && (
            <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in-up">
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-4">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Admin Dashboard
                </h3>
                <button onClick={async () => {
                  if (adminSubTab === 'users') {
                    const leads = await getAllLeads();
                    setAllLeads(leads);
                  } else {
                    await loadMarketingMetrics();
                  }
                }} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
                  <RefreshCw className="w-3.5 h-3.5" /> Yangilash
                </button>
              </div>

              {/* Sub-tabs selector */}
              <div className="flex border-b border-slate-800/60 gap-2">
                <button
                  onClick={() => setAdminSubTab('users')}
                  className={`pb-2 text-xs font-black border-b-2 px-4 transition-all flex items-center gap-1.5 ${
                    adminSubTab === 'users'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  👥 {lang === 'uz' ? 'Foydalanuvchilar' : 'Users List'}
                </button>
                <button
                  onClick={() => {
                    setAdminSubTab('marketing');
                    loadMarketingMetrics();
                  }}
                  className={`pb-2 text-xs font-black border-b-2 px-4 transition-all flex items-center gap-1.5 ${
                    adminSubTab === 'marketing'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📢 {lang === 'uz' ? "Marketing Bo'limi" : 'Marketing Panel'}
                </button>
              </div>

              {adminSubTab === 'marketing' ? (
                <div className="space-y-6">
                  {/* Grid of metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center space-x-3 shadow-inner">
                      <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/10">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase">{t.totalLeads}</span>
                        <h4 className="text-xl font-black text-white">{marketingMetrics.totalLeads}</h4>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center space-x-3 shadow-inner">
                      <div className="p-2.5 bg-indigo-500/20 text-indigo-450 rounded-xl border border-indigo-500/10">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase">{t.connectedTelegram}</span>
                        <h4 className="text-xl font-black text-indigo-300">{marketingMetrics.connectedTelegram}</h4>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center space-x-3 shadow-inner">
                      <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/10">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase">{t.unsubscribedPending}</span>
                        <h4 className="text-xl font-black text-amber-300">{marketingMetrics.unsubscribedPending}</h4>
                      </div>
                    </div>
                  </div>

                  {/* Manual Scheduler Trigger */}
                  <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <h4 className="text-sm font-extrabold text-slate-200">Marketing Scheduler</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {lang === 'uz'
                          ? '24 soat (Welcome & Guide) va 72 soat (30% chegirma) marketing kampaniyalarini avtomatik yuborishni hozir tekshirish.'
                          : 'Manually check and trigger 24h (Welcome & Guide) and 72h (30% discount) campaign runs.'}
                      </p>
                    </div>
                    <button
                      onClick={handleTriggerScheduler}
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl transition duration-200 active:scale-[0.98] shadow-lg flex items-center justify-center gap-1.5 border border-emerald-500/20"
                    >
                      <Activity className="w-3.5 h-3.5 animate-pulse" />
                      {t.triggerScheduler}
                    </button>
                  </div>

                  {/* Dual Broadcast Forms */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    {/* Telegram Broadcast */}
                    <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-3xl space-y-4 flex flex-col">
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-400" />
                          {t.broadcastTgLabel}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          {lang === 'uz'
                            ? 'Telegram bot orqali bog\'langan barcha faol foydalanuvchilarga xabar tarqatish.'
                            : 'Send bulk direct messages to all Telegram bot connected users.'}
                        </p>
                      </div>
                      <textarea
                        value={broadcastTgMessage}
                        onChange={(e) => setBroadcastTgMessage(e.target.value)}
                        placeholder={lang === 'uz' ? 'Xabar matnini yozing...' : 'Enter your broadcast message...'}
                        className="w-full h-32 px-4 py-3 bg-slate-950 border border-slate-800/80 focus:border-indigo-500/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono leading-relaxed"
                      />
                      <button
                        onClick={handleBroadcastTelegram}
                        disabled={!broadcastTgMessage.trim()}
                        className={`w-full py-2.5 rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-1.5 ${
                          broadcastTgMessage.trim()
                            ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:opacity-95 hover:shadow-indigo-500/10 active:scale-[0.98]'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                      >
                        Telegram orqali tarqatish 🚀
                      </button>
                    </div>

                    {/* Email Broadcast */}
                    <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-3xl space-y-4 flex flex-col">
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                          <Mail className="w-4 h-4 text-indigo-400" />
                          {t.broadcastEmailLabel}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          {lang === 'uz'
                            ? 'Barcha ro\'yxatdan o\'tgan leadlarga ommaviy email tarqatish (SMTP/Log).'
                            : 'Send bulk email campaigns to all database leads (SMTP fallback to log file).'}
                        </p>
                      </div>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={broadcastEmailSubject}
                          onChange={(e) => setBroadcastEmailSubject(e.target.value)}
                          placeholder={t.subject}
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800/80 focus:border-indigo-500/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <textarea
                          value={broadcastEmailMessage}
                          onChange={(e) => setBroadcastEmailMessage(e.target.value)}
                          placeholder={t.message}
                          className="w-full h-[76px] px-4 py-3 bg-slate-950 border border-slate-800/80 focus:border-indigo-500/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono leading-relaxed"
                        />
                      </div>
                      <button
                        onClick={handleBroadcastEmail}
                        disabled={!broadcastEmailSubject.trim() || !broadcastEmailMessage.trim()}
                        className={`w-full py-2.5 rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-1.5 ${
                          broadcastEmailSubject.trim() && broadcastEmailMessage.trim()
                            ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:opacity-95 hover:shadow-indigo-500/10 active:scale-[0.98]'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                      >
                        Email orqali tarqatish 📧
                      </button>
                    </div>
                  </div>

                  {/* Broadcast status banner */}
                  {broadcastStatus && (
                    <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-center text-xs font-bold text-indigo-300 animate-pulse">
                      {broadcastStatus}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {allLeads.map(lead => (
                    <div key={lead.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <p className="text-sm font-bold text-slate-200">{lead.email}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-mono text-slate-500">
                            {lead.createdAt && lead.createdAt.seconds ? new Date(lead.createdAt.seconds * 1000).toLocaleString() : (lead.createdAt ? lead.createdAt.toString() : '')}
                          </span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                            lead.status === 'approved' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30' :
                            lead.status === 'rejected' ? 'bg-red-950/50 text-red-400 border-red-500/30' :
                            'bg-amber-950/50 text-amber-400 border-amber-500/30'
                          }`}>{lead.status || 'pending'}</span>
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full uppercase border border-slate-700/50">{lead.role || 'user'}</span>
                          {lead.telegramChatId && (
                            <span className="text-[10px] bg-indigo-950/50 text-indigo-405 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase">TG Linked</span>
                          )}
                        </div>
                      </div>
                      {lead.role !== 'admin' && (
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button onClick={async () => {
                            await updateLeadStatus(lead.email, 'approved');
                            setAllLeads(await getAllLeads());
                          }} className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-[11px] font-bold rounded-lg transition border border-emerald-500/20">
                            Approve ✅
                          </button>
                          <button onClick={async () => {
                            await updateLeadStatus(lead.email, 'rejected');
                            setAllLeads(await getAllLeads());
                          }} className="flex-1 sm:flex-none px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-[11px] font-bold rounded-lg transition border border-red-500/20">
                            Revoke ❌
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ History Tab ═══ */}
          {activeViewTab === 'history' && (
            <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 animate-fade-in-up">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  {lang === 'uz' ? 'Generatsiyalar Tarixi' : 'Generation History'}
                </h3>
                {user && (
                  <span className="text-[10px] bg-indigo-900/30 text-indigo-400 font-extrabold px-3 py-1 rounded-full border border-indigo-500/20">
                    {historyList.length} logs
                  </span>
                )}
              </div>

              {!user ? (
                <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
                  <span className="text-2xl mb-2 block">🔒</span>
                  <h4 className="text-xs font-bold text-slate-200">
                    {lang === 'uz' ? 'Tizimga kiring!' : 'Sign in to access history!'}
                  </h4>
                  <button
                    onClick={handleGoogleLogin}
                    className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition"
                  >
                    🚀 Sign in with Google
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyList.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-6 text-center">
                      {lang === 'uz' ? "Xozircha tarix mavjud emas." : "No history yet."}
                    </p>
                  ) : (
                    historyList.map((log) => (
                      <div key={log.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center hover:bg-slate-800/50 transition cursor-pointer" onClick={() => { setTopic(log.topic); setStyle(log.style as StylePreset); setActiveViewTab('prompts'); }}>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-extrabold text-slate-200 truncate">{log.topic}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5 font-mono">{log.style} • {log.promptsCount} panels</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeViewTab === 'setup' ? (
            /* ═══ Gem Instructions Guide ═══ */
            <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in-up">
              <div className="space-y-2">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-indigo-400" />
                  {t.gemGuideTitle}
                </h2>
                <p className="text-xs text-slate-400">{t.gemGuideDescription}</p>
              </div>

              {/* Pipeline Steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="space-y-1">
                  <p className="text-[11px] font-extrabold text-slate-200 uppercase tracking-wider">{t.stepTitle}</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{t.step1}</p>
                </div>
                <div className="space-y-1 md:border-l md:border-slate-800 md:pl-3">
                  <p className="text-[11px] font-extrabold text-slate-200 uppercase tracking-wider">&nbsp;</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{t.step2}</p>
                </div>
                <div className="space-y-1 md:border-l md:border-slate-800 md:pl-3">
                  <p className="text-[11px] font-extrabold text-slate-200 uppercase tracking-wider">&nbsp;</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{t.step3}</p>
                </div>
              </div>

              {/* Gem Elements */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{t.gemName}</span>
                    <button
                      onClick={() => copyToClipboard('3-Panel Infographic Master', 'name')}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 transition"
                    >
                      {copiedSection === 'name' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSection === 'name' ? t.copyOk : t.copyText}</span>
                    </button>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl font-bold font-mono text-xs text-slate-300">
                    3-Panel Infographic Master
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{t.gemDescription}</span>
                    <button
                      onClick={() => copyToClipboard(t.gemDescription, 'desc')}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 transition"
                    >
                      {copiedSection === 'desc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSection === 'desc' ? t.copyOk : t.copyText}</span>
                    </button>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl font-medium text-[11px] text-slate-400">
                    {lang === 'uz' ? '3 qismli, qat\'iy bir xil o\'lcham va qolipdagi solishtirma infografikalar yaratuvchi dizayner bot.' : 'Generates highly consistent, perfectly scaled 3-panel infographics from textual prompts.'}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{t.gemInstructions}</span>
                    <button
                      onClick={() => copyToClipboard(t.gemInstructValue, 'instruct')}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 transition"
                    >
                      {copiedSection === 'instruct' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSection === 'instruct' ? t.copyOk : t.copyText}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-950 border border-slate-800 text-slate-100 text-[10px] px-4 py-3 rounded-xl block font-mono overflow-auto max-h-48 whitespace-pre-wrap leading-relaxed select-all">
                    {t.gemInstructValue}
                  </pre>
                </div>
              </div>
            </div>
          ) : activeViewTab === 'prompts' && (
            /* ═══ Prompts List View ═══ */
            <div className="space-y-5">
              {/* Error with Retry */}
              {state.error && (
                <div className="p-4 bg-red-950/20 border border-red-500/25 rounded-2xl text-red-400 flex items-center justify-between animate-fade-in-up">
                  <div className="flex items-center space-x-3 min-w-0">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm">{t.errorTitle}</p>
                      <p className="text-xs font-medium mt-0.5 truncate">{state.error}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => formRef.current?.requestSubmit()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-xs font-bold rounded-xl transition flex-shrink-0 ml-3"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t.retryBtn}
                  </button>
                </div>
              )}

              {state.prompts.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-black text-slate-100">{t.promptsReady}</h2>
                    <div className="flex items-center gap-2">
                      {/* Share Button */}
                      <button
                        onClick={handleSharePrompts}
                        className="text-[10px] font-bold px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-indigo-500/30 text-slate-300 rounded-lg transition flex items-center gap-1 hover:-translate-y-0.5 active:scale-95"
                      >
                        <Share2 className="w-3 h-3" />
                        {copiedSection === 'share_link' ? t.shareCopied : t.shareTitle}
                      </button>
                      {/* Duplicate Check Toggle */}
                      <button
                        onClick={() => setShowDuplicateCheck(!showDuplicateCheck)}
                        className={`text-[10px] font-bold px-2.5 py-1.5 border rounded-lg transition flex items-center gap-1 hover:-translate-y-0.5 active:scale-95 ${
                          duplicates.length > 0
                            ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                            : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {duplicates.length > 0 ? '⚠️' : '✅'} {t.duplicateTitle}
                      </button>
                      <span className="bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
                        15 READY
                      </span>
                    </div>
                  </div>

                  {/* Duplicate Check Panel */}
                  {showDuplicateCheck && (
                    <div className={`p-4 rounded-2xl border text-xs font-medium animate-fade-in-up ${
                      duplicates.length > 0
                        ? 'bg-amber-950/20 border-amber-500/20 text-amber-300'
                        : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
                    }`}>
                      {duplicates.length > 0 ? (
                        <div>
                          <p className="font-bold mb-2">{t.duplicateFound}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {duplicates.map((d, i) => (
                              <span key={i} className="bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-500/30">
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p>{t.duplicateClean}</p>
                      )}
                    </div>
                  )}

                  {/* ═══ BATCH DOWNLOADER ═══ */}
                  <div className="p-5 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/30 border border-indigo-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                    <div className="flex items-center space-x-3 text-left w-full md:w-auto relative z-10">
                      <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-100 flex items-center gap-2">
                          {t.batchActions}
                          <span className="text-[9px] bg-indigo-900/40 text-indigo-300 font-extrabold px-2 py-0.5 rounded-full border border-indigo-500/20">
                            15/15
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                          {lang === 'uz'
                            ? 'Barcha 15 ta ssenariyni yuklab oling.'
                            : 'Export all 15 prompts in your preferred format.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end relative z-10">
                      <button
                        onClick={copyAllToClipboard}
                        className={`text-[11px] font-black px-3.5 py-2.5 rounded-xl shadow-lg transition-all flex items-center space-x-1.5 border active:scale-95 ${
                          copiedSection === 'all_prompts'
                            ? 'bg-emerald-600 border-emerald-500 text-white neon-glow-emerald'
                            : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700 hover:-translate-y-0.5'
                        }`}
                      >
                        {copiedSection === 'all_prompts' ? <><Check className="w-3.5 h-3.5" /><span>{t.copiedAll}</span></> : <><Copy className="w-3.5 h-3.5" /><span>{t.copyAll}</span></>}
                      </button>
                      <button
                        onClick={exportAllAsTxt}
                        className="text-[11px] font-black px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-indigo-500/25 rounded-xl transition-all flex items-center space-x-1.5 hover:-translate-y-0.5 active:scale-95"
                      >
                        <span>📥</span><span>{t.downloadAllTxt}</span>
                      </button>
                      <button
                        onClick={exportAllAsJson}
                        className="text-[11px] font-black px-3.5 py-2.5 bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 hover:border-indigo-500/25 rounded-xl transition-all flex items-center space-x-1.5 hover:-translate-y-0.5 active:scale-95"
                      >
                        <span>💻</span><span>{t.downloadAllJson}</span>
                      </button>
                    </div>
                  </div>

                  {/* ═══ PROMPT CARDS ═══ */}
                  <div className="grid grid-cols-1 gap-5">
                    {state.prompts.map((prompt) => (
                      <PromptCard
                        key={prompt.id}
                        index={prompt.id}
                        prompt={prompt}
                        lang={lang}
                        aspectRatio={aspectRatio}
                        onEditPrompt={handleEditPrompt}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!state.isLoading && state.prompts.length === 0 && !state.error && (
                <div className="text-center py-16 px-8 border-2 border-dashed border-slate-800 rounded-3xl opacity-60 animate-fade-in-up">
                  <div className="w-14 h-14 mx-auto bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-4 shadow-inner">
                    <Compass className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-300">{t.emptyTitle}</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    {t.emptyDescription}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ LEAD WALL MODAL ═══ */}
      {showLeadWallModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-3xl p-7 max-w-md w-full border border-slate-800 shadow-2xl relative space-y-5 text-center celebration-pop">
            <button onClick={() => setShowLeadWallModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 font-extrabold text-sm">✕</button>
            <div className="w-12 h-12 bg-indigo-900/30 text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <Mail className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">
                {lang === 'uz' ? 'Cheksiz Arxitekturani Faollashtiring' : 'Unlock Unlimited Generation'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                {lang === 'uz'
                  ? 'Siz kunlik bepul 2 ta generatsiya limitini tugatdingiz. VIP safiga qo\'shiling!'
                  : 'You have used your free allowance. Subscribe to unlock unlimited compilations.'}
              </p>
            </div>
            <form onSubmit={handleEmailSubscriberSubmit} className="space-y-3">
              <input
                type="email"
                required
                placeholder="email@example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/40 bg-slate-950/90 text-slate-200"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-lg active:scale-[0.98]">
                {lang === 'uz' ? "A'zo bo'lish 🚀" : 'Subscribe & Unlock 🚀'}
              </button>
            </form>
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-500 text-[10px] font-bold uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>
            <button onClick={handleGoogleLogin} className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2">
              <span>🔑</span><span>Google bilan kirish</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══ PREMIUM UPGRADE MODAL ═══ */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-3xl p-7 max-w-sm w-full border border-slate-800 shadow-2xl relative space-y-5 text-center celebration-pop">
            <button onClick={() => setShowUpgradeModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 font-extrabold text-sm">✕</button>
            <div className="w-12 h-12 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">★ Premium Stillar</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                {lang === 'uz'
                  ? 'Bu vizual uslub faqat premium foydalanuvchilar uchun.'
                  : 'This visual style is reserved for premium users.'}
              </p>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300">Creator Premium</span>
                <span className="text-sm font-black text-indigo-400">$5/mo</span>
              </div>
              <ul className="text-[10px] text-slate-400 space-y-1 list-disc list-inside font-semibold">
                <li>8 cinematic layout presets</li>
                <li>Batch JSON exports</li>
                <li>Exclusive overlay templates</li>
              </ul>
            </div>
            <div className="space-y-2">
              <button onClick={handleUpgradeToPremium} className="w-full py-3 bg-gradient-to-tr from-amber-500 to-indigo-600 hover:opacity-95 text-slate-950 font-black rounded-xl text-xs transition shadow-lg active:scale-[0.98]">
                {lang === 'uz' ? "Premium bo'lish ⚡" : 'Go Premium ⚡'}
              </button>
              <button onClick={() => setShowUpgradeModal(false)} className="w-full py-2 bg-slate-950 hover:bg-slate-900 text-slate-400 rounded-xl text-xs font-bold transition border border-slate-800">
                {lang === 'uz' ? 'Bepul rejimda qolish' : 'Stay Free'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-16 text-slate-500 text-[10px] text-center border-t border-slate-800 pt-6 max-w-lg mx-auto relative z-10">
        &copy; {new Date().getFullYear()} FutureStats Architect. Premium dark mode with Inter & JetBrains Mono.
      </footer>
    </div>
  );
};

export default App;
