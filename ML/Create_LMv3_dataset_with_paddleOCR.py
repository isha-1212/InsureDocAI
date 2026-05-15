# ================= SAFETY FIRST =================
import os
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["OMP_NUM_THREADS"] = "1"

# ===============================================

import json
import numpy as np
import gc
from uuid import uuid4
from PIL import Image
from paddleocr import PaddleOCR

# ================= CONFIG =================

BASE_IMAGE_DIR = r"C:\vscode\CVprojects\SGP6\data"

IMAGE_FOLDERS = [
    "hospital2/images"
    
]

VALID_EXTENSIONS = (".jpg", ".jpeg", ".png")
OUTPUT_JSON = "label2.json"
MAX_IMAGE_DIM = 1600

# ========================================


def create_image_url(relative_path):
    return f"http://localhost:8080/{relative_path.replace(os.sep, '/')}"


def generate_label_studio_json():
    print("🚀 Initializing PaddleOCR (CPU)...", flush=True)
    ocr = PaddleOCR(lang="en")   # ✅ NO use_gpu

    tasks = []
    processed = 0
    skipped = 0

    for folder in IMAGE_FOLDERS:
        folder_path = os.path.join(BASE_IMAGE_DIR, folder)

        for filename in os.listdir(folder_path):
            if not filename.lower().endswith(VALID_EXTENSIONS):
                continue

            image_path = os.path.join(folder_path, filename)
            print(f"Processing: {image_path}", flush=True)

            try:
                # ---------- Validate image ----------
                try:
                    img = Image.open(image_path)
                    img.verify()
                    img = Image.open(image_path).convert("RGB")
                except Exception:
                    raise RuntimeError("Corrupt image")

                # ---------- Resize ----------
                w, h = img.size
                if w > MAX_IMAGE_DIM or h > MAX_IMAGE_DIM:
                    img.thumbnail((MAX_IMAGE_DIM, MAX_IMAGE_DIM))

                img_np = np.array(img)
                img_h, img_w = img_np.shape[:2]

                # ---------- OCR ----------
                ocr_result = ocr.predict(img_np)

                results = []

                for res in ocr_result:
                    polys = res.get("dt_polys", [])
                    texts = res.get("rec_texts", [])
                    scores = res.get("rec_scores", [])

                    for poly, text, score in zip(polys, texts, scores):
                        if not text.strip():
                            continue

                        xs = [p[0] for p in poly]
                        ys = [p[1] for p in poly]

                        bbox = {
                            "x": 100 * min(xs) / img_w,
                            "y": 100 * min(ys) / img_h,
                            "width": 100 * (max(xs) - min(xs)) / img_w,
                            "height": 100 * (max(ys) - min(ys)) / img_h,
                            "rotation": 0
                        }

                        rid = str(uuid4())[:10]

                        results.append({
                            "id": rid,
                            "from_name": "bbox",
                            "to_name": "image",
                            "type": "rectangle",
                            "value": bbox
                        })

                        results.append({
                            "id": rid,
                            "from_name": "transcription",
                            "to_name": "image",
                            "type": "textarea",
                            "value": {
                                "text": [text],
                                **bbox
                            },
                            "score": float(score)
                        })

                rel_path = os.path.relpath(image_path, BASE_IMAGE_DIR)

                tasks.append({
                    "data": {
                        "ocr": create_image_url(rel_path)
                    },
                    "predictions": [
                        {
                            "result": results,
                            "score": 0.97
                        }
                    ]
                })

                processed += 1
                print(f"   ✓ Success ({processed} processed, {skipped} skipped)", flush=True)

                del img, img_np, ocr_result, results
                gc.collect()

            except Exception as e:
                skipped += 1
                print(f"❌ Error processing {filename}: {e}", flush=True)
                print(f"   Skipping... ({processed} processed, {skipped} skipped)", flush=True)
                gc.collect()

    print(f"\n💾 Writing JSON ({len(tasks)} tasks)...", flush=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(tasks, f, indent=4)

    print("\n✅ DONE")
    print(f"📄 File: {OUTPUT_JSON}")
    print(f"🖼️ Processed: {processed}")
    print(f"⚠️ Skipped: {skipped}")


if __name__ == "__main__":
    generate_label_studio_json()
