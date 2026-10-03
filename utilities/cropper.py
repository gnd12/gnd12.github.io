import tkinter as tk
from tkinter import filedialog
from pathlib import Path

import cv2
from PIL import Image, ImageTk

root = tk.Tk()
root.title("Video cropper")

video_path = None
video = None
preview_frame = None
image_frame = None
preview_scale = 1


def open_video():
    global video_path, video, image_frame

    path = filedialog.askopenfilename(title="Select video")
    if not path:
        return

    if video is not None:
        video.release()

    image_frame = None
    video_path = Path(path)
    video = cv2.VideoCapture(str(video_path))

    fps = video.get(cv2.CAP_PROP_FPS)
    frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))

    timestamp.config(to=(frames - 1) / fps)
    timestamp.set(0)
    show_preview(0)
    status.config(text="Choose a timestamp for the still image.")


def show_preview(seconds):
    global preview_frame, preview_scale

    if video is None:
        return

    fps = video.get(cv2.CAP_PROP_FPS)
    video.set(cv2.CAP_PROP_POS_FRAMES, round(float(seconds) * fps))

    success, frame = video.read()
    if not success:
        return

    preview_frame = frame
    height, width = frame.shape[:2]
    preview_scale = min(1, 1000 / width, 650 / height)

    preview = cv2.resize(
        frame,
        (round(width * preview_scale), round(height * preview_scale)),
    )
    preview = cv2.cvtColor(preview, cv2.COLOR_BGR2RGB)

    photo = ImageTk.PhotoImage(Image.fromarray(preview))
    screen.config(image=photo)
    screen.image = photo


def choose_image_timestamp():
    global image_frame

    if preview_frame is None:
        return

    image_frame = preview_frame.copy()
    status.config(
        text=f"Still selected at {timestamp.get():.2f}s. "
             "Move the slider to your preferred crop preview."
    )


def crop_and_save():
    if preview_frame is None or image_frame is None:
        return

    # Draw on the CURRENT preview, independently of the saved still.
    scale = preview_scale
    preview = cv2.resize(
        preview_frame,
        (
            round(preview_frame.shape[1] * scale),
            round(preview_frame.shape[0] * scale),
        ),
    )

    x, y, w, h = cv2.selectROI(
        "Draw rectangle, then press Enter",
        preview,
        showCrosshair=True,
        fromCenter=False,
    )
    cv2.destroyAllWindows()

    if w == 0 or h == 0:
        return

    left = round(x / scale)
    top = round(y / scale)
    right = min(preview_frame.shape[1], round((x + w) / scale))
    bottom = min(preview_frame.shape[0], round((y + h) / scale))

    # Even dimensions for MP4 encoding.
    crop_width = (right - left) // 2 * 2
    crop_height = (bottom - top) // 2 * 2

    image_output = video_path.with_name(video_path.stem + "_cropped.jpg")
    video_output = video_path.with_name(video_path.stem + "_cropped.mp4")

    cv2.imwrite(
        str(image_output),
        image_frame[top:top + crop_height, left:left + crop_width],
    )

    source = cv2.VideoCapture(str(video_path))
    writer = cv2.VideoWriter(
        str(video_output),
        cv2.VideoWriter_fourcc(*"mp4v"),
        source.get(cv2.CAP_PROP_FPS),
        (crop_width, crop_height),
    )

    status.config(text="Saving cropped video...")
    root.update_idletasks()

    while True:
        success, frame = source.read()
        if not success:
            break

        writer.write(frame[top:top + crop_height, left:left + crop_width])

    source.release()
    writer.release()

    status.config(
        text=f"Saved: {image_output.name} and {video_output.name}"
    )


tk.Button(root, text="Open video", command=open_video).pack(pady=10)

screen = tk.Label(root)
screen.pack()

timestamp = tk.Scale(
    root,
    from_=0,
    to=0,
    resolution=0.01,
    orient="horizontal",
    length=800,
    label="Preview timestamp (seconds)",
    command=show_preview,
)
timestamp.pack(padx=20, pady=10)

tk.Button(
    root,
    text="Choose this timestamp for image",
    command=choose_image_timestamp,
).pack(pady=5)

tk.Button(
    root,
    text="Draw crop on current preview and save",
    command=crop_and_save,
).pack(pady=5)

status = tk.Label(root, text="")
status.pack(pady=10)

root.mainloop()

if video is not None:
    video.release()