#views.py
from datetime import datetime
from flask import render_template, redirect, url_for, request, jsonify, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from Faculytics import app, db
from Faculytics.models import User, CSVUpload, College, Campus, UserApproval, Program
import pandas as pd
import json
import os
import traceback

# ML libraries
from transformers import pipeline
from bertopic import BERTopic
from sklearn.ensemble import RandomForestClassifier

# MarkyBoyax Sentiment Analysis Model
from Faculytics.src.SentimentAnalysis_functions import SentimentAnalyzer
# Magax Topic Modeling Model
from Faculytics.src.TopicModeling_functions import CommentProcessor
sentiment_analyzer = SentimentAnalyzer()
topic_modeling = CommentProcessor()

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
        program_acronym = request.form.get('program_acronym') if userType in ['Teacher', 'Chairperson'] else None

        if User.query.filter_by(uName=uName).first() or UserApproval.query.filter_by(uName=uName).first():
            flash("Username already exists. Please choose another.", "danger")
            return redirect(url_for('register'))

        hashed_password = generate_password_hash(pWord, method='pbkdf2:sha256')

        new_user = UserApproval(
            userType=userType,
            firstName=firstName,
            lastName=lastName,
            uName=uName,
            pWord=hashed_password,
            campus_acronym="N/A" if userType in ['Curriculum Developer'] else campus_acronym,
            college_name=college_name if userType in ['Dean', 'Teacher', 'Chairperson'] else "N/A",
            program_acronym=program_acronym if userType in ['Teacher', 'Chairperson'] else "N/A"
        )
        db.session.add(new_user)
        db.session.commit()

        flash("Registration submitted for approval.", "info")
        return redirect(url_for('login'))

    campuses = Campus.query.all()
    colleges = College.query.all()
    programs = Program.query.all()

    return render_template('register.html', title="Register", campuses=campuses, colleges=colleges, programs=programs)

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
    
    # Admins and Curriculum Developers see all campuses, excluding the "NONE" campus
    if user.userType in ["admin", "Curriculum Developer"]:
        campuses = Campus.query.filter(Campus.campus_acronym != "NONE").all()
    else:
        campuses = [assigned_campus] if assigned_campus else []
    
    # Get pending approval counts for Deans, Campus Directors, and Vice Chancellors
    pending_approvals = 0
    if user.userType in ["Dean", "Campus Director", "Vice Chancellor"]:
        # Build query based on user type and assignment
        query = UserApproval.query
        
        if user.userType == "Dean" and user.college_name:
            # Deans only see approvals for their college
            query = query.filter_by(college_name=user.college_name)
        elif user.userType == "Campus Director" and user.campus_acronym:
            # Campus Directors only see approvals for their campus
            query = query.filter_by(campus_acronym=user.campus_acronym)
        # Vice Chancellors see all approvals (no filter)
        
        pending_approvals = query.count()
    
    return render_template(
        'dashboard.html', 
        user=user, 
        assigned_campus=assigned_campus, 
        campuses=campuses,
        pending_approvals=pending_approvals,
        title="Dashboard", 
        year=datetime.now().year
    )

@app.route('/approval')
def approval_page():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])

    # Only Deans, Campus Directors, and Vice Chancellors can access this page
    if user.userType not in ["Dean", "Campus Director", "Vice Chancellor", "Vice Chancellor for Academic Affairs"]:
        flash("Unauthorized access.", "danger")
        return redirect(url_for('dashboard'))

    # Apply filtering based on user type
    if user.userType == "Vice Chancellor for Academic Affairs":
        # Can approve or reject all users
        pending_users = UserApproval.query.all()

    elif user.userType == "Dean":
        # Can approve users in the same campus and college, or "N/A" users aka Curriculum Developers
        pending_users = UserApproval.query.filter(
            ((UserApproval.campus_acronym == user.campus_acronym) & 
             (UserApproval.college_name == user.college_name)) |
            ((UserApproval.campus_acronym == "N/A") & 
             (UserApproval.college_name == "N/A"))
        ).all()

    else:
        # For user type Campus Director
        pending_users = UserApproval.query.filter(
            (UserApproval.campus_acronym == user.campus_acronym) |
            ((UserApproval.campus_acronym == "N/A") & 
             (UserApproval.college_name == "N/A"))
        ).all()


    return render_template('approval.html', pending_users=pending_users, title="User Approval")

