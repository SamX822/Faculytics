from transformers import AutoModelForSequenceClassification, AutoTokenizer
from huggingface_hub import login
import torch
import os

login(token="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")
# Will delete if proven unnecessary
current_dir = os.path.dirname(os.path.abspath(__file__))
#model_path = os.path.join(current_dir, "..", "ml_models", "distilbert-sentiment-analysis", "checkpoint-4452")
#"C:/Users/Bentot/source/repos/KrammyBoy/Faculytics/Faculytics/Faculytics/ml_models/DistilBERT-Sentiment-Analysis/checkpoint-4452"

# Using Huggingface model from me
model_id = "Markus112/distilbert-sentiment-analysis"
class SentimentAnalyzer:
    def __init__(self): #def __init__(self, model_path = model_path):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = AutoModelForSequenceClassification.from_pretrained(model_id, use_auth_token=True)
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, use_auth_Token=True)

    def predict(self, texts):
        inputs = self.tokenizer(texts, return_tensors="pt", truncation=True, padding=True)

        # Remove 'token_type_ids' if present
        if "token_type_ids" in inputs:
            del inputs["token_type_ids"]

        inputs = {key: val.to(self.device) for key, val in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)

        logits = outputs.logits
        probabilities = torch.nn.functional.softmax(logits, dim=-1)
        predicted_classes = torch.argmax(probabilities, dim=-1).tolist()
        predictions = ["Positive" if cls == 1 else "Negative" for cls in predicted_classes]

        return {
            "logits": logits.tolist(),
            "probabilities": probabilities.tolist(),
            "predicted_classes": predicted_classes,
            "predictions": predictions,
        }
