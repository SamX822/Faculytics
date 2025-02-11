from datetime import datetime
from flask import render_template, redirect, url_for, request, jsonify, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
from Faculytics import app, db
from Faculytics.models import User, CSVUpload
import pandas as pd

# ML libraries
from transformers import pipeline
from bertopic import BERTopic
from sklearn.ensemble import RandomForestClassifier

# Load ML models (you could alternatively move this code into a separate ml.py module)
sentiment_analyzer = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
topic_model = BERTopic()
rf_model = RandomForestClassifier()

@app.route('/')
def index():
    # Redirect to the login page by default
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        uName = request.form.get('uName')
        pWord = request.form.get('pWord')
        user = User.query.filter_by(uName=uName).first()
        if user and check_password_hash(user.pWord, pWord):
            session['user_id'] = user.id  # Store user ID in session
            return redirect(url_for('dashboard'))
        else:
            error = "Invalid username or password."
    return render_template('login.html', error=error, title="Login", year=datetime.now().year)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        userType = request.form.get('userType')
        firstName = request.form.get('firstName')
        lastName = request.form.get('lastName')
        uName = request.form.get('uName')
        pWord = request.form.get('pWord')
        campus = request.form.get('campus')
        college = request.form.get('college')
        if User.query.filter_by(uName=uName).first():
            return "Username already exists. Please choose another.", 400
        hashed_password = generate_password_hash(pWord)
        new_user = User(
            userType=userType,
            firstName=firstName,
            lastName=lastName,
            uName=uName,
            pWord=hashed_password,
            campus=campus,
            college=college if userType in ['Dean', 'Teacher'] else None
        )
        db.session.add(new_user)
        db.session.commit()
        return redirect(url_for('login'))
    return render_template('register.html', title="Register", year=datetime.now().year)

#Check username
@app.route('/check_username', methods=['POST'])
def check_username():
    data = request.json
    username = data.get('uName')
    user_exists = User.query.filter_by(uName=username).first() is not None
    return jsonify({"exists": user_exists})

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])
    return render_template('dashboard.html', user=user, title="Dashboard", year=datetime.now().year)

@app.route('/my_account', methods=['GET', 'POST'])
def my_account():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])

    if request.method == 'POST':
        first_name = request.form.get('firstName')
        last_name = request.form.get('lastName')

        if first_name and last_name:
            user.firstName = first_name
            user.lastName = last_name
            db.session.commit()
            flash("Account updated successfully!", "success")
        else:
            flash("First name and last name cannot be empty.", "danger")

        return redirect(url_for('my_account'))

    return render_template('my_account.html', user=user, title="My Account", year=datetime.now().year)

@app.route('/delete_account', methods=['POST'])
def delete_account():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    db.session.delete(user)
    db.session.commit()
    session.pop('user_id', None)  # Remove user from session

    flash("Your account has been deleted.", "info")
    return redirect(url_for('login'))

@app.route('/contact')
def contact():
    return render_template('contact.html', title="Contact", year=datetime.now().year, message="Your contact page.")

@app.route('/about')
def about():
    return render_template('about.html', title="About", year=datetime.now().year, message="Your application description page.")

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
    sentiments = [sentiment_analyzer(comment)[0] for comment in df['comment']]
    pos_count = sum(1 for s in sentiments if s['label'] == 'POSITIVE')
    neg_count = sum(1 for s in sentiments if s['label'] == 'NEGATIVE')
    sentiment_result = {"positive": pos_count, "negative": neg_count}
    # --- Topic Modeling ---
    topics, probs = topic_model.fit_transform(df['comment'].tolist())
    topic_info = topic_model.get_topic_info().to_dict(orient="records")
    for topic in topic_info:
        frequency = topic.get("Count", 1)
        if frequency > 10:
            topic['strength'] = "Very Strong"
            topic['color'] = "#FF0000"
        elif frequency > 5:
            topic['strength'] = "Strong"
            topic['color'] = "#FF6600"
        else:
            topic['strength'] = "Weak"
            topic['color'] = "#FFFF00"
    recommendation_text = (
        "There are more negative comments. Consider scheduling professional development seminars."
        if neg_count > pos_count else
        "Feedback is generally positive, but keep monitoring for potential issues."
    )
    results = {
        "sentiment": sentiment_result,
        "topics": topic_info,
        "recommendation": recommendation_text
    }
    return jsonify(results)