@app.route('/approve_user/<int:user_id>', methods=['POST'])
def approve_user(user_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    if user.userType not in ["Dean", "Campus Director", "Vice Chancellor", "Vice Chancellor for Academic Affairs"]:
        flash("Unauthorized action.", "danger")
        return redirect(url_for('dashboard'))

    pending_user = UserApproval.query.get(user_id)
    if not pending_user:
        flash("User not found.", "danger")
        return redirect(url_for('approval_page'))

    # Deans can only approve users under their assigned campus AND college
    if user.userType == "Dean" and (
        pending_user.campus_acronym != user.campus_acronym or pending_user.college_name != user.college_name
    ):
        flash("You can only approve users under your assigned campus and college.", "danger")
        return redirect(url_for('approval_page'))

    # Move user from UserApproval to Users
    approved_user = User(
        userType=pending_user.userType,
        firstName=pending_user.firstName,
        lastName=pending_user.lastName,
        uName=pending_user.uName,
        pWord=pending_user.pWord,
        campus_acronym=pending_user.campus_acronym,
        college_name=pending_user.college_name
    )
    db.session.add(approved_user)
    db.session.delete(pending_user)
    db.session.commit()

    flash(f"{pending_user.firstName} {pending_user.lastName} has been approved.", "success")
    return redirect(url_for('approval_page'))

@app.route('/reject_user/<int:user_id>', methods=['POST'])
def reject_user(user_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    if user.userType not in ["Dean", "Campus Director", "Vice Chancellor", "Vice Chancellor for Academic Affairs"]:
        flash("Unauthorized action.", "danger")
        return redirect(url_for('dashboard'))

    pending_user = UserApproval.query.get(user_id)
    if not pending_user:
        flash("User not found.", "danger")
        return redirect(url_for('approval_page'))

    # Deans can only reject users under their assigned campus AND college
    if user.userType == "Dean" and (
        pending_user.campus_acronym != user.campus_acronym or pending_user.college_name != user.college_name
    ):
        flash("You can only reject users under your assigned campus and college.", "danger")
        return redirect(url_for('approval_page'))

    db.session.delete(pending_user)
    db.session.commit()

    flash(f"{pending_user.firstName} {pending_user.lastName} has been rejected.", "danger")
    return redirect(url_for('approval_page'))

@app.route('/uploadHistory')
def uploadHistory():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])

    teacher_username = request.args.get('teacher')
    teacher_full_name = None

    if teacher_username:
        teacher = User.query.filter_by(uName=teacher_username).first()
        if teacher:
            teacher_full_name = f"{teacher.firstName} {teacher.lastName}"

    return render_template('uploadHistory.html', user=user, teacher_name=teacher_full_name, title="Upload", year=datetime.now().year)

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
    user.isDeleted = True  # Mark the user as deleted
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

    if user.userType in ['admin', 'Curriculum Developer']:
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
    if user.userType in ['admin', 'Curriculum Developer']:
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
    
    # Find the account and mark it as deleted if found
    teacher = User.query.get(teacher_id)
    if teacher and teacher.userType != 'admin':
        teacher.isDeleted = True  # Mark the teacher as deleted
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

@app.route('/add_college/<campus_acronym>', methods=['POST'])
def add_college(campus_acronym):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    
    # Check if the user is a Dean, Campus Director, or Vice Chancellor
    if user.userType not in ['Dean', 'Campus Director', 'Vice Chancellor']:
        flash("Unauthorized action.", "danger")
        return redirect(url_for('dashboard'))  # Unauthorized if not a Dean, Campus Director, or Vice Chancellor

    # Get the campus based on campus_acronym
    campus = Campus.query.filter_by(campus_acronym=campus_acronym).first()
    
    if not campus:
        flash("Campus not found.", "danger")
        return redirect(url_for('dashboard'))
    
    # Get the college name and acronym from the form
    college_name = request.form.get('college_name')
    college_acronym = request.form.get('college_acronym').upper()  # Make sure the acronym is in uppercase

    # Check if the college already exists
    existing_college = College.query.filter_by(college_name=college_name).first()
    if existing_college:
        flash(f'College "{college_name}" already exists.', 'danger')
        return redirect(url_for('campus_page', campus_acronym=campus_acronym))

    # Add the new college to the database
    new_college = College(college_name=college_name, college_acronym=college_acronym)
    db.session.add(new_college)
    db.session.commit()

    # Create the connection in the Campus_Colleges association table
    campus.colleges.append(new_college)  # Add the new college to the campus's college list
    db.session.commit()

    flash(f'New college "{college_name}" has been added.', 'success')
    return redirect(url_for('campus_page', campus_acronym=campus_acronym))

