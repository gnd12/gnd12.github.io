import tkinter as tk
from tkinter import filedialog
from PIL import Image, ImageTk, ImageOps

# Canvas/export dimensions. Preview is displayed at half size.
WIDTH, HEIGHT = 1200, 1800
PREVIEW = 0.4
BORDER = 3

root = tk.Tk()
root.title("Scrapbook")

images = []
selected = None
drag_start = None
syncing = False


def render(item):
    """Resize, border, then rotate an image."""
    photo = item["original"]
    width = int(item["width"])
    height = round(width * photo.height / photo.width)

    photo = photo.resize((width, height), Image.Resampling.LANCZOS)
    photo = ImageOps.expand(photo, border=BORDER, fill="black")

    return photo.rotate(
        item["angle"],
        resample=Image.Resampling.BICUBIC,
        expand=True,
    )


def redraw():
    canvas.delete("all")

    for item in images:
        photo = render(item)
        photo = photo.resize(
            (
                max(1, round(photo.width * PREVIEW)),
                max(1, round(photo.height * PREVIEW)),
            ),
            Image.Resampling.LANCZOS,
        )

        item["preview"] = photo
        item["tk_image"] = ImageTk.PhotoImage(photo)
        canvas.create_image(
            item["x"] * PREVIEW,
            item["y"] * PREVIEW,
            image=item["tk_image"],
        )


def open_images():
    global selected

    paths = filedialog.askopenfilenames(
        title="Choose your images",
        filetypes=[("Images", "*.jpg *.jpeg *.png *.webp"), ("All files", "*.*")],
    )

    for path in paths:
        with Image.open(path) as photo:
            original = ImageOps.exif_transpose(photo).convert("RGBA")

        images.append({
            "original": original,
            "x": WIDTH / 2,
            "y": 350 + (len(images) % 3) * 500,
            "width": 750,
            "angle": 0,
        })

    if images:
        selected = images[-1]
        sync_sliders()

    redraw()


def sync_sliders():
    global syncing
    syncing = True
    size_slider.set(selected["width"])
    angle_slider.set(selected["angle"])
    syncing = False


def change_image(_=None):
    if selected is not None and not syncing:
        selected["width"] = size_slider.get()
        selected["angle"] = angle_slider.get()
        redraw()


def click(event):
    global selected, drag_start
    selected = None

    # Check the top image first, including its rotated transparent corners.
    for item in reversed(images):
        photo = item["preview"]
        left = item["x"] * PREVIEW - photo.width / 2
        top = item["y"] * PREVIEW - photo.height / 2
        x, y = int(event.x - left), int(event.y - top)

        if 0 <= x < photo.width and 0 <= y < photo.height:
            if photo.getpixel((x, y))[3] > 0:
                selected = item
                drag_start = (event.x, event.y)
                sync_sliders()
                break


def drag(event):
    global drag_start
    if selected is not None:
        selected["x"] += (event.x - drag_start[0]) / PREVIEW
        selected["y"] += (event.y - drag_start[1]) / PREVIEW
        drag_start = (event.x, event.y)
        redraw()


def bring_to_front():
    if selected is not None:
        images.remove(selected)
        images.append(selected)
        redraw()


def send_to_back():
    if selected is not None:
        images.remove(selected)
        images.insert(0, selected)
        redraw()


def save_image():
    path = filedialog.asksaveasfilename(
        defaultextension=".jpg",
        filetypes=[("JPEG", "*.jpg"), ("PNG", "*.png")],
    )
    if not path:
        return

    output = Image.new("RGBA", (WIDTH, HEIGHT), "white")

    for item in images:
        photo = render(item)
        position = (
            round(item["x"] - photo.width / 2),
            round(item["y"] - photo.height / 2),
        )
        output.alpha_composite(photo, dest=position)

    output.convert("RGB").save(path, quality=95)


controls = tk.Frame(root, padx=12, pady=12)
controls.pack(side="right", fill="y")

tk.Button(controls, text="Open images", command=open_images).pack(fill="x")
tk.Label(controls, text="Click an image, then drag it.").pack(pady=15)

tk.Label(controls, text="Image width").pack()
size_slider = tk.Scale(
    controls, from_=100, to=1400, orient="horizontal",
    length=220, command=change_image,
)
size_slider.pack()

tk.Label(controls, text="Rotation").pack(pady=(15, 0))
angle_slider = tk.Scale(
    controls, from_=-90, to=90, orient="horizontal",
    length=220, command=change_image,
)
angle_slider.pack()

tk.Button(controls, text="Bring to front", command=bring_to_front).pack(
    fill="x", pady=(20, 5)
)
tk.Button(controls, text="Send to back", command=send_to_back).pack(fill="x")
tk.Button(controls, text="Save image", command=save_image).pack(
    fill="x", pady=25
)

canvas = tk.Canvas(
    root,
    width=int(WIDTH * PREVIEW),
    height=int(HEIGHT * PREVIEW),
    bg="white",
    highlightthickness=0,
)
canvas.pack(side="left")
canvas.bind("<Button-1>", click)
canvas.bind("<B1-Motion>", drag)

root.mainloop()