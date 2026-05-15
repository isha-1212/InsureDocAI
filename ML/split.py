import json
import random

with open("Training_layoutLMV3.json", "r") as f:
    data = json.load(f)

random.shuffle(data)

split = int(0.8 * len(data))

train_data = data[:split]
test_data = data[split:]

with open("train.json", "w") as f:
    json.dump(train_data, f, indent=4)

with open("test.json", "w") as f:
    json.dump(test_data, f, indent=4)

print("Split done")