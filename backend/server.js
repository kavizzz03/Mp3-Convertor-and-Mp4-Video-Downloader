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

const downloads = {}; // { id: { progress, filePath, error } }

app.post("/download", (req, res) => {
  const { url, format } = req.body;
  const id = uuidv4();

  const outputFile =
    format === "mp3"
      ? path.join(DOWNLOADS_DIR, `${id}.mp3`)
      : path.join(DOWNLOADS_DIR, `${id}.mp4`);

  downloads[id] = { progress: 0, filePath: outputFile, error: false };

  console.log(`[${id}] Starting download (${format}) for: ${url}`);

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
          ffmpegPath,
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
          ffmpegPath,
        ];

  const proc = spawn("yt-dlp", args); // ✅ uses globally installed yt-dlp

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

app.get("/progress/:id", (req, res) => {
  const id = req.params.id;
  const info = downloads[id];
  if (!info) return res.status(404).json({ error: "Not found" });

  res.json({
    progress: info.progress || 0,
    error: info.error || false,
  });
});

app.get("/downloaded/:id", (req, res) => {
  const id = req.params.id;
  const info = downloads[id];

  if (!info || !fs.existsSync(info.filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.download(info.filePath, path.basename(info.filePath), (err) => {
    if (!err) {
      fs.unlink(info.filePath, (e) =>
        e ? console.error(`[${id}] Delete error:`, e) : console.log(`[${id}] File deleted`)
      );
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
