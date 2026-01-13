
import cv2
from ultralytics import YOLO
from datetime import datetime
import time
import os

# ============================
# LOAD YOLOv8 MODEL
# ============================
model = YOLO("yolov8n.pt")

# ============================
# CAMERA
# ============================
cap = cv2.VideoCapture(0)

# ============================
# CREATE CAPTURE DIRECTORIES
# ============================
os.makedirs("captures/restricted_animals", exist_ok=True)
os.makedirs("captures/safe_humans", exist_ok=True)

# ============================
# ANIMAL CATEGORIES
# ============================
WILD_ANIMALS = [
    "elephant", "tiger", "lion", "leopard",
    "bear", "wolf", "zebra", "giraffe"
]

DOMESTIC_ANIMALS = [
    "cow", "dog", "sheep", "horse", "cat"
]

# ============================
# TRACKING MEMORY
# ============================
previous_positions = {}

# ============================
# TIMERS
# ============================
last_alert_time = 0
last_animal_capture_time = 0
last_human_capture_time = 0

ALERT_INTERVAL = 5        # seconds
CAPTURE_INTERVAL = 10     # seconds

# ============================
# MAIN LOOP
# ============================
while True:
    ret, frame = cap.read()
    if not ret:
        break

    h, w, _ = frame.shape
    mid_x = w // 2

    # ============================
    # DRAW ZONES (50 / 50)
    # ============================
    cv2.rectangle(frame, (0, 0), (mid_x, h), (0, 0, 255), 3)
    cv2.putText(frame, "RESTRICTED ZONE", (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

    cv2.rectangle(frame, (mid_x, 0), (w, h), (0, 255, 0), 3)
    cv2.putText(frame, "SAFE ZONE", (mid_x + 20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 3)

    status = "SAFE"
    status_color = (0, 255, 0)

    # ============================
    # YOLO DETECTION
    # ============================
    results = model(frame, verbose=False)

    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            label = model.names[cls_id]

            if conf < 0.5:
                continue

            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cx = (x1 + x2) // 2

            # ============================
            # MOVEMENT DIRECTION
            # ============================
            direction = "STATIONARY"
            if label in previous_positions:
                prev_x = previous_positions[label]
                if cx > prev_x + 15:
                    direction = "LEFT → RIGHT"
                elif cx < prev_x - 15:
                    direction = "RIGHT → LEFT"

            previous_positions[label] = cx

            inside_restricted = cx < mid_x
            inside_safe = cx >= mid_x

            current_time = time.time()
            timestamp = datetime.now().strftime("%H:%M:%S")

            # ============================
            # WILD ANIMAL IN RESTRICTED ZONE
            # ============================
            if label in WILD_ANIMALS and inside_restricted:

                status = f"ALERT: WILD {label.upper()}"
                status_color = (0, 0, 255)

                if current_time - last_alert_time >= ALERT_INTERVAL:
                    print(f"[{timestamp}] ALERT → WILD {label.upper()} | RESTRICTED ZONE | {direction}")
                    last_alert_time = current_time

                if current_time - last_animal_capture_time >= CAPTURE_INTERVAL:
                    filename = f"captures/restricted_animals/{label}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                    cv2.imwrite(filename, frame)
                    print(f" Captured animal image: {filename}")
                    last_animal_capture_time = current_time

            # ============================
            # HUMAN IN SAFE ZONE
            # ============================
            if label == "person" and inside_safe:
                if current_time - last_human_capture_time >= CAPTURE_INTERVAL:
                    filename = f"captures/safe_humans/HUMAN_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                    cv2.imwrite(filename, frame)
                    print(f"📸 Captured human image: {filename}")
                    last_human_capture_time = current_time

            # ============================
            # DRAW BOX
            # ============================
            box_color = (0, 0, 255) if inside_restricted else (0, 255, 0)

            cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
            cv2.putText(
                frame,
                f"{label.upper()} | {direction}",
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                box_color,
                2
            )

    # ============================
    # STATUS DISPLAY
    # ============================
    cv2.putText(frame, status, (20, h - 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, status_color, 3)

    cv2.imshow("AI & IoT Animal Movement Detection – PS38", frame)

    if cv2.waitKey(1) & 0xFF == 27:
        break

# ============================
# CLEANUP
# ============================
cap.release()
cv2.destroyAllWindows()
