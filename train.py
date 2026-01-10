from ultralytics import YOLO

def main():
    model = YOLO("yolov8n-cls.pt")

    model.train(
        data="dataset",
        epochs=30,
        imgsz=224,
        batch=32,     # RTX 3050 safe
        device=0,     # GPU
        workers=0     # IMPORTANT for Windows
    )

if __name__ == "__main__":
    main()
