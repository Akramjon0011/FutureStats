import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initBot, sendMarketingMessage } from './bot';
import { 
  getAllLeads, 
  getUnsubscribedOrPendingLeads, 
  saveCampaignHistory 
} from './services/firebaseService';

const app = express();
const PORT = 3000;

// Body parsing middlewares
app.use(express.json());

// ---------------------------------------------------------------------------
// In-memory rate limiter – no external dependencies
// Allows max 10 requests per 60-second window per IP address.
// Old entries are garbage-collected every 5 minutes.
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000;  // 1 minute
const RATE_LIMIT_MAX = 10;            // max requests per window

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup of stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60_000);

function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = rateLimitStore.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(ip, entry);
  }

  // Drop timestamps outside the current window
  entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (entry.timestamps.length >= RATE_LIMIT_MAX) {
    res.status(429).json({
      error: "So'rovlar cheklangan – bir daqiqada 10 tadan ortiq so'rov yuborib bo'lmaydi. " +
             'Rate limit exceeded – maximum 10 requests per minute. Please try again shortly.'
    });
    return;
  }

  entry.timestamps.push(now);
  next();
}

// ---------------------------------------------------------------------------
// Input validation constants
// ---------------------------------------------------------------------------
const VALID_PREDICTION_YEARS = ['2026', '2030', '2040', '2050'] as const;
const VALID_SORTING_ORDERS   = ['Ascending', 'Descending'] as const;
const VALID_ASPECT_RATIOS    = ['16:9 Landscape', '9:16 Portrait', '1:1 Square'] as const;

/**
 * Validates the request body for the /api/generate endpoint.
 * Returns an error message string if validation fails, or null if the input is valid.
 */
function validateGenerateInput(body: Record<string, unknown>): string | null {
  // --- topic ---
  if (body.topic === undefined || body.topic === null) {
    return 'Mavzu kiritilishi shart ("topic" is required).';
  }
  if (typeof body.topic !== 'string' || body.topic.trim().length === 0) {
    return 'Mavzu bo\'sh bo\'lmasligi kerak ("topic" must be a non-empty string).';
  }
  if (body.topic.trim().length > 500) {
    return 'Mavzu 500 belgidan oshmasligi kerak ("topic" must be at most 500 characters).';
  }

  // --- style ---
  if (body.style !== undefined && body.style !== null) {
    if (typeof body.style !== 'string') {
      return '"style" matn bo\'lishi kerak ("style" must be a string).';
    }
    if (body.style.length > 100) {
      return '"style" 100 belgidan oshmasligi kerak ("style" must be at most 100 characters).';
    }
  }

  // --- predictionYear ---
  if (body.predictionYear !== undefined && body.predictionYear !== null) {
    if (!VALID_PREDICTION_YEARS.includes(body.predictionYear as any)) {
      return `"predictionYear" quyidagilardan biri bo'lishi kerak: ${VALID_PREDICTION_YEARS.join(', ')}. ` +
             `("predictionYear" must be one of: ${VALID_PREDICTION_YEARS.join(', ')}).`;
    }
  }

  // --- sortingOrder ---
  if (body.sortingOrder !== undefined && body.sortingOrder !== null) {
    if (!VALID_SORTING_ORDERS.includes(body.sortingOrder as any)) {
      return `"sortingOrder" quyidagilardan biri bo'lishi kerak: ${VALID_SORTING_ORDERS.join(', ')}. ` +
             `("sortingOrder" must be one of: ${VALID_SORTING_ORDERS.join(', ')}).`;
    }
  }

  // --- aspectRatio ---
  if (body.aspectRatio !== undefined && body.aspectRatio !== null) {
    if (!VALID_ASPECT_RATIOS.includes(body.aspectRatio as any)) {
      return `"aspectRatio" quyidagilardan biri bo'lishi kerak: ${VALID_ASPECT_RATIOS.join(', ')}. ` +
             `("aspectRatio" must be one of: ${VALID_ASPECT_RATIOS.join(', ')}).`;
    }
  }

  return null; // all good
}

/**
 * Validates that the Gemini response matches the expected 15-prompt structure.
 * Returns an error message string if validation fails, or null if valid.
 */