@app.route('/remove_college/<campus_acronym>', methods=['POST'])
def remove_college(campus_acronym):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])

    if user.userType not in ['Dean', 'Campus Director', 'Vice Chancellor']:
        flash("Unauthorized action.", "danger")
        return redirect(url_for('dashboard'))

    campus = Campus.query.filter_by(campus_acronym=campus_acronym).first()
    if not campus:
        flash("Campus not found.", "danger")
        return redirect(url_for('dashboard'))

    college_name = request.form.get('college_to_remove')
    college = College.query.filter_by(college_name=college_name, isDeleted=False).first()

    if college and college in campus.colleges:
        campus.colleges.remove(college)
        db.session.commit()

        # If this college is not connected to any other campus, mark it as deleted
        if not college.campuses:  # Assuming backref from College to campuses
            college.isDeleted = True
            db.session.commit()

        flash(f'College "{college_name}" has been removed from {campus.campus_name}.', 'success')
    else:
        flash(f'College "{college_name}" not found or already removed.', 'danger')

    return redirect(url_for('campus_page', campus_acronym=campus_acronym))

@app.route('/renameCollege/<campus_acronym>', methods=['POST'])
def rename_college(campus_acronym):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    if user.userType not in ['Dean', 'Campus Director', 'Vice Chancellor']:
        flash("Unauthorized action.", "danger")
        return redirect(url_for('dashboard'))

    campus = Campus.query.filter_by(campus_acronym=campus_acronym).first()
    if not campus:
        flash("Campus not found.", "danger")
        return redirect(url_for('dashboard'))

    old_name = request.form.get('old_college_name')
    new_name = request.form.get('new_college_name')
    new_acronym = request.form.get('new_college_acronym').upper()

    college = College.query.filter_by(college_name=old_name, isDeleted=False).first()

    if not college or college not in campus.colleges:
        flash(f'College "{old_name}" not found in {campus.campus_name}.', 'danger')
        return redirect(url_for('campus_page', campus_acronym=campus_acronym))

    # Check for conflicts
    name_conflict = College.query.filter_by(college_name=new_name).first()
    acronym_conflict = College.query.filter_by(college_acronym=new_acronym).first()

    if name_conflict or acronym_conflict:
        flash("The new college name or acronym already exists.", "danger")
        return redirect(url_for('campus_page', campus_acronym=campus_acronym))

    # Update the college name and acronym
    college.college_name = new_name
    college.college_acronym = new_acronym
    db.session.commit()

    flash(f'College "{old_name}" has been renamed to "{new_name}".', 'success')
    return redirect(url_for('campus_page', campus_acronym=campus_acronym))

"""
Function for upload
"""
@app.route('/upload', methods=['GET', 'POST'])
def upload_file():

    try:
        if request.method == 'POST':
            if 'csv_file' not in request.files:
                return jsonify({"error": "No file part"}), 400
        
            teacherUName = request.form.get("teacherUName")
            file = request.files['csv_file']

            # Get values for Starting Year, Ending Year, and Semester from the form
            starting_year = request.form.get("startYear")
            ending_year = request.form.get("endYear")
            semester = request.form.get("semester")

            print("Received startYear:", starting_year)
            print("Received endYear:", ending_year)
            print("Received semester:", semester)

            if not all([starting_year, ending_year, semester]):
                print("Received startYear:", starting_year)
                print("Received endYear:", ending_year)
                print("Received semester:", semester)
                return jsonify({"error": "Missing required fields for the filename"}), 400

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

            # --- Sentiment Analysis ---
            sentiment_result = sentiment_analyzer.predict(comments_list)

            # Count positive and negative sentiments
            neg_count = sentiment_result["predictions"].count("Negative")
            pos_count = sentiment_result["predictions"].count("Positive")

            #  Process comments using CommentProcessor
            processed_comments, top_words, category_counts = topic_modeling.process_comments(df)

            # Generate recommendation
            recommendation_text = (
                "There are more negative comments. Consider scheduling professional development seminars."
                if neg_count > pos_count else
                "Feedback is generally positive, but keep monitoring for potential issues."
            )

            # set new filename
            new_filename = f"{starting_year}_{ending_year}_{semester}.csv"

            # Return response
            session["upload_results"] = {
                "filename": new_filename,
                "sentiment": sentiment_result["predictions"],
                "comments": comments_list,
                "processed_comments": processed_comments,
                "top_words": top_words,
                "category_counts": category_counts,
                "topics": [item["Final_Topic"] for item in processed_comments],
                "recommendation": recommendation_text,
                "teacherUName": teacherUName
            }
            results = {
                "filename": new_filename,
                "sentiment": sentiment_result["predictions"],
                "comments": comments_list,
                "processed_comments": processed_comments,
                "top_words": top_words,
                "category_counts": category_counts,
                "topics": [item["Final_Topic"] for item in processed_comments],
                "recommendation": recommendation_text,
                "teacherUName": teacherUName
            }
            return jsonify(results), 200

        elif request.method == 'GET':
            results = session.get('upload_results', {});
            return jsonify(results), 200

        return render_template('upload.html')

    except Exception as e:
        print("Error processing file:", e)
        traceback.print_exc()
        return jsonify({"error": f"Error processing file: {str(e)}"}), 500

