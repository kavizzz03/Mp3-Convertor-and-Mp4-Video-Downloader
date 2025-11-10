# 🎶 MP3 Converter & MP4 Video Downloader

A powerful all-in-one web app that allows users to **download videos (MP4)** and **convert them to MP3 audio** instantly.  
Built with Node.js, Express, React, and powerful open-source media tools.

---

## 🚀 Features

✅ **Download YouTube or other online videos (MP4 format)**  
✅ **Convert any video to MP3 audio**  
✅ **Fast and lightweight performance**  
✅ **Clean modern UI (React Frontend)**  
✅ **Real-time progress updates**  
✅ **Supports multiple video qualities (360p, 720p, 1080p)**  
✅ **Auto cleanup after downloads**

---

## 🏗️ Project Structure
Mp3-Convertor-and-Mp4-Video-Downloader/
│
├── server.js # Node.js backend - handles download & conversion
├── downloader.js # Helper module for video/audio download logic
├── Frontend/ # React frontend UI
│ ├── App.jsx
│ ├── components/
│ │ └── DownloadForm.jsx
│ └── package.json
│
├── downloads/ # Folder where output files are temporarily stored
├── README.md # This file
└── .gitignore # Ignored files (node_modules, temp, etc.)

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React, Axios, Tailwind CSS |
| Backend | Node.js, Express |
| Video Processing | `yt-dlp`, `ffmpeg` |
| File Handling | `multer`, `fs`, `path` |
| Conversion | `ffmpeg` audio extraction |

---

## 🧩 Prerequisites

Before running this project, make sure you have installed:

- **Node.js** (v18 or later)
- **npm** or **yarn**
- **FFmpeg** (for conversion)
- **yt-dlp** (for YouTube and media downloads)

### 🧠 Install FFmpeg (Windows Example)
```bash
winget install ffmpeg