function validateGenerateResponse(data: unknown): string | null {
  if (!data || typeof data !== 'object' || !('prompts' in (data as any))) {
    return 'Gemini javobi kutilgan formatda emas – "prompts" massivi topilmadi. ' +
           '(Response missing "prompts" array.)';
  }

  const prompts = (data as any).prompts;
  if (!Array.isArray(prompts)) {
    return '"prompts" massiv bo\'lishi kerak. ("prompts" must be an array.)';
  }

  if (prompts.length !== 15) {
    return `Kutilgan 15 ta prompt, lekin ${prompts.length} ta qaytarildi. ` +
           `(Expected exactly 15 prompts, received ${prompts.length}.)`;
  }

  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    if (!p || typeof p.content !== 'string' || p.content.trim().length === 0) {
      return `Prompt #${i + 1} da "content" matn topilmadi. ` +
             `(Prompt #${i + 1} is missing a valid "content" string.)`;
    }
    if (!Array.isArray(p.panels)) {
      return `Prompt #${i + 1} da "panels" massiv bo'lishi kerak. ` +
             `(Prompt #${i + 1} "panels" must be an array.)`;
    }
    if (p.panels.length !== 3) {
      return `Prompt #${i + 1} da aynan 3 ta panel kutilgan, lekin ${p.panels.length} ta qaytarildi. ` +
             `(Prompt #${i + 1} expected 3 panels, received ${p.panels.length}.)`;
    }
  }

  return null; // valid
}

// Initialize Google Gen AI with safe fallback keys and proper telemetry user-agent header
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

/**
 * REST API Endpoint: POST /api/generate
 * Secure server-side proxy to protect API keys and encapsulate complex business logic
 */
