// index.js
// 🎥 Telegram Downloader Bot (By EMon-BHai)
// ✅ Render / Termux Compatible (Polling Mode)

import express from "express";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import fetch from "node-fetch";
import nayan from "nayan-media-downloaders";

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

const DOWNLOAD_PATH = "/tmp/EmonDownloader";
fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });

let bots = {}; // runtime bot storage

// ---------- Load saved bots ----------
function loadBots() {
  try {
    if (fs.existsSync("./bots.json")) {
      const data = JSON.parse(fs.readFileSync("./bots.json", "utf8"));
      for (const botInfo of data.bots || []) {
        if (botInfo.token && !bots[botInfo.token]) {
          startBot(botInfo.token, botInfo.name);
        }
      }
      console.log(`✅ Loaded ${data.bots?.length || 0} bots from bots.json`);
    } else {
      console.log("⚠️ No bots.json found. Please add your tokens.");
    }
  } catch (e) {
    console.error("❌ Failed to load bots:", e.message);
  }
}

// ---------- Download video/audio ----------
async function downloadVideo(url, format = "best") {
  const result = await nayan.alldown(url);
  if (!result?.data) throw new Error("No downloadable video found");

  let mediaUrl = format === "audio" ? result.data.audio || result.data.high : result.data.high;
  if (!mediaUrl) throw new Error("No media URL found!");

  const fileExt = format === "audio" ? "mp3" : "mp4";
  const filePath = `${DOWNLOAD_PATH}/EmonMedia_${Date.now()}.${fileExt}`;

  const response = await fetch(mediaUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// ---------- Start Telegram Bot ----------
function startBot(token, name = "Bot") {
  if (bots[token]) {
    try { bots[token].stopPolling(); } catch {}
  }

  const bot = new TelegramBot(token, { polling: true });
  bots[token] = bot;

  console.log(`🤖 Started Bot: ${name} (${token.slice(0, 10)}...)`);

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `
🎉 *Welcome to ${name}!*
Send me any video link to download 🎬 or 🎵
`, { parse_mode: "Markdown" });
  });

  bot.on("message", async (msg) => {
    const text = msg.text;
    if (!text || text.startsWith("/")) return;
    if (!text.startsWith("http"))
      return bot.sendMessage(msg.chat.id, "⚠️ Please send a valid video link.");

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🎥 Video", callback_data: `video|${text}` },
            { text: "🎵 Audio", callback_data: `audio|${text}` },
          ],
        ],
      },
    };
    bot.sendMessage(msg.chat.id, "Select format:", opts);
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const [choice, url] = query.data.split("|");
    bot.answerCallbackQuery(query.id);
    bot.sendMessage(chatId, "⏬ Downloading, please wait...");

    try {
      const filepath = await downloadVideo(url, choice === "audio" ? "audio" : "best");
      if (fs.existsSync(filepath)) {
        if (choice === "audio") {
          await bot.sendAudio(chatId, filepath, { caption: `✅ Audio Ready by EMon-BHai` });
        } else {
          await bot.sendVideo(chatId, filepath, { caption: `✅ Video Ready by EMon-BHai` });
        }
      } else bot.sendMessage(chatId, "❌ Download failed.");
    } catch (e) {
      bot.sendMessage(chatId, `⚠️ Error: ${e.message}`);
    }
  });
}

// ---------- Simple Web UI ----------
app.get("/", (req, res) => {
  res.send(`
  <html>
  <head><title>Emon SubBot</title></head>
  <body style="background:#000;color:#0ff;text-align:center;font-family:monospace;">
  <h2>🤖 EMon SubBot is Running!</h2>
  <p>Loaded Bots: ${Object.keys(bots).length}</p>
  </body></html>
  `);
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  loadBots();
});
