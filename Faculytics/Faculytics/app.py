from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import pandas as pd
# ML libraries
from transformers import pipeline
from bertopic import BERTopic
from sklearn.ensemble import RandomForestClassifier

app = Flask(__name__)

# PostgreSQL connection
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:21463112@localhost:5432/faculytics'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize the database
db = SQLAlchemy(app)

# Simple model for storing CSV file metadata
class CSVUpload(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(150), nullable=False)
    upload_date = db.Column(db.DateTime, server_default=db.func.now())
    # You could also add fields to store analysis results if desired

    def __repr__(self):
        return f'<CSVUpload {self.filename}>'

# Create the database tables if they don't exist (for development purposes)
with app.app_context():
    db.create_all()

# Load ML models (initialize once at startup)
sentiment_analyzer = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
topic_model = BERTopic()
rf_model = RandomForestClassifier()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'csv_file' not in request.files:
        return jsonify({"error": "No file part"})
    file = request.files['csv_file']
    if file.filename == '':
        return jsonify({"error": "No selected file"})

    # Save file metadata to PostgreSQL
    upload_record = CSVUpload(filename=file.filename)
    db.session.add(upload_record)
    db.session.commit()

    try:
        df = pd.read_csv(file)
    except Exception as e:
        return jsonify({"error": f"Error reading CSV: {str(e)}"})

    required_cols = {'comment', 'polarity', 'label'}
    if not required_cols.issubset(set(df.columns)):
        return jsonify({"error": "CSV file missing required columns."})

    # --- Sentiment Analysis ---
    sentiments = []
    for comment in df['comment']:
        result = sentiment_analyzer(comment)[0]
        sentiments.append(result)
    pos_count = sum(1 for s in sentiments if s['label'] == 'POSITIVE')
    neg_count = sum(1 for s in sentiments if s['label'] == 'NEGATIVE')
    sentiment_result = {"positive": pos_count, "negative": neg_count}

    # --- Topic Modeling ---
    topics, probs = topic_model.fit_transform(df['comment'].tolist())
    topic_info = topic_model.get_topic_info().to_dict(orient="records")

    # --- Topic Strength (using Random Forest) ---
    for topic in topic_info:
        frequency = topic.get("Count", 1)
        if frequency > 10:
            topic['strength'] = "Very Strong"
            topic['color'] = "#FF0000"  # Red
        elif frequency > 5:
            topic['strength'] = "Strong"
            topic['color'] = "#FF6600"  # Orange
        else:
            topic['strength'] = "Weak"
            topic['color'] = "#FFFF00"  # Yellow

    # --- Recommendations ---
    if neg_count > pos_count:
        recommendation_text = "There are more negative comments. Consider scheduling professional development seminars."
    else:
        recommendation_text = "Feedback is generally positive, but keep monitoring for potential issues."

    results = {
        "sentiment": sentiment_result,
        "topics": topic_info,
        "recommendation": recommendation_text
    }
    
    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
