import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { execFile } from "child_process";
import ffmpegPath from "ffmpeg-static";
import ytdlp from "yt-dlp-exec";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const downloadsDir = "./downloads";
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

const progressMap = {};
const fileMap = {};

app.post("/download", async (req, res) => {
  const { url, format } = req.body;
  if (!url || !format) return res.status(400).json({ error: "Missing url or format" });

  const id = uuidv4();
  const outputBase = path.join(downloadsDir, id);
  progressMap[id] = 0;

  const ytdlpArgs = [
    url,
    "--ffmpeg-location", ffmpegPath,
    "-o", `${outputBase}.%(ext)s`
  ];

  if (format === "mp3") {
    ytdlpArgs.push("-x", "--audio-format", "mp3");
  } else {
    ytdlpArgs.push("-f", "bestvideo+bestaudio");
  }

  ytdlp(ytdlpArgs, {
    stdio: "pipe",
    onProgress: (prog) => {
      if (prog.percent) progressMap[id] = parseFloat(prog.percent);
      console.log(`[${id}] Progress: ${progressMap[id]}%`);
    }
  }).then(() => {
    const filePath = format === "mp3" ? `${outputBase}.mp3` : `${outputBase}.mp4`;
    fileMap[id] = { path: filePath, ext: format };
    progressMap[id] = 100;
    console.log(`[${id}] ✅ File ready: ${filePath}`);
  }).catch((err) => {
    console.error(`[${id}] Download error:`, err);
    delete progressMap[id];
  });

  res.json({ id });
});

app.get("/progress/:id", (req, res) => {
  const id = req.params.id;
  res.json({ progress: progressMap[id] ?? 100 });
});

app.get("/file/:id", (req, res) => {
  const id = req.params.id;
  const info = fileMap[id];
  if (!info || !fs.existsSync(info.path)) return res.status(404).json({ error: "File not ready" });

  res.setHeader("Content-Disposition", `attachment; filename="download.${info.ext}"`);
  const stream = fs.createReadStream(info.path);
  stream.pipe(res);
  stream.on("close", () => {
    fs.unlinkSync(info.path);
    delete fileMap[id];
    delete progressMap[id];
    console.log(`[${id}] File deleted after download`);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
