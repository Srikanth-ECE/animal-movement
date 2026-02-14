# ============================================================
# FINAL ANIMAL MOVEMENT DETECTION SYSTEM + LORA ALERT
# Raspberry Pi 4/5 | HLK-LD1115H | USB Camera | YOLOv8 | LoRa-E5
# ============================================================

import os
import time
import json
import serial
import cv2
import numpy as np
from ultralytics import YOLO

# ---------------- ENV SAFETY ----------------
os.environ["QT_QPA_PLATFORM"] = "xcb"

# ---------------- CONFIG ----------------
HLK_PORT = "/dev/serial0"
HLK_BAUD = 115200

LORA_PORT = "/dev/ttyUSB0"
LORA_BAUD = 9600

DISTANCE_THRESHOLD = 6000
MOTION_TIMEOUT = 3

DETECT_CONF = 0.6
CLASSIFIER_CONF = 0.7
MIN_TRACK_FRAMES = 5

DETECT_MODEL = "yolov8s.pt"
CLASSIFY_MODEL = "runs/classify/train4/weights/best.pt"

WIDTH, HEIGHT = 640, 480
WINDOW_NAME = "Animal Detection System"

LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

# ---------------- RISK TABLE ----------------
RISK_TABLE = {
    "tiger": "HIGH",
    "elephant": "HIGH",
    "leopard": "HIGH",
    "lion": "HIGH",
    "bear": "HIGH",
    "wolf": "HIGH",
    "cow": "LOW",
    "dog": "LOW",
    "cat": "LOW",
    "rooster": "LOW"
}

# ============================================================
# LORA FUNCTIONS
# ============================================================
def lora_send(cmd, wait=0.5):
    lora.write((cmd + "\r\n").encode())
    time.sleep(wait)
    resp = lora.read_all().decode(errors="ignore")
    print(resp)

def send_lora_alert(animal):
    payload = {
        "type": "WILD",
        "animal": animal,
        "time": time.strftime("%H:%M:%S")
    }
    hex_data = json.dumps(payload, separators=(",", ":")).encode().hex()
    print("📡 Sending LoRa alert:", payload)
    lora_send(f'AT+TEST=TXLRPKT,"{hex_data}"', wait=1)

# ============================================================
# INITIALIZATION
# ============================================================
print("🚀 Starting Animal Detection System")

# HLK Radar
try:
    hlk = serial.Serial(HLK_PORT, HLK_BAUD, timeout=1)
    print("📡 HLK radar connected")
except:
    hlk = None
    print("❌ HLK radar not found")

# LoRa
try:
    lora = serial.Serial(LORA_PORT, LORA_BAUD, timeout=1)
    time.sleep(2)
    print("📡 LoRa connected")

    lora_send("AT")
    lora_send("AT+MODE=TEST")
    lora_send("AT+TEST=RFCFG,865000000,SF7,125,8,15,ON,OFF")
    lora_send("AT+TEST=POWER,14")

except Exception as e:
    print("❌ LoRa init failed:", e)
    lora = None

# ---------------- CAMERA (USB – V4L2) ----------------
cap = cv2.VideoCapture(0, cv2.CAP_V4L2)
if not cap.isOpened():
    cap = cv2.VideoCapture(1, cv2.CAP_V4L2)

if not cap.isOpened():
    print("❌ Camera not opened")
    exit(1)

# 🔴 CRITICAL FIX: FORCE MJPG
cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)
cap.set(cv2.CAP_PROP_FPS, 30)

time.sleep(1)
print("📷 Camera ready")

# ---------------- MODELS ----------------
detector = YOLO(DETECT_MODEL)
classifier = YOLO(CLASSIFY_MODEL)
print("🧠 YOLO models loaded")

cv2.imshow(WINDOW_NAME, np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8))

last_motion_time = 0
track_hits = {}
alert_sent_ids = set()

# ============================================================
# MAIN LOOP
# ============================================================
while True:

    # ---------- HLK READ ----------
    if hlk and hlk.in_waiting:
        line = hlk.readline().decode(errors="ignore").strip().lower()
        if "mov" in line:
            try:
                strength = int(line.split()[-1])
                if strength > DISTANCE_THRESHOLD:
                    last_motion_time = time.time()
            except:
                pass

    motion_active = (time.time() - last_motion_time) < MOTION_TIMEOUT

    if motion_active:
        ret, frame = cap.read()
        if not ret:
            continue

        results = detector.track(
            frame,
            tracker="bytetrack.yaml",
            persist=True,
            conf=DETECT_CONF,
            verbose=False
        )

        annotated = frame.copy()

        if results and results[0].boxes:
            for box in results[0].boxes:

                if box.id is None:
                    continue

                tid = int(box.id[0])
                track_hits[tid] = track_hits.get(tid, 0) + 1

                if track_hits[tid] < MIN_TRACK_FRAMES:
                    continue

                x1, y1, x2, y2 = map(int, box.xyxy[0])

                h, w, _ = frame.shape
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)

                if (x2 - x1) < 40 or (y2 - y1) < 40:
                    continue

                roi = frame[y1:y2, x1:x2]
                if roi.size == 0:
                    continue

                cls = classifier(roi, verbose=False)
                cls_id = int(cls[0].probs.top1)
                cls_name = cls[0].names[cls_id]
                cls_conf = float(cls[0].probs.top1conf)

                if cls_conf < CLASSIFIER_CONF:
                    continue

                risk = RISK_TABLE.get(cls_name, "UNKNOWN")
                color = (0, 0, 255) if risk == "HIGH" else (0, 255, 0)

                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    annotated,
                    f"{cls_name} {cls_conf:.2f} [{risk}]",
                    (x1, y1 - 8),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    color,
                    2
                )

                # ---------- ALERT ----------
                if risk == "HIGH" and tid not in alert_sent_ids:
                    alert_sent_ids.add(tid)

                    ts = time.strftime("%Y%m%d_%H%M%S")
                    img_path = f"{LOG_DIR}/{cls_name}_{ts}.jpg"
                    cv2.imwrite(img_path, frame)
                    print("🚨 ALERT:", cls_name)

                    if lora:
                        try:
                            send_lora_alert(cls_name)
                        except:
                            print("⚠️ LoRa send failed")

        cv2.imshow(WINDOW_NAME, annotated)

    else:
        cv2.imshow(WINDOW_NAME, np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8))

    # ---- MEMORY SAFETY ----
    if len(track_hits) > 100:
        track_hits.clear()
        alert_sent_ids.clear()

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# ============================================================
# CLEANUP
# ============================================================
cap.release()
cv2.destroyAllWindows()
if hlk:
    hlk.close()
if lora:
    lora.close()

print("🛑 System stopped")