@app.route('/saveToDatabase', methods=['POST'])
def saveToDatabase():
    try:
        # Retrieve stored session data
        stored_results = session.get("upload_results", {})

        if not stored_results:
            return jsonify({"error": "No data received!"}), 400
        
        filename = stored_results.get("filename")
        comments_list = stored_results.get("comments")
        sentiment_result = stored_results.get("sentiment")
        topic_result = stored_results.get("topics")
        recommendation_text = stored_results.get("recommendation")
        teacherUName = stored_results.get("teacherUName")

        if not comments_list or not sentiment_result or not recommendation_text or not teacherUName:
            return jsonify({"error": "Missing required fields"}), 400

        # Check row count limit
        max_allowed_rows = 1500
        if len(comments_list) > max_allowed_rows:
            return jsonify({"error": "Data rows exceed 1500 limit"}), 400

        # Helper function to split into chunks of 500
        def split_chunks(lst, size):
            return [lst[i:i + size] for i in range(0, len(lst), size)]

        comments_chunks = split_chunks(comments_list, 500)
        sentiment_chunks = split_chunks(sentiment_result, 500)
        topics_chunks = split_chunks(topic_result, 500)

        # Prepare field data
        upload_data = {
            "filename": filename,
            "recommendation": recommendation_text,
            "teacher_uname": teacherUName
        }

        # Map chunks to dynamic column names (up to 3)
        for i in range(len(comments_chunks)):
            idx = i + 1
            upload_data[f"comments{idx}"] = json.dumps(comments_chunks[i])
            upload_data[f"sentiment{idx}"] = json.dumps(sentiment_chunks[i])
            upload_data[f"topics{idx}"] = json.dumps(topics_chunks[i])

        # Create CSVUpload instance dynamically with only the fields present
        upload_record = CSVUpload(**upload_data)

        db.session.add(upload_record)
        db.session.commit()

        return jsonify({"success": True, "message": "Data saved successfully!"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

        # Save to database
    #    upload_record = CSVUpload(
    #        filename=filename,  
    #        comments=json.dumps(comments_list),  
    #        sentiment=json.dumps(sentiment_result), 
    #        topics=json.dumps(topic_result),
    #        recommendation=recommendation_text,  
    #        teacher_uname=teacherUName  
    #    )

    #    db.session.add(upload_record)
    #    db.session.commit()

    #    return jsonify({"success": True, "message": "Data saved successfully!"}), 200

    #except Exception as e:
    #    db.session.rollback()
    #    return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route('/analysis', methods=['GET'])
def analysis():

    teacherUName = request.args.get("teacher")
    file_name = request.args.get("file_name", "overall")  # Default to "overall"

    if not teacherUName:
        return jsonify({"error": "Missing teacher username"}), 400

    # Retrieve the uploads for the teacher
    uploads = CSVUpload.query.filter_by(teacher_uname=teacherUName).all()

    if not uploads:
        return jsonify({"error": "No uploads found for this teacher."}), 404

    # Initialize
    file_data = []
    total_positive = 0
    total_negative = 0

    for upload in uploads:
        import re

        def extract_json_chunks(prefix, upload):
            chunks = []
            for attr in dir(upload):
                if re.match(f"{prefix}\\d+", attr):
                    chunk = getattr(upload, attr)
                    if chunk:
                        parsed = json.loads(chunk) if isinstance(chunk, str) else chunk
                        chunks.extend(parsed)
            return chunks

        sentiments = extract_json_chunks('sentiment', upload)
        topics = extract_json_chunks('topics', upload)

        file_data.append({
            "filename": upload.filename,
            "sentiment": sentiments,
            "topics": topics
        })

        total_positive += sentiments.count("Positive")
        total_negative += sentiments.count("Negative")

    # Find specific file if needed
    if file_name != "overall":
        target = next((f for f in file_data if f["filename"] == file_name), None)
        if not target:
            return jsonify({"error": "File not found"}), 404
        positive_count = target["sentiment"].count("Positive")
        negative_count = target["sentiment"].count("Negative")
        recommendation_text = next((u.recommendation for u in uploads if u.filename == file_name), "")
    else:
        positive_count = total_positive
        negative_count = total_negative
        recommendation_text = (
            "There are more negative comments. Consider scheduling professional development seminars."
            if total_negative > total_positive else
            "Feedback is generally positive, but keep monitoring for potential issues."
        )

    return jsonify({
        "files": file_data,
        "positive": positive_count,
        "negative": negative_count,
        "recommendation": recommendation_text
    }), 200

@app.route('/college_analysis', methods=['GET'])
def college_analysis():
    college_acronym = request.args.get("college_acronym")

    if not college_acronym:
        return jsonify({"error": "Missing college acronym"}), 400

    # Fetch the college using its acronym
    college = College.query.filter_by(college_acronym=college_acronym).first()

    if not college:
        return jsonify({"error": "College not found."}), 404

    # Retrieve all teachers from this college
    teachers = User.query.filter(
        User.college_name == college.college_name,  # Match by college name
        User.userType == "Teacher"
    ).all()

    if not teachers:
        return jsonify({"error": "No teachers found for this college."}), 404

    # Retrieve all uploads related to these teachers
    uploads = CSVUpload.query.filter(CSVUpload.teacher_uname.in_([t.uName for t in teachers])).all()

    if not uploads:
        return jsonify({"error": "No uploaded sentiment data found for this college."}), 404

    # Dynamic extraction function
    import re

    def extract_json_chunks(prefix, upload):
        chunks = []
        for attr in dir(upload):
            if re.match(f"{prefix}\\d+", attr):
                chunk = getattr(upload, attr)
                if chunk:
                    parsed = json.loads(chunk) if isinstance(chunk, str) else chunk
                    chunks.extend(parsed)
        return chunks

    # Prepare the aggregated data
    positive_count = []
    negative_count = []
    file_data = {}

    # Iterate through the uploads and combine data
    for upload in sorted(uploads, key=lambda x: x.upload_date):
        sentiments = extract_json_chunks('sentiment', upload)
        topics = extract_json_chunks('topics', upload)

        if upload.filename not in file_data:
            file_data[upload.filename] = {
                "filename": upload.filename,
                "positive": 0,
                "negative": 0,
                "sentiment": [],
                "topics": []
            }

        file_data[upload.filename]["sentiment"].extend(sentiments)
        file_data[upload.filename]["topics"].extend(topics)
        file_data[upload.filename]["positive"] += sentiments.count("Positive")
        file_data[upload.filename]["negative"] += sentiments.count("Negative")

    # Sort files by semester/year (assumes filename format: start_end_semester)
    def sort_key(filename):
        try:
            start, end, sem = map(int, filename.split('_'))
            return (start, end, sem)
        except:
            return (9999, 9999, 9)  # fallback if filename format is unexpected

    sorted_file_data = [file_data[f] for f in sorted(file_data.keys(), key=sort_key)]

    total_positive = sum(f["positive"] for f in sorted_file_data)
    total_negative = sum(f["negative"] for f in sorted_file_data)

    # Generate recommendation
    recommendation_text = (
        "There are more negative comments. Consider addressing faculty concerns."
        if total_negative > total_positive else
        "Feedback is generally positive, but continuous improvement is recommended."
    )

    return jsonify({
        "files": sorted_file_data,
        "positive": total_positive,
        "negative": total_negative,
        "recommendation": recommendation_text
    }), 200
