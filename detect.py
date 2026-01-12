import cv2
import time
import winsound
from ultralytics import YOLO

# ================== LOAD MODELS ==================
detector = YOLO("yolov8n.pt")                     # Object detection
classifier = YOLO("runs/classify/train4/weights/best.pt")  # Animal classifier

# ================== CATEGORIES ==================
WILD_ANIMALS = [
    "bear", "cheetah", "elephant", "leopard",
    "lion", "tiger", "wolf", "bison"
]

DOMESTIC_ANIMALS = ["cow", "dog", "rooster", "sheep"]

# ================== CAMERA ==================
cap = cv2.VideoCapture(0)
last_beep_time = 0

# ================== OPENCV MODULES ==================
bg = cv2.createBackgroundSubtractorMOG2()

# HOG + SVM (Human pre-filter)
hog = cv2.HOGDescriptor()
hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

# Restricted zone
ZONE = (200, 120, 450, 360)  # x1, y1, x2, y2

# ================== MAIN LOOP ==================
while True:
    ret, frame = cap.read()
    if not ret:
        break

    status = "SAFE"
    color = (0, 255, 0)

    # ---------- BACKGROUND SUBTRACTION ----------
    fgmask = bg.apply(frame)
    _, thresh = cv2.threshold(fgmask, 200, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(
        thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    motion_detected = len(contours) > 5

    # Draw restricted zone
    zx1, zy1, zx2, zy2 = ZONE
    cv2.rectangle(frame, (zx1, zy1), (zx2, zy2), (0, 0, 255), 2)

    if motion_detected:

        # ---------- HOG + SVM (HUMAN PRE-FILTER) ----------
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        hog_boxes, _ = hog.detectMultiScale(
            gray,
            winStride=(8, 8),
            padding=(8, 8),
            scale=1.05
        )

        # Filter tiny / poster / phone detections
        hog_boxes = [
            (x, y, w, h) for (x, y, w, h) in hog_boxes
            if w > 80 and h > 150
        ]

        # ---------- YOLO VERIFICATION ----------
        detections = detector(frame, verbose=False)
        yolo_person_detected = False

        for det in detections:
            for box in det.boxes:
                label = detector.names[int(box.cls[0])]
                if label == "person":
                    yolo_person_detected = True
                    break

        # ---------- CONFIRMED HUMAN ----------
        if len(hog_boxes) > 0 and yolo_person_detected:
            status = "HUMAN DETECTED"
            color = (0, 255, 0)

            for (hx, hy, hw, hh) in hog_boxes:
                cv2.rectangle(
                    frame,
                    (hx, hy),
                    (hx + hw, hy + hh),
                    (255, 0, 0),
                    2
                )

        else:
            # ---------- ANIMAL PIPELINE ----------
            for det in detections:
                for box in det.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    label = detector.names[cls_id]

                    if conf < 0.5 or label == "person":
                        continue

                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cropped = frame[y1:y2, x1:x2]

                    if cropped.size == 0:
                        continue

                    # ---------- YOLO CLASSIFICATION ----------
                    results = classifier(cropped, verbose=False)
                    probs = results[0].probs
                    if probs is None:
                        continue

                    animal = classifier.names[probs.top1].lower()
                    confidence = float(probs.top1conf)

                    if confidence < 0.6:
                        status = "UNKNOWN OBJECT"
                        continue

                    # Draw bounding box
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(
                        frame,
                        f"{animal.upper()} {confidence:.2f}",
                        (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (0, 255, 0),
                        2
                    )

                    # Zone check
                    cx = (x1 + x2) // 2
                    cy = (y1 + y2) // 2
                    inside_zone = zx1 < cx < zx2 and zy1 < cy < zy2

                    if animal in WILD_ANIMALS:
                        status = f"WILD ANIMAL ({animal.upper()})"
                        color = (0, 0, 255)

                        if inside_zone:
                            current_time = time.time()
                            if current_time - last_beep_time >= 3:
                                winsound.Beep(1500, 500)
                                last_beep_time = current_time
                                print(f"⚠️ ALERT: {animal} in restricted zone")

                    elif animal in DOMESTIC_ANIMALS:
                        status = f"DOMESTIC ANIMAL ({animal.upper()})"
                        color = (0, 255, 0)

    # ---------- DISPLAY ----------
    cv2.putText(
        frame,
        status,
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        color,
        2
    )

    cv2.imshow("AI & IoT Animal Movement Detection – PS38", frame)

    if cv2.waitKey(1) & 0xFF == 27:
        break

# ================== CLEANUP ==================
cap.release()
cv2.destroyAllWindows()
