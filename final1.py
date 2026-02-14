# ============================================================
# FINAL TRANSMITTER
# HLK VO (GPIO25) + YOLO + LoRa-E5
# Sends JSON over LoRa
# ============================================================

import time
import json
import serial
import cv2
import numpy as np
import RPi.GPIO as GPIO
from ultralytics import YOLO

# ---------------- GPIO CONFIG ----------------
HLK_VO_PIN = 25   # GPIO25 (Pin 22)

GPIO.setmode(GPIO.BCM)
GPIO.setup(HLK_VO_PIN, GPIO.IN)

# ---------------- LORA CONFIG ----------------
LORA_PORT = "/dev/ttyUSB0"
LORA_BAUD = 9600

# ---------------- YOLO CONFIG ----------------
DETECT_MODEL = "yolov8s.pt"
CLASSIFY_MODEL = "runs/classify/train4/weights/best.pt"

CONF_THRESH = 0.7
WINDOW_NAME = "Animal Detection"

# ---------------- INIT ----------------
print("🚀 Starting Transmitter")

# LoRa
lora = serial.Serial(LORA_PORT, LORA_BAUD, timeout=1)
time.sleep(2)

def lora_cmd(cmd, delay=0.4):
    lora.write((cmd + "\r\n").encode())
    time.sleep(delay)
    print(lora.read_all().decode(errors="ignore"))

lora_cmd("AT")
lora_cmd("AT+MODE=TEST")
lora_cmd("AT+TEST=RFCFG,865000000,SF7,125,8,15,ON,OFF")
lora_cmd("AT+TEST=POWER,14")

# Camera
cap = cv2.VideoCapture(0, cv2.CAP_V4L2)
cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

# Models
detector = YOLO(DETECT_MODEL)
classifier = YOLO(CLASSIFY_MODEL)

print("📡 Waiting for motion on GPIO25...")

last_sent_time = 0
COOLDOWN = 5  # seconds

# ============================================================
# MAIN LOOP
# ============================================================
while True:

    if GPIO.input(HLK_VO_PIN) == 1:
        print("🚨 Motion detected")

        ret, frame = cap.read()
        if not ret:
            continue

        results = detector(frame, conf=0.5, verbose=False)
        annotated = frame.copy()

        if results and results[0].boxes:
            for box in results[0].boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                roi = frame[y1:y2, x1:x2]
                if roi.size == 0:
                    continue

                cls = classifier(roi, verbose=False)
                cls_id = int(cls[0].probs.top1)
                cls_name = cls[0].names[cls_id]
                cls_conf = float(cls[0].probs.top1conf)

                if cls_conf < CONF_THRESH:
                    continue

                # -------- BUILD JSON --------
                payload = {
                    "device_id": "PI_NODE_01",
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                    "detection": {
                        "label": cls_name,
                        "confidence": round(cls_conf, 2)
                    },
                    "location": {
                        "lat": 12.97,
                        "lng": 79.16
                    }
                }

                print("📤 Sending JSON:", payload)

                hex_data = json.dumps(payload, separators=(",", ":")).encode().hex()

                # ensure RX is ready
                time.sleep(0.3)
                lora_cmd(f'AT+TEST=TXLRPKT,"{hex_data}"', delay=1)

                last_sent_time = time.time()
                break

    time.sleep(0.1)

# ============================================================
# CLEANUP
# ============================================================
GPIO.cleanup()
cap.release()
