import cv2
import time
import winsound
from ultralytics import YOLO

# ---------------- LOAD MODELS ----------------
detector = YOLO("yolov8n.pt")  # object detection
classifier = YOLO("runs/classify/train3/weights/best.pt")

# ---------------- CATEGORIES ----------------
WILD_ANIMALS = ["bear", "cheetah", "elephant", "leopard", "lion", "tiger", "wolf", "bison"]
DOMESTIC_ANIMALS = ["cow", "dog", "rooster", "sheep"]

cap = cv2.VideoCapture(0)
last_beep_time = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    status = "SAFE"
    color = (0, 255, 0)

    detections = detector(frame, verbose=False)

    for box in detections[0].boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        label = detector.names[cls_id]

        if conf < 0.5:
            continue

        x1, y1, x2, y2 = map(int, box.xyxy[0])
        cropped = frame[y1:y2, x1:x2]

        # ---------- HUMAN ----------
        if label == "person":
            status = "HUMAN DETECTED "
            color = (0, 255, 0)
            break

        # ---------- ANIMAL ----------
        if cropped.size == 0:
            continue

        results = classifier(cropped)
        probs = results[0].probs

        if probs is None:
            continue

        animal = classifier.names[probs.top1].lower()
        confidence = float(probs.top1conf)

        if confidence < 0.6:
            status = "LOW CONFIDENCE OBJECT"
            continue

        if animal in WILD_ANIMALS:
            status = f"WILD ANIMAL  ({animal})"
            color = (0, 0, 255)

            current_time = time.time()
            if current_time - last_beep_time >= 3:
                winsound.Beep(1500, 500)
                last_beep_time = current_time

        elif animal in DOMESTIC_ANIMALS:
            status = f"DOMESTIC ANIMAL  ({animal})"
            color = (0, 255, 0)

    cv2.putText(frame, status, (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

    cv2.imshow("Smart Border Animal Monitoring System", frame)

    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
