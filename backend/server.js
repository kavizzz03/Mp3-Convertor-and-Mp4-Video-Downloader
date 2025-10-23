import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import ffmpegPath from "ffmpeg-static";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// Use /tmp for Render or other restricted hosts
const downloadsDir = "/tmp/downloads";
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

const progressMap = {};
const fileMap = {};
const PYTHON_CMD = "python3"; // Render uses python3

app.post("/download", (req, res) => {
  const { url, format } = req.body;
  if (!url || !format) return res.status(400).json({ error: "Missing url or format" });

  const id = uuidv4();
  progressMap[id] = 0;
  const tmpBase = path.join(downloadsDir, id);

  const py = spawn(PYTHON_CMD, [
    path.join(process.cwd(), "downloader.py"),
    url,
    format,
    tmpBase,
  ], {
    env: { ...process.env, FFMPEG_BINARY: ffmpegPath },
  });

  console.log(`[${id}] Started download (${format}) for: ${url}`);

  py.stdout.on("data", (data) => {
    const text = data.toString();
    const match = text.match(/(\d{1,3}(?:\.\d+)?)%/);
    if (match) {
      progressMap[id] = parseFloat(match[1]);
      console.log(`[${id}] Progress: ${progressMap[id]}%`);
    }
  });

  py.stderr.on("data", (data) => console.error(`[${id}] Python stderr:`, data.toString()));

  py.on("close", (code) => {
    console.log(`[${id}] Python exited with code ${code}`);
    const mp3 = tmpBase + ".mp3";
    const mp4 = tmpBase + ".mp4";

    let finalFile = null;
    if (fs.existsSync(mp3)) finalFile = mp3;
    else if (fs.existsSync(mp4)) finalFile = mp4;

    if (!finalFile) {
      console.error(`[${id}] ❌ No output file found`);
      delete progressMap[id];
      return;
    }

    fileMap[id] = { path: finalFile, ext: path.extname(finalFile).replace(".", "") };
    progressMap[id] = 100;
    console.log(`[${id}] ✅ File ready: ${finalFile}`);
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
  if (!info || !fs.existsSync(info.path)) {
    delete fileMap[id];
    delete progressMap[id];
    return res.status(404).json({ error: "File not ready or missing" });
  }

  const stat = fs.statSync(info.path);
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Content-Disposition", `attachment; filename="download.${info.ext}"`);

  const stream = fs.createReadStream(info.path);
  stream.pipe(res);

  stream.on("close", () => {
    try { fs.unlinkSync(info.path); } catch (e) { console.error(e); }
    delete fileMap[id];
    delete progressMap[id];
    console.log(`[${id}] File deleted after download`);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
