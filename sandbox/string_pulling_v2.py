import numpy as np
import matplotlib

matplotlib.use("QtAgg")

import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# ================= USER INPUTS =================
attached_mass = 1.0       # Original mass attached to spring [kg]
spring_mass = 0.4         # Total mass of the spring [kg]
k = 4.0                   # Overall spring stiffness [N/m]
spring_length = 0.5        # Unstretched spring length [m]

N = 20                    # Number of masses representing the spring

L = 2.0                   # Massless, inextensible string length [m]
initial_gap = 0.6          # Initial gap: spring end to hand [m]
v = 0.8                   # Hand speed to the right [m/s]

max_time = 20.0            # Stop here if mass hasn't reached hand [s]
fps = 60
playback_speed = 1.0       # 1 = real time; 0.5 = half speed
# ===============================================

assert attached_mass > 0 and spring_mass > 0 and k > 0
assert spring_length > 0 and L > 0 and v > 0
assert isinstance(N, int) and N >= 1
assert 0 <= initial_gap < L
assert max_time > 0 and fps > 0 and playback_speed > 0

dm = spring_mass / N
segment_k = N * k
segment_length = spring_length / N

# Node 0: original attached mass.
# Nodes 1 ... N: the spring's distributed mass.
masses = np.full(N + 1, dm)
masses[0] = attached_mass

x = np.linspace(0.0, spring_length, N + 1)
u = np.zeros(N + 1)

hand_x0 = spring_length + initial_gap

# Small integration step, separate from animation frame rate.
# This conservatively resolves the fastest spring motion.
dt_limit = 0.05 * np.sqrt(np.min(masses) / segment_k)
frame_dt = playback_speed / fps
substeps = max(1, int(np.ceil(frame_dt / dt_limit)))
dt = frame_dt / substeps

times = [0.0]
positions = [x.copy()]
velocities = [u.copy()]
tensions = [0.0]

t = 0.0
reached_hand = False

# ================= SIMULATION =================
# Spring segments can both stretch and compress.
# The string can pull but cannot push.
#
# The string imposes:
#     abs(hand_x - x[-1]) <= L
#
# At string pickup, use a zero-bounce impact:
# the spring end's velocity becomes the hand's velocity.

while t < max_time and not reached_hand:
    string_impulse = 0.0
    elapsed = 0.0

    for _ in range(substeps):
        step = min(dt, max_time - t)
        if step <= 0:
            break

        old_t = t
        old_x = x.copy()
        old_u = u.copy()

        # Internal spring forces.
        stretch = np.diff(x) - segment_length
        segment_force = segment_k * stretch

        force = np.zeros(N + 1)
        force[:-1] += segment_force
        force[1:] -= segment_force

        # Semi-implicit Euler integration.
        u += step * force / masses
        x += step * u
        t += step

        # Enforce string length at the spring's free end.
        hand = hand_x0 + v * t
        lower_bound = hand - L
        upper_bound = hand + L

        if x[-1] < lower_bound:
            string_impulse += masses[-1] * abs(v - u[-1])
            x[-1] = lower_bound
            u[-1] = v

        elif x[-1] > upper_bound:
            string_impulse += masses[-1] * abs(v - u[-1])
            x[-1] = upper_bound
            u[-1] = v

        elapsed += step

        # Stop when the original attached mass reaches the hand.
        if x[0] >= hand:
            previous_gap = hand_x0 + v * old_t - old_x[0]
            current_gap = hand - x[0]

            # Interpolate the crossing within this small time step.
            fraction = np.clip(
                previous_gap / (previous_gap - current_gap), 0.0, 1.0
            )
            x = old_x + fraction * (x - old_x)
            u = old_u + fraction * (u - old_u)
            t = old_t + fraction * step
            reached_hand = True
            break

    if elapsed <= 0:
        break

    times.append(t)
    positions.append(x.copy())
    velocities.append(u.copy())
    tensions.append(string_impulse / elapsed)

