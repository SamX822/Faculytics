#views.py
from datetime import datetime
from flask import render_template, redirect, url_for, request, jsonify, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from Faculytics import app, db
from Faculytics.models import User, CSVUpload, College, Campus
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
        campus_acronym = request.form.get('campus_acronym')
        college_name = request.form.get('college_name')

        # Check if the username already exists
        if User.query.filter_by(uName=uName).first():
            flash("Username already exists. Please choose another.", "danger")
            return redirect(url_for('register'))

        # Verify if the campus exists
        campus = Campus.query.filter_by(campus_acronym=campus_acronym).first()
        if not campus:
            flash("Invalid campus selected.", "danger")
            return redirect(url_for('register'))

        # Verify if the college exists (only if userType requires it)
        college = None
        if userType in ['Dean', 'Teacher']:
            college = College.query.filter_by(college_name=college_name).first()
            if not college:
                flash("Invalid college selected.", "danger")
                return redirect(url_for('register'))

        # Hash the password
        hashed_password = generate_password_hash(pWord, method='pbkdf2:sha256')

        # Create new user
        new_user = User(
            userType=userType,
            firstName=firstName,
            lastName=lastName,
            uName=uName,
            pWord=hashed_password,
            campus_acronym=campus_acronym,
            college_name=college_name if userType in ['Dean', 'Teacher'] else None
        )
        db.session.add(new_user)
        db.session.commit()

        flash("Registration successful! You can now log in.", "success")
        return redirect(url_for('login'))

    # Fetch available campuses and colleges for the registration form
    campuses = Campus.query.all()
    colleges = College.query.all()

    return render_template('register.html', title="Register", year=datetime.now().year, campuses=campuses, colleges=colleges)

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
    
    # Fetch assigned campus for non-admin users
    assigned_campus = None
    if user.userType != "admin" and user.campus_acronym:
        assigned_campus = Campus.query.filter_by(campus_acronym=user.campus_acronym).first()

    # Admins see all campuses
    campuses = Campus.query.all() if user.userType == "admin" else [assigned_campus] if assigned_campus else []

    return render_template('dashboard.html', user=user, assigned_campus=assigned_campus, campuses=campuses, title="Dashboard", year=datetime.now().year)

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

@app.route('/campus/<string:campus_acronym>')
def campus_page(campus_acronym):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    # Convert campus_acronym to uppercase
    campus = Campus.query.filter_by(campus_acronym=campus_acronym.upper()).first_or_404()
    
    # Access the colleges associated with this campus via the many-to-many relationship
    campus_colleges = campus.colleges

    # Get the logged-in user
    user = User.query.get(session['user_id'])

    # Determine which colleges should be visible based on userType
    visible_colleges = []

    if user.userType == 'admin':
        # Admins can see all colleges
        visible_colleges = campus_colleges
    elif user.userType == 'Dean':
        # Deans can only see their assigned college
        visible_colleges = [college for college in campus_colleges if college.college_name == user.college_name]
    elif user.userType in ['Campus Director', 'Vice Chancellor']:
        # Campus Directors & Vice Chancellors can see all colleges but unclickable
        visible_colleges = campus_colleges

    return render_template(
        'campus.html', campus=campus, visible_colleges=visible_colleges, user=user, title=campus.campus_name)

@app.route('/college/<string:college_acronym>/<string:campus_acronym>')
def college_page(college_acronym, campus_acronym):  
    if 'user_id' not in session:
        return redirect(url_for('login'))

    # Find the college by its acronym
    college = College.query.filter_by(college_acronym=college_acronym.upper()).first_or_404()

    # Get the associated campus
    campus = Campus.query.filter_by(campus_acronym=campus_acronym.upper()).first_or_404()

    if not campus:
        return "Associated campus not found", 404

    # Get the logged-in user
    user = User.query.get(session['user_id'])

    # User type restrictions and filter users by college and campus
    if user.userType == 'admin':
        # Admins can see all users for this college and campus
        users = User.query.filter(
            User.college.has(college_name=college.college_name),
            User.campus_acronym == campus.campus_acronym
        ).all()
    elif user.userType == 'Dean':
        # Deans can only see Teachers from their assigned college and campus
        users = User.query.filter(
            User.college.has(college_name=college.college_name),
            User.campus_acronym == campus.campus_acronym,
            User.userType == "Teacher"
        ).all()
    else:
        return redirect(url_for('dashboard'))

    return render_template(
        'college.html', campus=campus, college=college, users=users, title=college.college_name)

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

@app.route('/add_college/<campus>', methods=['POST'])
def add_college(campus):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    if user.userType not in ['Campus Director', 'Vice Chancellor']:
        return redirect(url_for('dashboard'))  # Unauthorized if not a Campus Director or Vice Chancellor

    college_name = request.form.get('college_name')
    college_acronym = college_name[:4].upper()  # Simple acronym creation based on name (you can improve this logic)

    # Check if the college already exists
    existing_college = College.query.filter_by(college_name=college_name).first()
    if existing_college:
        flash(f'College "{college_name}" already exists.', 'danger')
        return redirect(url_for('ucm'))

    # Add new college to the Colleges table
    new_college = College(college_name=college_name, college_acronym=college_acronym)
    db.session.add(new_college)
    db.session.commit()

    flash(f'New college "{college_name}" has been added.', 'success')
    return redirect(url_for('ucm'))

@app.route('/remove_college/<campus>', methods=['POST'])
def remove_college(campus):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    if user.userType not in ['Campus Director', 'Vice Chancellor']:
        return redirect(url_for('dashboard'))  # Unauthorized if not a Campus Director or Vice Chancellor

    college_to_remove = request.form.get('college_to_remove')

    # Query and delete the selected college
    college = College.query.filter_by(college_name=college_to_remove).first()
    if college:
        db.session.delete(college)
        db.session.commit()
        flash(f'College "{college_to_remove}" has been removed.', 'success')
    else:
        flash(f'College "{college_to_remove}" not found.', 'danger')

    return redirect(url_for('ucm'))

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