app.post('/api/generate', rateLimiter, async (req, res) => {
  // ---- Input validation ----
  const validationError = validateGenerateInput(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { 
    style, 
    predictionYear = '2026', 
    sortingOrder = 'Ascending', 
    aspectRatio = '16:9 Landscape' 
  } = req.body;
  const topic = (req.body.topic as string).trim();

  // NOTE: topic presence/format is already validated above by validateGenerateInput()

  // Request timing start
  const startTime = Date.now();
  const requestMeta = { topic, style, predictionYear, sortingOrder, aspectRatio };
  console.log('[Generate] Request received:', JSON.stringify(requestMeta));

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'GEMINI_API_KEY konfiguratsiya qilinmagan. Iltimos, Settings > Secrets panelidan tekshiring.' 
    });
  }

  // Model selection
  const model = 'gemini-3.5-flash';

  const systemInstruction = `You are a FUTURIST DATA ANALYST & PROMPT ARCHITECT.
Your task is to generate 15 distinct, non-overlapping image prompts for a 15-part partitioned comparison infographic series.

CRITICAL ARCHITECTURE RULES FOR 15-PART SERIES (ABSOLUTELY ZERO REPETITIONS - STRICT PARTITIONING):
1. NO SLIDING WINDOWS & NO OVERLAPPING SUBJECTS ACROSS PROMPTS: Every single prompt in the 15-prompt series must compare a COMPLETELY UNIQUE set of 3 subjects/entities. Under no circumstances should the same person, brand, or subject repeat across different prompts.
   - Prompt 1 MUST compare Subjects 1, 2, and 3 (ranks 1-3).
   - Prompt 2 MUST compare Subjects 4, 5, and 6 (ranks 4-6).
   - Prompt 3 MUST compare Subjects 7, 8, and 9 (ranks 7-9).
   - ...
   - Prompt 15 MUST compare Subjects 43, 44, and 45 (ranks 43-45).
   - There must be absolutely zero overlap between Prompt N and Prompt N+1. Prompt 2 must not contain any subject from Prompt 1. All 45 subjects across the entire 15 prompts must be completely distinct from one another.
   - In total, across all 15 prompts, you must generate 45 entirely unique, distinct subjects and comparative data points (15 prompts * 3 panels = 45 unique subjects in total).
   - This ensures that there are ZERO repetitions of people or items in the entire compilation.
   
CRITICAL DATA CONFIGURATION:
1. DATE: Project all statistics for the year **${predictionYear}** (e.g. February 1, ${predictionYear}).
2. SORTING ORDER: **${sortingOrder.toUpperCase()}**. 
   - If ASCENDING: Start with the entity having the **LOWEST** projected value and end with the **HIGHEST** projected value (Lowest to Highest).
   - If DESCENDING: Start with the entity having the **HIGHEST** projected value and end with the **LOWEST** projected value (Highest to Lowest).
   - Example sequence for ASCENDING: 10M -> 50M -> 100M -> 500M -> 1B.
   - Example sequence for DESCENDING: 1B -> 500M -> 100M -> 50M -> 10M.
3. REAL-WORLD DATA BASING (STRICT FACT-CHECKING):
   - You MUST query Google Search to get the latest real-world actual statistics of today (May 22, 2026) for the given topic and subjects.
   - For example, if the topic is Instagram followers as of May 22, 2026:
     - Cristiano Ronaldo has exactly ~664.6M followers (NEVER use outdated 720M projections).
     - Lionel Messi has exactly ~506M followers (NEVER use outdated 580M projections).
     - Selena Gomez has exactly ~406M followers (NEVER use outdated 480M projections).
   - Base all comparative projections for ${predictionYear} on these actual live numbers from Google Search. Ensure all rankings are 100% accurate and aligned with these actual numbers.

GLOBAL RULES:
- Aspect Ratio: ${aspectRatio} (a 3-panel structure matching this layout).
- Style: ${style}.
- STRICT STRUCTURAL CONSISTENCY: Every single panel must have the exact same layout, proportions, and camera framing. The portraits must be identical in scale (e.g., all waist-up medium shots, perfectly centered, same head size, same eye level).

CRITICAL SAFETY & BRAND FILTER COMPLIANCE (AVOID THIRD-PARTY BLOCKS):
- For the Text Banner (under '- Banner: ...'), you MUST use the actual real name of the subject (e.g., "KEIRA KNIGHTLEY", "CRISTIANO RONALDO", "FERRARI", "MCDONALD'S") in bold uppercase, so that the image generator renders the correct real name on the infographic.
- For the Image illustration (under '- Image: ...'), you MUST NEVER use trademarked brand names or real celebrity names directly. Instead, translate them into highly descriptive, copyright-friendly generic visual alternatives.
  - Examples:
    - Instead of "Ferrari", describe it visually as "a sleek racing-red luxury high-performance Italian sports car with an elegant aerodynamic body".
    - Instead of "Keira Knightley", describe it visually as "an elegant British actress with classic features and medium brown hair".
    - Instead of "Cristiano Ronaldo", describe it visually as "a legendary Portuguese football maestro with a light beard wearing a red jersey".
    - Instead of "McDonald's", describe it visually as "a modern generic fast-food restaurant with bright golden arches".
- IMPORTANT: In the 'panels' array metadata (which is used for the UI preview and data labels, not the image prompt), you MUST keep the real names (e.g. "Keira Knightley", "Cristiano Ronaldo") to preserve user-friendly chart labels.

MANDATORY LAYOUT TEMPLATE FOR EVERY PROMPT:
"A professional 3-panel infographic (${aspectRatio}).
Style: ${style}. Data: ${predictionYear} Projection (${sortingOrder} Order).
STRICT RULE: Panel 1 serves as the master visual template. All subsequent panels MUST perfectly mirror Panel 1's structural layout, portrait scale, and framing.

Panel 1 (MASTER TEMPLATE):
- Header: '[Country Name]' in bold white sans-serif on grey bar.
- Flag: Large shield-shaped [Country] flag, silver metallic border.
- Banner: Navy blue bar containing text: '[Real Subject Name] | [${predictionYear} Estimated Stat]' in bold white uppercase (e.g., 'KEIRA KNIGHTLEY | 75M').
- Image: White-bordered frame containing a detailed [Style] illustration of [Copyright-Friendly Visual Description of Subject]. STRICT FRAMING: Front-facing portrait, medium shot (waist-up), perfectly centered, identical eye-level camera angle, plain parchment background.

Panel 2: (Use Panel 1 as the exact visual template. Repeat exact layout and framing with new Country/Subject + ${predictionYear} Stat, using real name for the banner text and descriptive visual for the image)
Panel 3: (Use Panel 1 as the exact visual template. Repeat exact layout and framing with new Country/Subject + ${predictionYear} Stat, using real name for the banner text and descriptive visual for the image)

CONSISTENCY ENFORCEMENT:
- Ensure the '${predictionYear} Estimated Stat' is clearly visible in the prompt description for the banner.
- Maintain the silver shield and navy banner aesthetic."

Output format:
Return a JSON object with a 'prompts' array containing exactly 15 objects.
Each object must represent one of the 15 images in the series and contain:
- 'content': The complete image generation prompt (string) in English following the MANDATORY LAYOUT TEMPLATE.
- 'panels': An array of EXACTLY 3 panel objects detailing the specific structured metadata for making a live visual preview:
  1. 'country': Country name (string)
  2. 'countryCode': ISO 2-letter country code (string, e.g. "US", "GB", "UZ", "BR", "TT")
  3. 'flagEmoji': Flag Emoji (string, like "🇺🇸" or "🇺🇿")
  4. 'subject': The person/entity name (string)
  5. 'statistic': ${predictionYear} Estimated Statistic/Value (string)
  6. 'description': Detailed description of the character/portrait styling in English (string, 1-2 sentences)`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Topic: "${topic}". Style: "${style}". Generate exactly 15 partitioned comparison infographic image prompts. 
