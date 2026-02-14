import cv2

gst = (
    "v4l2src device=/dev/video0 ! "
    "video/x-raw, width=640, height=480, framerate=30/1 ! "
    "videoconvert ! appsink"
)

cap = cv2.VideoCapture(gst, cv2.CAP_GSTREAMER)

if not cap.isOpened():
    print("Camera open failed")
    exit()

while True:
    ret, frame = cap.read()
    if not ret:
        continue

    cv2.imshow("USB CAM", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
