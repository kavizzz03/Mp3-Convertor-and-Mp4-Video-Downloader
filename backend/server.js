import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const youtubedl = require("yt-dlp-exec");

// File path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Ensure downloads folder exists
const DOWNLOAD_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

// Root check
app.get("/", (req, res) => {
  res.send("✅ MP3/MP4 Downloader Backend is running on Render!");
});

// Video info route
app.post("/api/info", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
    });
    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      formats: info.formats
        .filter((f) => f.ext && f.filesize)
        .map((f) => ({
          format_id: f.format_id,
          ext: f.ext,
          resolution: f.height ? `${f.height}p` : "audio",
          filesize: f.filesize,
        })),
    });
  } catch (err) {
    console.error("Error fetching info:", err);
    res.status(500).json({ error: "Failed to fetch video info" });
  }
});

// Download MP4 or MP3
app.post("/api/download", async (req, res) => {
  const { url, format } = req.body;
  if (!url || !format) return res.status(400).json({ error: "Missing parameters" });

  const id = uuidv4();
  const outputPath = path.join(DOWNLOAD_DIR, `${id}.${format === "mp3" ? "mp3" : "mp4"}`);

  try {
    console.log(`Starting ${format.toUpperCase()} download for: ${url}`);

    const ydlOptions =
      format === "mp3"
        ? {
            extractAudio: true,
            audioFormat: "mp3",
            output: outputPath,
          }
        : {
            format: "bestvideo+bestaudio",
            mergeOutputFormat: "mp4",
            output: outputPath,
          };

    await youtubedl(url, ydlOptions);

    // File ready
    res.download(outputPath, (err) => {
      if (err) console.error("Download error:", err);
      fs.unlink(outputPath, () => console.log(`🧹 Deleted: ${outputPath}`));
    });
  } catch (err) {
    console.error("Download failed:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
