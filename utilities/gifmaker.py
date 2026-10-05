import tkinter as tk
from tkinter import filedialog, simpledialog
from pathlib import Path

import cv2
from PIL import Image

root = tk.Tk()
root.withdraw()

video_path = Path(filedialog.askopenfilename(title="Choose video"))
seconds = simpledialog.askfloat(
    "GIF duration",
    "Maximum duration in seconds:",
    initialvalue=5,
    minvalue=0.05,
)
root.destroy()

video = cv2.VideoCapture(str(video_path))
source_fps = video.get(cv2.CAP_PROP_FPS)
total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
source_duration = total_frames / source_fps

# Keep shorter videos at approximately their original speed.
gif_fps = 15
max_width=500
frame_count = max(1, int(min(source_duration, seconds) * gif_fps))
frames = []

for i in range(frame_count):
    # Sample across the entire video, skipping frames to speed it up.
    frame_number = int(i * total_frames / frame_count)
    video.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
    success, frame = video.read()
    if not success:
        break

    height, width = frame.shape[:2]
    if width > max_width:
        frame = cv2.resize(frame, (max_width, round(height * max_width / width)))

    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    frames.append(Image.fromarray(frame))
    print(f"\rProcessing frame {i + 1}/{frame_count}", end="")

video.release()

output = video_path.with_name(video_path.stem + "_sped_up.gif")
frames[0].save(
    output,
    save_all=True,
    append_images=frames[1:],
    duration=1000/gif_fps,  #math to get the duration in milliseconds based on the desired FPS
    loop=0,
    disposal=2,
)

print(f"\nSaved: {output}")