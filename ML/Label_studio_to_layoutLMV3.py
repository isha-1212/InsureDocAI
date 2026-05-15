import json
import os

# ================= CONFIG =================

LABEL_STUDIO_JSON = r"C:\vscode\CVprojects\SGP6\training.json"
BASE_IMAGE_DIR = r"C:\vscode\CVprojects\SGP6\data"
OUTPUT_JSON = r"C:\vscode\CVprojects\SGP6\Training_layoutLMV3.json"

LABEL2ID = {
    "ignored": 0,
    "hospital_name": 1,
    "patient_name": 2,
    "date": 3,
    "address": 4,
    "total_amount": 5
}

# Mapping from integer IDs to label names (for Label Studio output)
ID2LABEL = {
    0: "ignored",
    1: "hospital_name",
    2: "patient_name",
    3: "date",
    4: "address",
    5: "total_amount"
}

# =========================================


def convert_bounding_box(x_percent, y_percent, width_percent, height_percent, img_width, img_height):
    """
    Convert Label Studio percentage coordinates to LayoutLMv3 format (0-1000 range).
    
    Label Studio uses percentage coordinates (0-100).
    LayoutLMv3 expects normalized coordinates scaled to 0-1000.
    """
    # Convert percentage to pixel coordinates
    x0_pixel = (x_percent / 100.0) * img_width
    y0_pixel = (y_percent / 100.0) * img_height
    x1_pixel = ((x_percent + width_percent) / 100.0) * img_width
    y1_pixel = ((y_percent + height_percent) / 100.0) * img_height
    
    # Normalize to 0-1000 range
    x0_norm = int((x0_pixel / img_width) * 1000)
    y0_norm = int((y0_pixel / img_height) * 1000)
    x1_norm = int((x1_pixel / img_width) * 1000)
    y1_norm = int((y1_pixel / img_height) * 1000)
    
    # Ensure coordinates are within bounds
    x0_norm = max(0, min(1000, x0_norm))
    y0_norm = max(0, min(1000, y0_norm))
    x1_norm = max(0, min(1000, x1_norm))
    y1_norm = max(0, min(1000, y1_norm))
    
    return [x0_norm, y0_norm, x1_norm, y1_norm]


with open(LABEL_STUDIO_JSON, "r", encoding="utf-8") as f:
    label_studio_data = json.load(f)

output = []

for annotated_image in label_studio_data:
    # Skip entries without transcription (incomplete annotations)
    if "transcription" not in annotated_image:
        continue
    
    record = {}
    annotations = []

    # -------- Image path --------
    image_url = annotated_image["ocr"]
    relative_path = image_url.split("8080/")[-1]
    record["file_name"] = os.path.join(BASE_IMAGE_DIR, relative_path)

    # -------- Bill type --------
    record["bill_type"] = annotated_image.get("bill_type", "unknown")

    # -------- Image size --------
    first_bbox = annotated_image["bbox"][0]
    record["width"] = first_bbox["original_width"]
    record["height"] = first_bbox["original_height"]

    # -------- Token-level annotations --------
    for bb, text in zip(
        annotated_image["bbox"],
        annotated_image["transcription"]
    ):
        # Get label from rectanglelabels (can be int or string)
        raw_label = (
            bb["rectanglelabels"][0]
            if "rectanglelabels" in bb and bb["rectanglelabels"]
            else 0  # Default to 0 (ignored)
        )
        
        # Convert to label name if it's an integer
        if isinstance(raw_label, int):
            label_name = ID2LABEL.get(raw_label, "ignored")
        else:
            label_name = raw_label
        
        # Get label_id
        label_id = LABEL2ID.get(label_name, 0)

        ann = {
            "text": text,
            "box": convert_bounding_box(
                bb["x"], bb["y"], bb["width"], bb["height"],
                record["width"], record["height"]
            ),
            "label": label_name,
            "label_id": label_id
        }

        annotations.append(ann)

    record["annotations"] = annotations
    output.append(record)

# -------- Save --------
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=4)

print("✅ Conversion completed successfully")
print(f"📄 Output file: {OUTPUT_JSON}")
print(f"🖼️ Total documents: {len(output)}")