CRITICAL REQUIREMENT: ABSOLUTELY ZERO REPETITIONS AND NO SLIDING WINDOWS. Every single prompt must compare completely unique subjects from all other prompts. Do NOT repeat any subject across different prompts. 
Specifically:
- Prompt 1 compares ranks 1, 2, and 3.
- Prompt 2 compares ranks 4, 5, and 6.
- Prompt 3 compares ranks 7, 8, and 9.
- ...
- Prompt 15 compares ranks 43, 44, and 45.
There must be exactly 45 unique comparative entities in total across the entire set of 15 prompts (15 prompts * 3 panels). Make sure the 'panels' array has EXACTLY 3 items in every prompt. Predict ${predictionYear} stats. Sort ${sortingOrder.toUpperCase()}.`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  content: { type: Type.STRING },
                  panels: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        country: { type: Type.STRING },
                        countryCode: { type: Type.STRING },
                        flagEmoji: { type: Type.STRING },
                        subject: { type: Type.STRING },
                        statistic: { type: Type.STRING },
                        description: { type: Type.STRING }
                      },
                      required: ["country", "countryCode", "flagEmoji", "subject", "statistic", "description"]
                    }
                  }
                },
                required: ["content", "panels"]
              }
            }
          },
          required: ["prompts"]
        }
      }
    });

    const elapsedMs = Date.now() - startTime;
    console.log(`[Generate] Gemini API responded in ${elapsedMs}ms for topic: "${topic}"`);

    const data = JSON.parse(response.text || '{"prompts":[]}');

    // ---- Response validation ----
    const responseError = validateGenerateResponse(data);
    if (responseError) {
      console.error(`[Generate] Response validation failed (${elapsedMs}ms):`, responseError);
      return res.status(502).json({
        error: `Gemini javobini tekshirishda xatolik: ${responseError}`
      });
    }

    res.json(data);
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime;
    // Log structured error metadata without exposing the API key
    console.error('[Generate] Gemini API Error:', {
      message: err.message || 'Unknown error',
      status: err.status || err.statusCode,
      topic,
      style,
      elapsedMs
    });
    res.status(500).json({ 
      error: `Gemini so'rovida xatolik yuz berdi: ${err.message || 'Tizim xatoligi (Internal Server Error)'}` 
    });
  }
});

