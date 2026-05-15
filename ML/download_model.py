from transformers import LayoutLMv3TokenizerFast, LayoutLMv3ForTokenClassification

MODEL_NAME = "microsoft/layoutlmv3-base"
SAVE_DIR = "inputs/layoutlmv3Microsoft"

# Download tokenizer
LayoutLMv3TokenizerFast.from_pretrained(
    MODEL_NAME,
    cache_dir=SAVE_DIR
)

# Download model
LayoutLMv3ForTokenClassification.from_pretrained(
    MODEL_NAME,
    cache_dir=SAVE_DIR
)

print("✅ LayoutLMv3 model downloaded")