time = np.array(times)
positions = np.array(positions)
velocities = np.array(velocities)
tensions = np.array(tensions)
hand_positions = hand_x0 + v * time

# ================= ANIMATION =================
fig, (ax, velocity_ax) = plt.subplots(
    2, 1, figsize=(12, 6),
    gridspec_kw={"height_ratios": [2, 1]}
)
fig.subplots_adjust(hspace=0.5)

xmin = min(positions.min(), hand_positions.min()) - 0.5
xmax = max(positions.max(), hand_positions.max()) + 0.5

ax.set_xlim(xmin, xmax)
ax.set_ylim(-L - 0.4, 0.7)
ax.set_yticks([])
ax.set_xlabel("Position [m]")
ax.set_title(f"Massive spring: {N} spring masses")
ax.axhline(0, color="0.85", linewidth=1)

spring_line, = ax.plot(
    [], [], color="tab:blue", linewidth=1.5, label="Spring segments"
)
spring_dots, = ax.plot(
    [], [], "o", color="tab:blue", markersize=4, label="Spring masses"
)
mass_dot, = ax.plot(
    [], [], "s", color="black", markersize=14, label="Attached mass"
)
hand_dot, = ax.plot(
    [], [], "o", color="tab:red", markersize=9, label="Hand"
)
string_line, = ax.plot(
    [], [], color="0.5", linewidth=2, label="String"
)
info = ax.text(
    0.02, 0.95, "", transform=ax.transAxes, va="top"
)
ax.text(
    0.02, 0.03, "Slack string shape is schematic.",
    transform=ax.transAxes, fontsize=9, color="0.5"
)
ax.legend(loc="upper right", ncol=3)

velocity_ax.set_xlim(0, time[-1])
vmin = min(0.0, velocities[:, 0].min())
vmax = max(v, velocities[:, 0].max())
padding = 0.15 * max(vmax - vmin, v)
velocity_ax.set_ylim(vmin - padding, vmax + padding)
velocity_ax.set_xlabel("Time [s]")
velocity_ax.set_ylabel("Velocity [m/s]")
velocity_ax.grid(alpha=0.25)
velocity_ax.axhline(
    v, color="tab:red", linestyle="--", label="Hand"
)
velocity_line, = velocity_ax.plot(
    [], [], color="black", linewidth=2, label="Attached mass"
)
velocity_ax.legend(loc="upper left")

s = np.linspace(0, 1, 100)


def update(i):
    nodes = positions[i]
    hand = hand_positions[i]

    # Draw a small coil between each neighboring pair of nodes.
    coil_x = []
    coil_y = []

    for j in range(N):
        coil_x.extend(nodes[j] + (nodes[j + 1] - nodes[j]) * s)
        coil_y.extend(0.05 * np.sin(4 * np.pi * s))

    spring_line.set_data(coil_x, coil_y)
    spring_dots.set_data(nodes[1:], np.zeros(N))
    mass_dot.set_data([nodes[0]], [0])
    hand_dot.set_data([hand], [0])

    gap = hand - nodes[-1]
    sag = 0.5 * np.sqrt(max(L**2 - gap**2, 0.0))
    string_line.set_data(
        nodes[-1] + gap * s,
        -sag * np.sin(np.pi * s)
    )

    velocity_line.set_data(time[:i + 1], velocities[:i + 1, 0])

    status = "Taut" if abs(gap) >= L - 1e-7 else "Slack"
    if i == len(time) - 1:
        status = (
            "Attached mass reaches hand — stopped"
            if reached_hand else "Maximum simulation time reached"
        )

    info.set_text(
        f"t = {time[i]:.2f} s | {status}\n"
        f"Attached mass velocity = {velocities[i, 0]:.3f} m/s\n"
        f"Spring mass = {spring_mass:g} kg | "
        f"dm = {dm:.4g} kg | N = {N}"
    )


animation = FuncAnimation(
    fig,
    update,
    frames=len(time),
    interval=1000 / fps,
    repeat=False,
    blit=False,
)

plt.show()