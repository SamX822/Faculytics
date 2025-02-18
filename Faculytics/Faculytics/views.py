#views.py
from datetime import datetime
from flask import render_template, redirect, url_for, request, jsonify, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from Faculytics import app, db
from Faculytics.models import User, CSVUpload
import pandas as pd
import json
import os

# ML libraries
from transformers import pipeline
from bertopic import BERTopic
from sklearn.ensemble import RandomForestClassifier

# MarkyBoyax Sentiment Analysis Model
from Faculytics.src.SentimentAnalysis_functions import SentimentAnalyzer
sentiment_analyzer = SentimentAnalyzer()

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

@app.context_processor
def inject_user():
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
    return dict(user=user)

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

IMG_ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in IMG_ALLOWED_EXTENSIONS

@app.route('/my_account', methods=['GET', 'POST'])
def my_account():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])

    if request.method == 'POST':
        first_name = request.form.get('firstName')
        last_name = request.form.get('lastName')
        email_address = request.form.get('emailAddress')
        phone_number = request.form.get('phoneNumber')
        profile_picture = request.files.get('profileImage')        

        if first_name and last_name:
            user.firstName = first_name
            user.lastName = last_name
            user.emailAddress = email_address
            user.phoneNumber = phone_number
        
        if profile_picture and allowed_file(profile_picture.filename):
            # Delete the old profile picture if it exists
            old_picture_path = f'Faculytics/static/{user.profilePicture}'
            if user.profilePicture and os.path.exists(old_picture_path):
                os.remove(old_picture_path)
            filename, file_extension = os.path.splitext(secure_filename(profile_picture.filename))
            filename = f"U_{user.id}_ProfilePicture{file_extension}"
            file_path = f'Faculytics/static/uploads/{filename}'
            profile_picture.save(file_path)
            user.profilePicture = f'uploads/{filename}'
        
        db.session.commit()
        flash("Account updated successfully!", "success")
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

@app.route('/ucm')
def ucm():
    return render_template('ucm.html')

@app.route('/uclm')
def uclm():
    return render_template('uclm.html')

@app.route('/ucb')
def ucb():
    return render_template('ucb.html')

@app.route('/ucpt')
def ucpt():
    return render_template('ucpt.html')

@app.route('/cas')
def cas():
    back_campus = request.args.get('campus', 'ucm')
    user = User.query.get(session['user_id'])  # Get current user

    if user and user.userType == 'admin':  
        users = User.query.filter(User.college == "College of Arts and Sciences").all()
    else:
        users = User.query.filter(User.userType == 'Teacher', User.college == "College of Arts and Sciences").all()

    return render_template('colleges/cas.html', back_campus=back_campus, title="College of Arts and Sciences", users=users)

@app.route('/cce')
def cce():
    back_campus = request.args.get('campus', 'ucm')
    user = User.query.get(session['user_id'])  # Get current user

    if user and user.userType == 'admin':  
        users = User.query.filter(User.college == "College of Computer Engineering").all()
    else:
        users = User.query.filter(User.userType == 'Teacher', User.college == "College of Computer Engineering").all()

    return render_template('colleges/cce.html', back_campus=back_campus, title="College of Computer Engineering", users=users)

@app.route('/ccs')
def ccs():
    back_campus = request.args.get('campus', 'ucm')
    user = User.query.get(session['user_id'])  # Get current user

    if user and user.userType == 'admin':  
        users = User.query.filter(User.college == "College of Computer Studies").all()
    else:
        users = User.query.filter(User.userType == 'Teacher', User.college == "College of Computer Studies").all()

    return render_template('colleges/ccs.html', back_campus=back_campus, title="College of Computer Studies", users=users)

@app.route('/c_crim')
def c_crim():
    back_campus = request.args.get('campus', 'ucm')
    user = User.query.get(session['user_id'])  # Get current user

    if user and user.userType == 'admin':  
        users = User.query.filter(User.college == "College of Criminology").all()
    else:
        users = User.query.filter(User.userType == 'Teacher', User.college == "College of Criminology").all()

    return render_template('colleges/c_crim.html', back_campus=back_campus, title="College of Criminology", users=users)

@app.route('/c_edu')
def c_edu():
    back_campus = request.args.get('campus', 'ucm')
    user = User.query.get(session['user_id'])  # Get current user

    if user and user.userType == 'admin':  
        users = User.query.filter(User.college == "College of Education").all()
    else:
        users = User.query.filter(User.userType == 'Teacher', User.college == "College of Education").all()

    return render_template('colleges/c_edu.html', back_campus=back_campus, title="College of Education", users=users)

@app.route('/c_engr')
def c_engr():
    back_campus = request.args.get('campus', 'ucm')
    user = User.query.get(session['user_id'])  # Get current user

    if user and user.userType == 'admin':  
        users = User.query.filter(User.college == "College of Engineering").all()
    else:
        users = User.query.filter(User.userType == 'Teacher', User.college == "College of Engineering").all()

    return render_template('colleges/c_engr.html', back_campus=back_campus, title="College of Engineering", users=users)

@app.route('/delete_teacher/<int:teacher_id>', methods=['POST'])
def delete_teacher(teacher_id):
    # Ensure the user is logged in and is an admin.
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    current_user = User.query.get(session['user_id'])
    if current_user.userType != 'admin':
        flash("Unauthorized action.", "danger")
        return redirect(request.referrer or url_for('dashboard'))
    
    # Find the account and delete if found
    teacher = User.query.get(teacher_id)
    if teacher and teacher.userType != 'admin':
        db.session.delete(teacher)
        db.session.commit()
        flash("Account deleted successfully.", "success")
    else:
        flash("Account not found.", "danger")
    
    return redirect(request.referrer or url_for('dashboard'))

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'csv_file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['csv_file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        df = pd.read_csv(file)
    except Exception as e:
        return jsonify({"error": f"Error reading CSV: {str(e)}"}), 400

    if 'comment' not in df.columns:
        return jsonify({"error": "CSV file missing required 'comment' column."}), 400

    # Convert comments to JSON format
    comments_list = df['comment'].tolist()
    print(comments_list)

    # --- Sentiment Analysis ---
    sentiment_result = sentiment_analyzer.predict(comments_list)

    # Count positive and negative sentiments
    neg_count = sentiment_result["predictions"].count("Negative")
    pos_count = sentiment_result["predictions"].count("Positive")

    """ TODO Guba pa ang topic modelling
   --- Topic Modeling ---
    topics, probs = topic_model.fit_transform(comments_list)
    topic_info = topic_model.get_topic_info().to_dict(orient="records")

    # Add strength and color attributes
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
    """
    # Generate recommendation
    recommendation_text = (
        "There are more negative comments. Consider scheduling professional development seminars."
        if neg_count > pos_count else
        "Feedback is generally positive, but keep monitoring for potential issues."
    )

    # Store data in the database
    try:
        upload_record = CSVUpload(
            filename=file.filename,
            comments=json.dumps(comments_list),  # Store original comments
            sentiment=json.dumps(sentiment_result["predictions"]),  # Store sentiment results
            #topics=json.dumps(topic_info),  # Store topic modeling results
            recommendation=recommendation_text  # Store recommendation
        )
        db.session.add(upload_record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

    # Return response
    results = {
        "sentiment": sentiment_result["predictions"],
        "comments": comments_list,
        #"topics": topic_info,
        "recommendation": recommendation_text
    }
    
    return jsonify(results), 200
