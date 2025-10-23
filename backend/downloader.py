import sys
import os
from yt_dlp import YoutubeDL

if len(sys.argv) < 4:
    print("Usage: downloader.py <url> <format> <output_base>")
    sys.exit(2)

url = sys.argv[1]
fmt = sys.argv[2].lower()
output_base = sys.argv[3]

outdir = os.path.dirname(output_base)
if outdir and not os.path.exists(outdir):
    os.makedirs(outdir, exist_ok=True)

ffmpeg_binary = os.environ.get("FFMPEG_BINARY", "ffmpeg")

if fmt == "mp3":
    outtmpl = output_base + ".%(ext)s"
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "quiet": True,
        "no_warnings": True,
        "ffmpeg_location": ffmpeg_binary,
    }
else:
    outtmpl = output_base + ".%(ext)s"
    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio/best",
        "outtmpl": outtmpl,
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "ffmpeg_location": ffmpeg_binary,
    }

def progress_hook(d):
    status = d.get("status")
    if status == "downloading":
        percent_str = d.get("_percent_str", "")
        if percent_str:
            sys.stdout.write(percent_str + "\n")
            sys.stdout.flush()
    elif status == "finished":
        sys.stdout.write("100.0%\n")
        sys.stdout.flush()

ydl_opts["progress_hooks"] = [progress_hook]

try:
    with YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    sys.exit(0)
except Exception as e:
    sys.stderr.write("ERROR: " + str(e) + "\n")
    sys.exit(1) 