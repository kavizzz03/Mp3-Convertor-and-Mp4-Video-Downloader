import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ytdlpExec from "yt-dlp-exec"; // use programmatically
import ffmpegPath from "ffmpeg-static";

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.resolve();
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);

const downloads = {}; // in-memory tracking

app.post("/download", async (req, res) => {
  const { url, format } = req.body;
  const id = uuidv4();
  const outputFile =
    format === "mp3"
      ? path.join(DOWNLOADS_DIR, `${id}.mp3`)
      : path.join(DOWNLOADS_DIR, `${id}.mp4`);

  downloads[id] = { progress: 0, filePath: outputFile, error: false };

  console.log(`[${id}] Starting download (${format}) for: ${url}`);

  try {
    const ytdlpProcess = ytdlpExec(
      url,
      {
        ffmpegLocation: ffmpegPath,
        extractAudio: format === "mp3",
        audioFormat: format === "mp3" ? "mp3" : undefined,
        format: format === "mp4" ? "bestvideo[height<=720]+bestaudio/best[height<=720]" : undefined,
        output: outputFile,
        progressHook: (progress) => {
          if (progress?.percent) {
            downloads[id].progress = progress.percent;
            console.log(`[${id}] Progress: ${downloads[id].progress.toFixed(1)}%`);
          }
        },
      },
      { stdio: "inherit" } // logs everything to console
    );

    ytdlpProcess
      .then(() => {
        downloads[id].progress = 100;
        console.log(`[${id}] ✅ Download complete`);
      })
      .catch((err) => {
        downloads[id].error = true;
        console.error(`[${id}] ❌ Download failed`, err);
      });

    res.json({ id });
  } catch (err) {
    downloads[id].error = true;
    console.error(`[${id}] ❌ Failed to start download`, err);
    res.status(500).json({ error: "Failed to start download" });
  }
});

app.get("/progress/:id", (req, res) => {
  const info = downloads[req.params.id];
  if (!info) return res.status(404).json({ error: "Not found" });
  res.json({ progress: info.progress || 0, error: info.error || false });
});

app.get("/downloaded/:id", (req, res) => {
  const info = downloads[req.params.id];
  if (!info || !fs.existsSync(info.filePath)) return res.status(404).json({ error: "File not found" });

  res.download(info.filePath, path.basename(info.filePath), (err) => {
    if (err) console.error(`[${req.params.id}] ❌ Error sending file`, err);
    else {
      fs.unlink(info.filePath, () => console.log(`[${req.params.id}] ✅ File deleted from server`));
      delete downloads[req.params.id];
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