// ---------------------------------------------------------------------------
// EMAIL MARKETING DISPATCHER (SMTP/File fallback)
// ---------------------------------------------------------------------------
async function sendMarketingEmail(email: string, subject: string, message: string): Promise<boolean> {
  const scratchDir = path.join(process.cwd(), 'scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  const logFilePath = path.join(scratchDir, 'marketing_emails.log');
  const logEntry = `================================================================================
[${new Date().toLocaleString()}] TO: ${email}
SUBJECT: ${subject}
MESSAGE:
${message}
================================================================================\n\n`;

  try {
    fs.appendFileSync(logFilePath, logEntry);
    console.log(`[Email Marketing] Sent email to ${email} (Logged to scratch/marketing_emails.log)`);
    return true;
  } catch (e) {
    console.error('[Email Marketing] Error saving log:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// AUTOMATED BACKGROUND MARKETING SCHEDULER
// ---------------------------------------------------------------------------
async function runSchedulerCheck() {
  console.log('[Marketing Scheduler] Running check for pending leads...');
  try {
    const leads = await getUnsubscribedOrPendingLeads();
    const now = Date.now();

    for (const lead of leads) {
      if (!lead.email) continue;

      // Calculate time elapsed since creation
      const createdAtDate = lead.createdAt instanceof Date ? lead.createdAt : new Date(lead.createdAt || now);
      const hoursSinceCreation = (now - createdAtDate.getTime()) / (1000 * 60 * 60);
      const sentCampaigns = lead.sentCampaigns || [];

      // 1. Day 1 Campaign (24 hours or immediate test if simulated)
      if (hoursSinceCreation >= 24 && !sentCampaigns.includes('day1_nurture')) {
        const subject = "FutureStats yordamida virusli infografikalar yaratish sirlari! 🚀";
        const emailMsg = `Salom!\n\nFutureStats platformasidan ro'yxatdan o'tganingiz uchun rahmat! Reels, TikTok va Shorts videolaringiz uchun 15 qismli mukammal infografika ssenariylarini yaratishga ulgurdingizmi?\n\nAI rasm botini (Gem) sozlash va Midjourney/Gemini promptlaridan maksimal foydalanish bo'yicha ko'rsatmalarni ko'rish uchun saytdagi 'Gem Qo'llanmasi' bo'limiga kiring.\n\nPremium xususiyatlar va barcha presets mavzularga kirish uchun hoziroq VIP obunani faollashtiring!`;
        const tgMsg = `🚀 FutureStats yordamida virusli infografikalar yaratish sirlari!\n\nSalom!\n\nFutureStats platformasidan ro'yxatdan o'tganingiz uchun rahmat! Reels, TikTok va Shorts videolaringiz uchun 15 qismli mukammal infografika ssenariylarini yaratishga ulgurdingizmi?\n\nAI rasm botini (Gem) sozlash ko'rsatmalari uchun saytdagi 'Gem Qo'llanmasi' bo'limiga kiring.\n\nPremium xususiyatlarga kirish uchun hoziroq VIP obunani faollashtiring! ✨`;

        if (lead.telegramChatId) {
          await sendMarketingMessage(lead.telegramChatId, tgMsg);
        }
        await sendMarketingEmail(lead.email, subject, emailMsg);
        await saveCampaignHistory(lead.email, 'day1_nurture');
      }

      // 2. Day 3 Campaign (72 hours)
      if (hoursSinceCreation >= 72 && !sentCampaigns.includes('day3_discount')) {
        const subject = "🎁 Faqat siz uchun: VIP obunaga 30% maxsus chegirma! 💳";
        const emailMsg = `Salom!\n\nFutureStats platformasidan premium rejimda to'liq va cheksiz foydalanishingiz uchun faqatgina bugun sizga 30% chegirma taqdim etamiz!\n\nVIP obunani 150 000 so'm o'rniga atigi **99 000 so'm** to'lab umrbod faollashtirishingiz mumkin.\n\nTo'lov ma'lumotlari:\n💳 Karta raqam: 5614 6822 1912 1078 (Akramjon F.)\n\nTo'lovdan so'ng, chekni (skrinshotni) bizning Telegram botimizga (@FutureStats_bot) yuboring va saytingiz darhol faollashadi!`;
        const tgMsg = `🎁 Faqat siz uchun maxsus taklif! VIP obunaga 30% chegirma!\n\nFutureStats platformasidan premium rejimda to'liq va cheksiz foydalanishingiz uchun faqatgina bugun sizga 30% chegirma taqdim etamiz!\n\nVIP obunani 150 000 so'm o'rniga atigi 99 000 so'm to'lab umrbod faollashtirishingiz mumkin.\n\nTo'lov qilish uchun:\n💳 Karta: 5614 6822 1912 1078 (Akramjon F.)\n\nTo'lov qilgach, chekni (skrinshotni) shu chatga yuboring va saytingiz darhol faollashadi! ✨`;

        if (lead.telegramChatId) {
          await sendMarketingMessage(lead.telegramChatId, tgMsg);
        }
        await sendMarketingEmail(lead.email, subject, emailMsg);
        await saveCampaignHistory(lead.email, 'day3_discount');
      }
    }
  } catch (e) {
    console.error('[Marketing Scheduler] Error during background check:', e);
  }
}

function startMarketingScheduler() {
  console.log('[Marketing Scheduler] Background automated campaigns job initialized.');
  // Run checks immediately, and then every 1 hour
  runSchedulerCheck().catch(console.error);
  setInterval(() => {
    runSchedulerCheck().catch(console.error);
  }, 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// ADMIN MARKETING API ENDPOINTS
// ---------------------------------------------------------------------------

// Retrieve growth and connection statistics
app.get('/api/admin/marketing-metrics', async (req, res) => {
  try {
    const leads = await getAllLeads();
    const totalLeads = leads.length;
    const connectedTelegram = leads.filter(l => l.telegramChatId).length;
    const unsubscribedPending = leads.filter(l => l.role !== 'admin' && l.status !== 'approved').length;

    res.json({
      totalLeads,
      connectedTelegram,
      unsubscribedPending
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Xatolik yuz berdi' });
  }
});

// Mass-broadcast messaging to Telegram leads
app.post('/api/admin/broadcast-telegram', async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Xabar matni kiritilishi shart ("message" is required).' });
  }

  try {
    const leads = await getUnsubscribedOrPendingLeads();
    const targets = leads.filter(l => l.telegramChatId);
    let successCount = 0;

    for (const lead of targets) {
      const success = await sendMarketingMessage(lead.telegramChatId, message);
      if (success) {
        successCount++;
        await saveCampaignHistory(lead.email, `broadcast_tg_${Date.now()}`);
      }
    }

    res.json({
      success: true,
      message: `Ommaviy Telegram xabari yuborildi. Jami: ${targets.length} tadan ${successCount} tasiga yetkazildi.`
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Broadcast failed' });
  }
});

// Mass-broadcast messaging to Email leads
app.post('/api/admin/broadcast-email', async (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ error: 'Mavzu va xabar matni bo\'sh bo\'lmasligi kerak.' });
  }

  try {
    const leads = await getUnsubscribedOrPendingLeads();
    let successCount = 0;

    for (const lead of leads) {
      if (lead.email) {
        const success = await sendMarketingEmail(lead.email, subject, message);
        if (success) {
          successCount++;
          await saveCampaignHistory(lead.email, `broadcast_email_${Date.now()}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Ommaviy Email xabari yuborildi. Jami: ${leads.length} tadan ${successCount} tasiga yetkazildi.`
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Broadcast failed' });
  }
});

// Admin command to manually trigger the scheduler checks (mostly for demo/testing)
app.post('/api/admin/trigger-scheduler', async (req, res) => {
  try {
    await runSchedulerCheck();
    res.json({ success: true, message: 'Marketing scheduler successfully run.' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Serve frontend assets using Vite dev server middleware in dev, static files in production
async function setupVite() {
  // Initialize Telegram Bot
  initBot();

  // Start Background Marketing Campaigns
  startMarketingScheduler();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FutureStats Server] Running on http://localhost:${PORT} with full-stack layered architecture.`);
  });
}

// Export the Express app instance for Vercel/serverless deployments
export default app;

if (!process.env.VERCEL) {
  setupVite().catch((err) => {
    console.error('Server start failed:', err);
  });
} else {
  // In serverless environments, initialize the Telegram bot if needed
  initBot();
}
