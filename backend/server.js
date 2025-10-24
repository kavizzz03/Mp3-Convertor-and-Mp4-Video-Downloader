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

// ✅ Detect yt-dlp binary depending on OS
const isWindows = process.platform === "win32";
const YT_DLP_PATH = isWindows
  ? path.join(__dirname, "yt-dlp.exe")
  : "yt-dlp"; // Linux/macOS: use global yt-dlp command

// ✅ ffmpeg-static automatically resolves correct binary for platform
const FFMPEG_PATH = ffmpegPath;

// Create downloads folder if it doesn't exist
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);

// In-memory download tracking
const downloads = {}; // { id: { progress, filePath, error } }

// Start download
app.post("/download", (req, res) => {
  const { url, format } = req.body;
  const id = uuidv4();

  const outputFile =
    format === "mp3"
      ? path.join(DOWNLOADS_DIR, `${id}.mp3`)
      : path.join(DOWNLOADS_DIR, `${id}.mp4`);

  downloads[id] = { progress: 0, filePath: outputFile, error: false };

  console.log(`[${id}] Starting download (${format}) for: ${url}`);

  // Choose correct yt-dlp arguments
  const args = (() => {
    if (format === "mp3") {
      return [
        url,
        "--extract-audio",
        "--audio-format",
        "mp3",
        "-o",
        outputFile,
        "--ffmpeg-location",
        FFMPEG_PATH,
      ];
    } else {
      if (url.includes("youtube.com") || url.includes("youtu.be")) {
        return [
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
      } else {
        // Instagram / Facebook fallback
        return [
          url,
          "-f",
          "bestvideo+bestaudio/best",
          "--merge-output-format",
          "mp4",
          "-o",
          outputFile,
          "--ffmpeg-location",
          FFMPEG_PATH,
        ];
      }
    }
  })();

  const proc = spawn(YT_DLP_PATH, args);

  proc.stderr.on("data", (data) => {
    const text = data.toString();
    const match = text.match(/(\d+\.\d+)%/);
    if (match) downloads[id].progress = parseFloat(match[1]);
    console.log(`[${id}] ${text}`);
  });

  proc.on("close", (code) => {
    if (code === 0) {
      downloads[id].progress = 100;
      console.log(`[${id}] ✅ Download complete`);
    } else {
      downloads[id].error = true;
      console.log(`[${id}] ❌ Download failed with code ${code}`);
    }
  });

  proc.on("error", (err) => {
    downloads[id].error = true;
    console.error(`[${id}] ❌ Failed to start yt-dlp:`, err);
  });

  res.json({ id });
});

// Progress endpoint
app.get("/progress/:id", (req, res) => {
  const id = req.params.id;
  const info = downloads[id];
  if (!info) return res.status(404).json({ error: "Not found" });

  res.json({
    progress: info.progress || 0,
    error: info.error || false,
  });
});

// Serve and delete file after download
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
        if (err) console.error(`[${id}] ❌ Error deleting file:`, err);
        else console.log(`[${id}] ✅ File deleted`);
      });
      delete downloads[id];
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
