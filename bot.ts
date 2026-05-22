import { Telegraf, Context } from 'telegraf';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { updateLeadTelegramChatId } from './services/firebaseService';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; 
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || '';

export let activeBot: Telegraf | null = null;

export async function sendMarketingMessage(chatId: string, text: string): Promise<boolean> {
  if (activeBot) {
    try {
      await activeBot.telegram.sendMessage(chatId, text);
      return true;
    } catch (e) {
      console.error(`[Telegram Marketing] Xabar jo'natish xatosi (Chat ID: ${chatId}):`, e);
      return false;
    }
  }
  console.warn('[Telegram Marketing] Bot ishga tushirilmagan.');
  return false;
}

// If token is missing, we don't start the bot to prevent crashes.
export function initBot() {
  if (!BOT_TOKEN) {
    console.warn('[Telegram Bot] TELEGRAM_BOT_TOKEN topilmadi. Bot ishga tushirilmadi.');
    console.warn('[Telegram Bot] Iltimos, .env faylida TELEGRAM_BOT_TOKEN va ADMIN_CHAT_ID ni sozlang.');
    return;
  }

  const bot = new Telegraf(BOT_TOKEN);
  activeBot = bot;
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const model = 'gemini-3.5-flash';

  // State to track conversation context per user
  const userStates = new Map<number, { email?: string; history: string[]; step: string }>();

  // Helper to get or create state
  const getState = (userId: number) => {
    if (!userStates.has(userId)) {
      userStates.set(userId, { history: [], step: 'chat' });
    }
    return userStates.get(userId)!;
  };

  const systemPrompt = `Siz FutureStats (Infografika va Promtlar platformasi) ning malakali va xushmuomala sotuvchi-menejerisiz. 
Sizning vazifangiz: Mijozlarga platformaning afzalliklarini tushuntirish va ularga VIP obuna sotish. 
Platforma nima qiladi? Mijozlar uchun bir xil uslubdagi 15 xil taqqoslash videolarini (infografika) yaratish uchun Midjourney/AI promptlarini yozib beradi.
VIP Obuna narxi: 150,000 so'm (cheksiz ruxsat).
To'lov usuli: UzCard.
Agar mijoz to'lov qilishga tayyor ekanligini aytsa, unga karta raqamini (💳 5614 6822 1912 1078, Akram F.) yuboring va "To'lov qilingach, chekni (skrinshotni) shu yerga yuboring" deb ayting.
Javoblaringizni qisqa, samimiy va savdo (sales) uslubida bering. O'zbek tilida gaplashing.`;

  bot.start(async (ctx) => {
    const payload = ctx.payload; // Deep link payload
    const state = getState(ctx.from.id);
    
    if (payload) {
      try {
        const email = Buffer.from(payload, 'base64').toString('utf8');
        state.email = email;
        // Save user's chat ID to Firestore
        await updateLeadTelegramChatId(email, ctx.chat.id.toString());
      } catch (e) {
        console.error('Invalid base64 payload', payload, e);
      }
    }

    ctx.reply(`Assalomu alaykum${state.email ? ` (${state.email})` : ''}! \n\nMen FutureStats platformasining menejeriman. Platformadan cheksiz foydalanish uchun obuna sotib olishingiz mumkin. Savollaringiz bormi yoki to'lov qilib faollashtirmoqchimisiz?`);
    state.history.push("Bot: Assalomu alaykum! Men FutureStats platformasining menejeriman...");
  });

  bot.on('photo', async (ctx) => {
    const state = getState(ctx.from.id);
    const emailInfo = state.email ? state.email : 'Noma\'lum email';
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

    ctx.reply("Rahmat! Skrinshotingiz adminga yuborildi. To'lov tasdiqlangach, saytdagi akkauntingiz faollashadi. Buning uchun saytda 'Admin 🛡️' tabidan ruxsat berilishini kuting.");

    if (ADMIN_CHAT_ID) {
      const highestRes = ctx.message.photo[ctx.message.photo.length - 1];
      await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, highestRes.file_id, {
        caption: `💰 Yangi to'lov cheki keldi!\n\nMijoz: ${username}\nEmail: ${emailInfo}\n\nIltimos, tekshirib saytdagi Admin paneldan ruxsat bering.`
      });
    } else {
      console.warn(`[Telegram Bot] ADMIN_CHAT_ID o'rnatilmagan! Chek yetkazilmadi.`);
    }
  });

  bot.on('text', async (ctx) => {
    const state = getState(ctx.from.id);
    const userMsg = ctx.message.text;

    state.history.push(`Mijoz: ${userMsg}`);
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const emailInfo = state.email ? state.email : 'Noma\'lum email';

    // Adminga xabarni yetkazish
    if (ADMIN_CHAT_ID && ctx.from.id.toString() !== ADMIN_CHAT_ID) {
      ctx.telegram.sendMessage(ADMIN_CHAT_ID, `👤 Mijoz (${username} | ${emailInfo}):\n${userMsg}`).catch(console.error);
    }

    // Context formatting for Gemini
    const chatContext = state.history.slice(-10).join("\n");

    try {
      const response = await ai.models.generateContent({
        model,
        contents: `${systemPrompt}\n\nSuhbat tarixi:\n${chatContext}\n\nBot sifatida javob bering (qisqa va lo'nda):`
      });

      const replyText = response.text || "Uzur, nimadir xato ketdi. Qayta urinib ko'ring.";
      state.history.push(`Bot: ${replyText}`);
      
      await ctx.reply(replyText);

      // Adminga botning javobini yetkazish
      if (ADMIN_CHAT_ID && ctx.from.id.toString() !== ADMIN_CHAT_ID) {
        ctx.telegram.sendMessage(ADMIN_CHAT_ID, `🤖 Bot javobi:\n${replyText}`).catch(console.error);
      }
    } catch (e) {
      console.error('[Telegram Bot] Gemini API xatosi:', e);
      ctx.reply("Kechirasiz, hozir xizmat ko'rsatishda vaqtincha uzilish bor. Iltimos, keyinroq yozing.");
    }
  });

  bot.launch().then(() => {
    console.log('[Telegram Bot] Ishga tushdi va xabarlarni kutmoqda...');
  }).catch((err) => {
    console.error('[Telegram Bot] Ishga tushishda xatolik:', err);
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
