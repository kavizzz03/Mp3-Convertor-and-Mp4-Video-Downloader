import sys, os
from yt_dlp import YoutubeDL

if len(sys.argv) < 4:
    print("Usage: downloader.py <url> <format> <output_base>")
    sys.exit(2)

url, fmt, output_base = sys.argv[1], sys.argv[2].lower(), sys.argv[3]
os.makedirs(os.path.dirname(output_base), exist_ok=True)
ffmpeg_binary = os.environ.get("FFMPEG_BINARY", "ffmpeg")

def progress_hook(d):
    if d.get("status") == "downloading":
        percent = d.get("_percent_str", "").replace("%", "").strip()
        if percent: sys.stdout.write(f"{percent}\n"); sys.stdout.flush()
    elif d.get("status") == "finished":
        sys.stdout.write("100\n"); sys.stdout.flush()

ydl_opts = {"outtmpl": output_base + ".%(ext)s", "progress_hooks": [progress_hook],
            "quiet": True, "no_warnings": True, "ffmpeg_location": ffmpeg_binary}

if fmt == "mp3":
    ydl_opts["format"] = "bestaudio/best"
    ydl_opts["postprocessors"] = [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}]
else:
    ydl_opts["format"] = "bestvideo[ext=mp4]+bestaudio/best"
    ydl_opts["merge_output_format"] = "mp4"

try:
    with YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    sys.exit(0)
except Exception as e:
    sys.stderr.write("ERROR: " + str(e) + "\n")
    sys.exit(1)
