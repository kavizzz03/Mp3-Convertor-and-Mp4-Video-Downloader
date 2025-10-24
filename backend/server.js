import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ffmpegPath from "ffmpeg-static";
import youtubedl from "yt-dlp-exec";

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.resolve();
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);

const downloads = {};

app.post("/download", async (req, res) => {
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
          "bestvideo+bestaudio/best",
          "--merge-output-format",
          "mp4",
          "-o",
          outputFile,
          "--ffmpeg-location",
          ffmpegPath,
        ];

  try {
    await youtubedl(url, {
      execArgs: args,
    });
    downloads[id].progress = 100;
    console.log(`[${id}] ✅ Download complete`);
  } catch (err) {
    downloads[id].error = true;
    console.error(`[${id}] ❌ Download failed:`, err);
  }

  res.json({ id });
});

app.get("/downloaded/:id", (req, res) => {
  const id = req.params.id;
  const info = downloads[id];

  if (!info || !fs.existsSync(info.filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.download(info.filePath, path.basename(info.filePath), (err) => {
    if (!err) fs.unlinkSync(info.filePath);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
