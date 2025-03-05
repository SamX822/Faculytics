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

@app.route('/uploadHistory')
def uploadHistory():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])
    return render_template('uploadHistory.html', user=user, title="Upload", year=datetime.now().year)

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
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])

    back_campus = request.args.get('campus', user.campus)

    if user.userType == 'admin':
        users = User.query.filter(User.college == "College of Arts and Sciences", User.campus == user.campus.upper()).all()
    elif user.userType == 'Dean':
        users = User.query.filter(User.college == "College of Arts and Sciences", User.campus == user.campus.upper(), User.userType == "Teacher").all()
    else:
        return redirect(url_for('dashboard'))

    return render_template('colleges/cas.html', back_campus=back_campus, title="College of Arts and Sciences", users=users)

@app.route('/cce')
def cce():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])

    back_campus = request.args.get('campus', user.campus)

    if user.userType == 'admin':
        users = User.query.filter(User.college == "College of Computer Engineering", User.campus == user.campus.upper()).all()
    elif user.userType == 'Dean':
        users = User.query.filter(User.college == "College of Computer Engineering", User.campus == user.campus.upper(), User.userType == "Teacher").all()
    else:
        return redirect(url_for('dashboard'))

    return render_template('colleges/cce.html', back_campus=back_campus, title="College of Computer Engineering", users=users)

@app.route('/ccs')
def ccs():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])  # Get logged-in user

    back_campus = request.args.get('campus', user.campus)  # Get campus from query params (default to user's campus)

    users = [] # Default to empty

    if user.userType == 'admin':
        users = User.query.filter(User.college == "College of Computer Studies", User.campus == back_campus.upper()).all()
    elif user.userType == 'Dean':
        users = User.query.filter(User.college == "College of Computer Studies", User.campus == back_campus.upper(), User.userType == "Teacher").all()
    else:
        return redirect(url_for('dashboard'))

    return render_template('colleges/ccs.html', back_campus=back_campus, title="College of Computer Studies", users=users)

@app.route('/c_crim')
def c_crim():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])  # Get logged-in user

    back_campus = request.args.get('campus', user.campus)  # Get campus from query params (default to user's campus)

    if user.userType == 'admin':
        users = User.query.filter(User.college == "College of Criminology", User.campus == user.campus.upper()).all()
    elif user.userType == 'Dean':
        users = User.query.filter(User.college == "College of Criminology", User.campus == user.campus.upper(), User.userType == "Teacher").all()
    else:
        return redirect(url_for('dashboard'))

    return render_template('colleges/c_crim.html', back_campus=back_campus, title="College of Criminology", users=users)

@app.route('/c_edu')
def c_edu():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])  # Get logged-in user

    back_campus = request.args.get('campus', user.campus)  # Get campus from query params (default to user's campus)

    if user.userType == 'admin':
        users = User.query.filter(User.college == "College of Education", User.campus == user.campus.upper()).all()
    elif user.userType == 'Dean':
        users = User.query.filter(User.college == "College of Education", User.campus == user.campus.upper(), User.userType == "Teacher").all()
    else:
        return redirect(url_for('dashboard'))

    return render_template('colleges/c_edu.html', back_campus=back_campus, title="College of Education", users=users)

@app.route('/c_engr')
def c_engr():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])  # Get logged-in user

    back_campus = request.args.get('campus', user.campus)  # Get campus from query params (default to user's campus)

    if user.userType == 'admin':
        users = User.query.filter(User.college == "College of Engineering", User.campus == user.campus.upper()).all()
    elif user.userType == 'Dean':
        users = User.query.filter(User.college == "College of Engineering", User.campus == user.campus.upper(), User.userType == "Teacher").all()
    else:
        return redirect(url_for('dashboard'))

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

@app.route('/get_teacher/<string:teacher_id>')
def get_teacher(teacher_id):
    # Query for teacher using their unique uName
    teacher = User.query.filter_by(user_id=teacher_id, userType="Teacher").first()
    
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    teacher_data = {
        "firstName": teacher.firstName,
        "lastName": teacher.lastName,
        "emailAddress": teacher.emailAddress,
        "phoneNumber": teacher.phoneNumber,
        "profilePicture": url_for('static', filename=teacher.profilePicture) if teacher.profilePicture else None
    }
    
    return jsonify(teacher_data)

"""
Function for upload
"""
@app.route('/upload', methods=['GET', 'POST'])
def upload_file():

      # Fetch all courses from DB

    if request.method == 'POST':
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

        # Get selected course_code from form
        course_code = request.form.get('course')

        # Convert comments to JSON format
        comments_list = df['comment'].tolist()

        # --- Sentiment Analysis ---
        sentiment_result = sentiment_analyzer.predict(comments_list)

        # Count positive and negative sentiments
        neg_count = sentiment_result["predictions"].count("Negative")
        pos_count = sentiment_result["predictions"].count("Positive")

        # Generate recommendation
        recommendation_text = (
            "There are more negative comments. Consider scheduling professional development seminars."
            if neg_count > pos_count else
            "Feedback is generally positive, but keep monitoring for potential issues."
        )
        #Send success response after transaction completes
        jsonify({"success": True, "message": "File processed successfully!", "course": course_code}), 200

        # Return response
        session["upload_results"] = {
            "filename": file.filename,
            "sentiment": sentiment_result["predictions"],
            "comments": comments_list,
            #"topics": topic_info,
            "recommendation": recommendation_text,
            "course": course_code
        }
        results = {
            "filename": file.filename,
            "sentiment": sentiment_result["predictions"],
            "comments": comments_list,
            #"topics": topic_info,
            "recommendation": recommendation_text,
            "course": course_code
        }
        return jsonify(results), 200
    elif request.method == 'GET':
        results = session.get('upload_results', {});
        return jsonify(results), 200

    return render_template('upload.html', )

@app.route('/saveToDatabase', methods=['POST'])
def saveToDatabase():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data received"}), 400
        
        comments_list = data.get("comments")
        sentiment_result = data.get("sentiment")
        recommendation_text = data.get("recommendation")
        course_code = data.get("course")
        filename = data.get("filename")

        if not comments_list or not sentiment_result or not recommendation_text or not course_code:
            return jsonify({"error": "Missing required fields"}), 400

        # Save to database
        upload_record = CSVUpload(
            filename=filename,  
            comments=json.dumps(comments_list),  
            sentiment=json.dumps(sentiment_result),  
            recommendation=recommendation_text,  
            upload_course=course_code  
        )

        db.session.add(upload_record)
        db.session.commit()

        return jsonify({"success": True, "message": "Data saved successfully!"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500
