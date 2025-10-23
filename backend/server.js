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

const downloadsDir = path.join(process.cwd(), "downloads");
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

const progressMap = {}; // download progress
const fileMap = {};     // file path and ext

const PYTHON_CMD = "python"; // or full Python path

// Helper for logging
function logStep(id, msg) {
  console.log(`[${id}] ${msg}`);
}

app.post("/download", (req, res) => {
  const { url, format } = req.body;
  if (!url || !format) return res.status(400).json({ error: "Missing url or format" });

  const id = uuidv4();
  progressMap[id] = 0;

  const tmpBase = path.join(downloadsDir, id);

  // Spawn Python downloader
  const py = spawn(PYTHON_CMD, [
    path.join(process.cwd(), "downloader.py"),
    url,
    format,
    tmpBase
  ], {
    env: { ...process.env, FFMPEG_BINARY: ffmpegPath }
  });

  logStep(id, `Started download for ${format} => ${url}`);

  py.stdout.on("data", (data) => {
    const text = data.toString();
    const matches = [...text.matchAll(/(\d{1,3}(?:\.\d+)?)%/g)];
    if (matches.length) {
      const percent = parseFloat(matches[matches.length - 1][1]);
      progressMap[id] = Math.min(100, Math.max(0, percent));
      logStep(id, `Progress: ${percent}%`);
    }
  });

  py.stderr.on("data", (data) => console.error(`[${id}] Python stderr:`, data.toString()));

  py.on("close", (code) => {
    logStep(id, `Python process exited with code ${code}`);

    const mp3File = tmpBase + ".mp3";
    const mp4File = tmpBase + ".mp4";

    let finalPath = null;
    let ext = null;

    if (fs.existsSync(mp3File)) { finalPath = mp3File; ext = "mp3"; }
    else if (fs.existsSync(mp4File)) { finalPath = mp4File; ext = "mp4"; }

    if (!finalPath) {
      console.error(`❌ File not found for ${id}`);
      delete progressMap[id];
      return;
    }

    fileMap[id] = { path: finalPath, ext };
    progressMap[id] = 100;

    logStep(id, `File ready for download: ${path.basename(finalPath)}`);
    logStep(id, `File will be deleted automatically after download`);
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
  const filename = path.basename(info.path); // keep original file name

  res.setHeader("Content-Length", stat.size);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const stream = fs.createReadStream(info.path);
  stream.pipe(res);

  stream.on("close", () => {
    try { fs.unlinkSync(info.path); } catch(e){ console.error(e); }
    delete fileMap[id];
    delete progressMap[id];
    logStep(id, `File deleted from server after download`);
  });

  stream.on("error", (err) => { console.error(err); res.end(); });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
