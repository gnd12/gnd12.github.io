import numpy as np
import matplotlib

matplotlib.use("QtAgg")

import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# ================= USER INPUTS =================
m = 1.0                 # Mass [kg]
k = 4.0                 # Spring constant [N/m]
L = 2.0                 # String length [m]
spring_length = 0.5     # Unstretched spring length [m]
initial_gap = 0.6       # Initial hand distance from spring's free end [m]
v = 0.8                 # Hand velocity to the right [m/s]

fps = 60
playback_speed = 1.0    # 1 = real time; 0.5 = half speed
# ===============================================

assert m > 0 and k > 0 and L > 0 and v > 0
assert spring_length > 0 and 0 <= initial_gap < L
assert fps > 0 and playback_speed > 0

# Initial layout:
# mass -- relaxed spring -- slack string -- hand
#
# Positive direction: right.
# Spring extension = max(hand_x - mass_x - L - spring_length, 0).
# The string transmits tension only.

omega = np.sqrt(k / m)
hand_x0 = spring_length + initial_gap
rest_span = spring_length + L

t_taut = (L - initial_gap) / v
t_release = t_taut + np.pi / omega
t_stop = t_release + rest_span / v

nframes = max(2, int(np.ceil(t_stop * fps / playback_speed)) + 1)
time = np.linspace(0, t_stop, nframes)
hand_x = hand_x0 + v * time

mass_x = np.zeros_like(time)
mass_velocity = np.zeros_like(time)
extension = np.zeros_like(time)

# Exact solution while the spring is stretched.
taut = (time >= t_taut) & (time <= t_release)
tau = time[taut] - t_taut

mass_x[taut] = v * tau - (v / omega) * np.sin(omega * tau)
mass_velocity[taut] = v * (1 - np.cos(omega * tau))
extension[taut] = (v / omega) * np.sin(omega * tau)

# Once the string goes slack again, the mass coasts at 2v.
coasting = time > t_release
mass_x[coasting] = (
    v * np.pi / omega + 2 * v * (time[coasting] - t_release)
)
mass_velocity[coasting] = 2 * v

# ================= DRAWING =================
fig, (ax, velocity_ax) = plt.subplots(
    2, 1, figsize=(11, 6), gridspec_kw={"height_ratios": [2, 1]}
)
fig.subplots_adjust(hspace=0.5)

ax.set_title("Mass–spring–string: constant-speed pull")
ax.set_xlim(-0.5, hand_x[-1] + spring_length + 0.5)
ax.set_ylim(-L - 0.5, spring_length + 0.7)
ax.set_xlabel("Position [m]")
ax.set_yticks([])
ax.axhline(0, color="0.85", lw=1)
ax.text(
    0.02, 0.03, "Slack shape is schematic.",
    transform=ax.transAxes, color="0.5", fontsize=9
)

spring_line, = ax.plot([], [], color="tab:blue", lw=2, label="Spring")
string_line, = ax.plot([], [], color="0.5", lw=2, label="String")
mass_dot, = ax.plot([], [], "s", color="tab:blue", markersize=16, label="Mass")
hand_dot, = ax.plot([], [], "o", color="tab:red", markersize=10, label="Hand")
info = ax.text(0.02, 0.95, "", transform=ax.transAxes, va="top")
ax.legend(loc="upper right", ncol=4)

velocity_ax.set_xlim(0, t_stop)
velocity_ax.set_ylim(-0.1 * v, 2.3 * v)
velocity_ax.set_xlabel("Time [s]")
velocity_ax.set_ylabel("Velocity [m/s]")
velocity_ax.grid(alpha=0.25)
velocity_ax.axhline(
    v, color="tab:red", ls="--", label="Hand velocity"
)
velocity_line, = velocity_ax.plot(
    [], [], color="tab:blue", lw=2, label="Mass velocity"
)
velocity_ax.legend(loc="lower right")

s = np.linspace(0, 1, 150)


def update(i):
    x = mass_x[i]
    h = hand_x[i]
    distance = max(h - x, 0.0)
    spring_span = spring_length + max(extension[i], 0.0)

    # Rotate the relaxed spring upward near the hand so it still fits.
    if distance < spring_span:
        dx = 0.5 * distance
        dy = np.sqrt(max(spring_span**2 - dx**2, 0.0))
    else:
        dx, dy = spring_span, 0.0

    junction_x = x + dx
    junction_y = dy

    # Spring coil, with its endpoints fixed.
    wiggle = 0.07 * np.sin(20 * np.pi * s) * np.sin(np.pi * s)
    spring_line.set_data(
        x + dx * s - wiggle * dy / spring_span,
        dy * s + wiggle * dx / spring_span,
    )

    # String: straight when taut, bowed when slack.
    chord = np.hypot(h - junction_x, junction_y)
    sag = 0.5 * np.sqrt(max(L**2 - chord**2, 0.0))
    string_line.set_data(
        junction_x + (h - junction_x) * s,
        junction_y * (1 - s) - sag * np.sin(np.pi * s),
    )

    mass_dot.set_data([x], [0])
    hand_dot.set_data([h], [0])
    velocity_line.set_data(time[:i + 1], mass_velocity[:i + 1])

    if i == len(time) - 1:
        status = "Mass reaches hand — stopped"
    elif time[i] < t_taut:
        status = "String slack — mass stationary"
    elif time[i] < t_release:
        status = "String taut — mass accelerating"
    else:
        status = "String slack — mass coasting"

    info.set_text(
        f"t = {time[i]:.2f} s | {status}\n"
        f"Mass velocity = {mass_velocity[i]:.2f} m/s"
    )

    return spring_line, string_line, mass_dot, hand_dot, velocity_line, info


animation = FuncAnimation(
    fig,
    update,
    frames=len(time),
    interval=1000 / fps,
    repeat=False,
    blit=False,
)

plt.show()