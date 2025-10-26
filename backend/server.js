import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import ffmpegPath from "ffmpeg-static";

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.resolve();
const DOWNLOADS_DIR = path.join(__dirname, "downloads");

if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);

const isWindows = process.platform === "win32";
const YT_DLP_PATH = isWindows
  ? path.join(__dirname, "yt-dlp.exe")
  : "yt-dlp";

const FFMPEG_PATH = ffmpegPath;
const downloads = {}; // { id: { progress, filePath, error, format, url } }

// ✅ Start a new download
app.post("/download", (req, res) => {
  const { url, format } = req.body;

  if (!url || !format) {
    return res.status(400).json({ error: "Missing URL or format" });
  }

  const id = uuidv4();
  const outputFile =
    format === "mp3"
      ? path.join(DOWNLOADS_DIR, `${id}.mp3`)
      : path.join(DOWNLOADS_DIR, `${id}.mp4`);

  downloads[id] = {
    progress: 0,
    filePath: outputFile,
    error: false,
    format,
    url,
  };

  console.log(`\n🎬 [${id}] Starting ${format.toUpperCase()} download for: ${url}`);

  // yt-dlp arguments
  const args =
    format === "mp3"
      ? [
          url,
          "--extract-audio",
          "--audio-format",
          "mp3",
          "-o",
          outputFile,
          "--ffmpeg-location",
          FFMPEG_PATH,
        ]
      : [
          url,
          "-f",
          "bestvideo[height<=720]+bestaudio/best[height<=720]",
          "--merge-output-format",
          "mp4",
          "-o",
          outputFile,
          "--ffmpeg-location",
          FFMPEG_PATH,
        ];

  const proc = spawn(YT_DLP_PATH, args);

  // ✅ Realtime progress parser
  proc.stderr.on("data", (data) => {
    const text = data.toString();
    const match = text.match(/(\d+(?:\.\d+)?)%/);

    if (match) {
      const percent = parseFloat(match[1]);
      downloads[id].progress = percent;

      // ✅ show progress on console nicely
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`📥 [${id}] Progress: ${percent.toFixed(1)}%`);
    }
  });

  proc.on("close", (code) => {
    if (code === 0) {
      downloads[id].progress = 100;
      console.log(`\n✅ [${id}] Download complete: ${outputFile}`);
    } else {
      downloads[id].error = true;
      console.log(`\n❌ [${id}] Download failed (code ${code})`);
    }
  });

  proc.on("error", (err) => {
    downloads[id].error = true;
    console.error(`\n❌ [${id}] yt-dlp process error:`, err);
  });

  res.json({ id });
});

// ✅ Progress endpoint (frontend polls this)
app.get("/progress/:id", (req, res) => {
  const id = req.params.id;
  const info = downloads[id];
  if (!info) return res.status(404).json({ error: "Not found" });

  res.json({
    progress: info.progress || 0,
    error: info.error || false,
  });
});

// ✅ Serve and delete file after download
app.get("/downloaded/:id", (req, res) => {
  const id = req.params.id;
  const info = downloads[id];

  if (!info || !fs.existsSync(info.filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.download(info.filePath, path.basename(info.filePath), (err) => {
    if (err) {
      console.error(`[${id}] ❌ Error sending file:`, err);
    } else {
      fs.unlink(info.filePath, (err) => {
        if (err) console.error(`[${id}] ❌ File delete error:`, err);
        else console.log(`🧹 [${id}] File deleted`);
      });
      delete downloads[id];
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);
