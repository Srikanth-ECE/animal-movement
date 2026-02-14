# ============================================================
# FINAL TRANSMITTER (RISK-BASED ALERT)
# Raspberry Pi 4
# HLK VO (GPIO25) + USB Camera + YOLOv8 + LoRa-E5
# ============================================================

import os
import time
import json
import serial
import cv2
import RPi.GPIO as GPIO
from ultralytics import YOLO

# ---------------- DISPLAY FIX ----------------
os.environ["DISPLAY"] = ":0"
os.environ["QT_QPA_PLATFORM"] = "xcb"

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

# ---------------- CONFIG ----------------
HLK_VO_PIN = 25
LORA_PORT = "/dev/ttyUSB0"
LORA_BAUD = 9600

WIDTH, HEIGHT = 640, 480
DETECT_CONF = 0.5
CLASSIFY_CONF = 0.7
COOLDOWN = 5

# ---------------- GPIO ----------------
GPIO.setmode(GPIO.BCM)
GPIO.setup(HLK_VO_PIN, GPIO.IN)

# ---------------- LoRa ----------------
lora = serial.Serial(LORA_PORT, LORA_BAUD, timeout=1)
time.sleep(2)

def lora_cmd(cmd, delay=0.5):
    lora.write((cmd + "\r\n").encode())
    time.sleep(delay)
    print(lora.read_all().decode(errors="ignore"))

lora_cmd("AT")
lora_cmd("AT+MODE=TEST")
lora_cmd("AT+TEST=RFCFG,865000000,SF7,125,8,15,ON,OFF")
lora_cmd("AT+TEST=POWER,14")

# ---------------- CAMERA ----------------
cap = cv2.VideoCapture(0, cv2.CAP_V4L2)
cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)

if not cap.isOpened():
    print("❌ Camera not opened")
    exit(1)

print("📷 Camera opened")

# ---------------- YOLO ----------------
detector = YOLO("yolov8s.pt")
classifier = YOLO("runs/classify/train4/weights/best.pt")

print("🚨 Waiting for motion on GPIO25...")

last_sent = 0

# ============================================================
# MAIN LOOP
# ============================================================
try:
    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        annotated = frame.copy()

        # ---------- YOLO DETECTION ----------
        results = detector(frame, conf=DETECT_CONF, verbose=False)

        if results and results[0].boxes:
            for box in results[0].boxes:

                x1, y1, x2, y2 = map(int, box.xyxy[0])

                # ROI
                roi = frame[y1:y2, x1:x2]
                if roi.size == 0:
                    continue

                cls = classifier(roi, verbose=False)
                cls_id = int(cls[0].probs.top1)
                cls_name = cls[0].names[cls_id].lower()
                cls_conf = float(cls[0].probs.top1conf)

                if cls_conf < CLASSIFY_CONF:
                    continue

                # ---------- RISK CHECK ----------
                risk = RISK_TABLE.get(cls_name, "LOW")

                # Box color
                color = (0, 0, 255) if risk == "HIGH" else (0, 255, 0)

                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    annotated,
                    f"{cls_name} {cls_conf:.2f} [{risk}]",
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    color,
                    2
                )

                # ---------- SEND ALERT ONLY IF HIGH ----------
                if (
                    risk == "HIGH"
                    and GPIO.input(HLK_VO_PIN) == 1
                    and time.time() - last_sent > COOLDOWN
                ):
                    payload = {
                        "device_id": "PI_NODE_01",
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                        "detection": {
                            "label": cls_name,
                            "confidence": round(cls_conf, 2),
                            "risk": risk
                        },
                        "location": {
                            "lat": 12.97,
                            "lng": 79.16
                        }
                    }

                    print("🚨 HIGH RISK DETECTED → Sending JSON")
                    print(payload)

                    hex_data = json.dumps(
                        payload, separators=(",", ":")
                    ).encode().hex()

                    lora_cmd(f'AT+TEST=TXLRPKT,"{hex_data}"', delay=1)
                    last_sent = time.time()

        cv2.imshow("Animal Detection - Transmitter", annotated)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

except KeyboardInterrupt:
    print("\n🛑 Stopped")

finally:
    cap.release()
    cv2.destroyAllWindows()
    GPIO.cleanup()
    lora.close()
    print("✅ Clean exit")
