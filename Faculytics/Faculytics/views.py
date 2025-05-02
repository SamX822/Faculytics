#views.py
from datetime import datetime
from flask import Flask, render_template, redirect, url_for, request, jsonify, session, flash, abort
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from Faculytics import app, db
from Faculytics.models import User, CSVUpload, College, Campus, UserApproval, Program
import pandas as pd
import json
import os
import traceback
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Query
from sqlalchemy import and_
import re
from dotenv import load_dotenv
from google import genai
from google.genai import types
from collections import defaultdict

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

# Load environment variables from .env
# Activation for gemini
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
gemini_client = genai.Client(api_key=api_key)

@app.route('/')
def index():
    # Redirect to the login page by default
    return redirect(url_for('login'))

@app.route('/logout')
def logout():
    # Clear the session
    session.clear()
    flash('You have been successfully logged out.', 'success')
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    
    # Check for registration success parameters
    success_message = request.args.get('success_message', False)
    firstName = request.args.get('firstName', '')
    lastName = request.args.get('lastName', '')
    
    if request.method == 'POST':
        uName = request.form.get('uName')
        pWord = request.form.get('pWord')
        user = User.query.filter_by(uName=uName, isDeleted=False).first()
        if user and check_password_hash(user.pWord, pWord):
            session['user_id'] = user.id  # Store user ID in session
            return redirect(url_for('dashboard'))
        else:
            error = "Invalid username or password."
            
    return render_template('login.html', 
                          error=error, 
                          title="Login", 
                          year=datetime.now().year,
                          success_message=success_message,
                          firstName=firstName,
                          lastName=lastName)

@app.context_processor
def inject_user():
    user = None
    if 'user_id' in session:
        user = User.query.filter_by(id=session['user_id'], isDeleted=False).first()
    return dict(user=user)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return redirect(url_for('login'))
        user = User.query.filter_by(id=user_id, isDeleted=False).first()
        if not user:
            session.pop('user_id', None)
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/get_colleges/<campus_acronym>')
def get_colleges(campus_acronym):
    campus = Campus.query.filter_by(campus_acronym=campus_acronym).first_or_404()
    # return list of college names
    return jsonify([c.college_name for c in campus.colleges])

@app.route('/get_programs/<campus_acronym>/<college_name>')
def get_programs(campus_acronym, college_name):
    # join Program via both Campus and College
    programs = Program.query \
        .join(Program.campuses) \
        .join(Program.colleges) \
        .filter(
            Campus.campus_acronym == campus_acronym,
            College.college_name == college_name,
            Program.isDeleted == False
        ).all()
    # return list of {acronym, name}
    return jsonify([
        { 'acronym': p.program_acronym, 'name': p.program_name }
        for p in programs
    ])

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

        #flash("Registration submitted for approval.", "info")
        return redirect(url_for('login', 
                               success_message=True, 
                               firstName=firstName, 
                               lastName=lastName))

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
@login_required
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])

    if user.userType in ['Curriculum Developer', 'Vice Chancellor of Academic Affairs']:
        campuses = Campus.query.all()

    # Fetch assigned campus for non-admin users
    assigned_campus = None
    if user.userType != "admin" and user.campus_acronym:
        assigned_campus = Campus.query.filter_by(campus_acronym=user.campus_acronym, isDeleted=False).first()
    
    # Admins and Curriculum Developers see all campuses, excluding the "N/A" campus
    if user.userType in ["admin", "Curriculum Developer", "Vice Chancellor for Academic Affairs"]:
        campuses = Campus.query.filter(Campus.campus_acronym != "N/A").all()
    else:
        campuses = [assigned_campus] if assigned_campus else []
    
    # Get pending approval counts for Deans, Campus Directors, and Vice Chancellors
    pending_approvals = 0
    if user.userType in ["Dean", "Campus Director", "Vice Chancellor", "Vice Chancellor for Academic Affairs"]:
        # Build query based on user type and assignment
        query = UserApproval.query
        
        if user.userType == "Dean" and user.college_name:
            # Deans only see approvals for their college
            query = query.filter_by(college_name=user.college_name)
        elif user.userType in ("Campus Director", "Vice Chancellor") and user.campus_acronym:
            # Campus Directors and Vice Chancellors only see approvals for their campus
            query = query.filter_by(campus_acronym=user.campus_acronym)
        # Vice Chancellor for Academic Affairs can see all approvals
        
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
@login_required
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
@login_required
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
        college_name=pending_user.college_name,
        program_acronym=pending_user.program_acronym
    )
    db.session.add(approved_user)
    db.session.delete(pending_user)
    db.session.commit()

    flash(f"{pending_user.firstName} {pending_user.lastName} has been approved.", "success")
    return redirect(url_for('approval_page'))

@app.route('/reject_user/<int:user_id>', methods=['POST'])
@login_required
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
@login_required
def uploadHistory():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])

    teacher_username = request.args.get('teacher')
    college_acronym = request.args.get('college')
    program_acronym = request.args.get('program')
    campus_acronym = request.args.get('campus')

    teacher_full_name = None

    if teacher_username:
        teacher = User.query.filter_by(uName=teacher_username, isDeleted=False).first()
        if teacher:
            teacher_full_name = f"{teacher.firstName} {teacher.lastName}"

    return render_template('uploadHistory.html',
                           user=user,
                           teacher_name=teacher_full_name,
                           title="Upload",
                           year=datetime.now().year,
                           college_acronym=college_acronym,
                           program_acronym=program_acronym,
                           campus_acronym=campus_acronym)

IMG_ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in IMG_ALLOWED_EXTENSIONS

@app.route('/my_account', methods=['GET', 'POST'])
@login_required
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
@login_required
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
@login_required
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

    if user.userType in ['admin', 'Curriculum Developer', 'Vice Chancellor for Academic Affairs', 'Campus Director', 'Vice Chancellor']:
        # can see all colleges
        visible_colleges = campus_colleges
    elif user.userType in ['Dean', 'Chairperson']:
        # can only see their assigned college
        visible_colleges = [college for college in campus_colleges if college.college_name == user.college_name]
    else:
        return redirect(url_for('dashboard'))

    return render_template(
        'campus.html', campus=campus, visible_colleges=visible_colleges, user=user, title=campus.campus_name)

@app.route('/college/<string:college_acronym>/<string:campus_acronym>')
@login_required
def college_page(college_acronym, campus_acronym):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    college = College.query.filter_by(college_acronym=college_acronym.upper(), isDeleted=False).first_or_404()
    campus = Campus.query.filter_by(campus_acronym=campus_acronym.upper(), isDeleted=False).first_or_404()
    user = User.query.get(session['user_id'])

    # Get Programs associated with this campus and college
    programs = Program.query \
        .join(Program.colleges) \
        .join(Program.campuses) \
        .filter(
            College.college_acronym == college_acronym.upper(),
            Campus.campus_acronym == campus_acronym.upper(),
            Program.isDeleted == False
        ).all()

    return render_template(
        'college.html', campus=campus, college=college, programs=programs, title=college.college_name, user=user)

@app.route('/program/<string:program_acronym>/<string:college_acronym>/<string:campus_acronym>')
@login_required
def program_page(program_acronym, college_acronym, campus_acronym):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])

    college = College.query.filter_by(college_acronym=college_acronym.upper(), isDeleted=False).first_or_404()
    campus = Campus.query.filter_by(campus_acronym=campus_acronym.upper(), isDeleted=False).first_or_404()
    program = Program.query \
        .join(Program.colleges) \
        .join(Program.campuses) \
        .filter(
            Program.program_acronym == program_acronym.upper(),
            College.college_acronym == college_acronym.upper(),
            Campus.campus_acronym == campus_acronym.upper(),
            Program.isDeleted == False
        ).first_or_404()

    if user.userType == 'admin':
        users = User.query.filter_by(
            campus_acronym=campus.campus_acronym,
            college_name=college.college_name,
            program_acronym=program.program_acronym
        ).all()
    elif user.userType in ['Dean', 'Campus Director', 'Vice Chancellor', 'Vice Chancellor for Academic Affairs']:
        users = User.query.filter_by(
            campus_acronym=campus.campus_acronym,
            college_name=college.college_name,
            program_acronym=program.program_acronym,
            userType='Teacher'
        ).all()
    elif user.userType == 'Chairperson':
        users = User.query.filter_by(
            campus_acronym=campus.campus_acronym,
            college_name=college.college_name,
            program_acronym=program.program_acronym,
            userType='Teacher'
        ).all()

    else:
        return redirect(url_for('dashboard'))

    return render_template('program.html', campus=campus, college=college, program=program, users=users, user=user, title=program.program_name)

@app.route('/delete_teacher/<int:teacher_id>', methods=['POST'])
@login_required
def delete_teacher(teacher_id):
    # Ensure the user is logged in and is an admin.
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    current_user = User.query.get(session['user_id'])
    if current_user.userType != 'admin':
        flash("Unauthorized action.", "danger")
        return redirect(request.referrer or url_for('dashboard'))
    
    # Find the account and mark it as deleted if found
    teacher = User.query.get(teacher_id, isDeleted=False)
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
    teacher = User.query.filter_by(user_id=teacher_id, userType="Teacher", isDeleted=False).first()
    
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

@app.route('/restore_teacher/<int:teacher_id>', methods=['POST'])
def restore_teacher(teacher_id):
    teacher = User.query.filter_by(id=teacher_id, isDeleted=True).first()
    if teacher:
        teacher.isDeleted = False
        db.session.commit()
        return jsonify({"success": True, "message": f"Teacher with ID {teacher_id} restored."}), 200
    else:
        return jsonify({"success": False, "error": "Soft-deleted teacher not found."}), 404

@app.route('/add_college/<campus_acronym>', methods=['POST'])
@login_required
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
@login_required
def remove_college(campus_acronym):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])

    if user.userType not in ['Dean', 'Campus Director', 'Vice Chancellor']:
        flash("Unauthorized action.", "danger")
        return redirect(url_for('dashboard'))

    campus = Campus.query.filter_by(campus_acronym=campus_acronym, isDeleted=False).first()
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
@login_required
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

@app.route('/add_program/<string:campus_acronym>/<string:college_acronym>', methods=['POST'])
@login_required
def add_program(campus_acronym, college_acronym):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    if user.userType not in ['Dean', 'Campus Director', 'Vice Chancellor']:
        return redirect(url_for('dashboard'))

    program_name = request.form.get('program_name')
    program_acronym = request.form.get('program_acronym')

    new_program = Program(
        program_name=program_name,
        program_acronym=program_acronym.upper(),
        isDeleted=False
    )

    db.session.add(new_program)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return "Program already exists or database error", 400

    college = College.query.filter_by(college_acronym=college_acronym.upper(), isDeleted=False).first()
    campus = Campus.query.filter_by(campus_acronym=campus_acronym.upper(), isDeleted=False).first()
    if college and campus:
        new_program.colleges.append(college)
        new_program.campuses.append(campus)
        db.session.commit()

    return redirect(url_for('college_page', college_acronym=college_acronym, campus_acronym=campus_acronym))

@app.route('/remove_program/<string:campus_acronym>/<string:college_acronym>', methods=['POST'])
@login_required
def remove_program(campus_acronym, college_acronym):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    if user.userType not in ['Dean', 'Campus Director', 'Vice Chancellor']:
        return redirect(url_for('dashboard'))

    program_acronym = request.form.get('program_to_remove')

    program = Program.query \
        .join(Program.colleges) \
        .join(Program.campuses) \
        .filter(
            Program.program_acronym == program_acronym.upper(),
            College.college_acronym == college_acronym.upper(),
            Campus.campus_acronym == campus_acronym.upper(),
            Program.isDeleted == False
        ).first()

    if program:
        program.isDeleted = True
        db.session.commit()

    return redirect(url_for('college_page', college_acronym=college_acronym, campus_acronym=campus_acronym))

@app.route('/rename_program/<string:campus_acronym>/<string:college_acronym>', methods=['POST'])
@login_required
def rename_program(campus_acronym, college_acronym):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    if user.userType not in ['Dean', 'Campus Director', 'Vice Chancellor']:
        return redirect(url_for('dashboard'))

    old_acronym = request.form.get('old_program_acronym')
    new_name = request.form.get('new_program_name')
    new_acronym = request.form.get('new_program_acronym')

    program = Program.query \
        .join(Program.colleges) \
        .join(Program.campuses) \
        .filter(
            Program.program_acronym == old_acronym.upper(),
            College.college_acronym == college_acronym.upper(),
            Campus.campus_acronym == campus_acronym.upper(),
            Program.isDeleted == False
        ).first()

    if program:
        program.program_name = new_name
        program.program_acronym = new_acronym.upper()
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return "Rename failed due to duplicate acronym or DB error", 400

    return redirect(url_for('college_page', college_acronym=college_acronym, campus_acronym=campus_acronym))

def build_topic_comments_summary(processed_comments, sentiment_result, comments_list):
    topic_examples = defaultdict(lambda: {"Positive": [], "Negative": []})
    for idx, comment in enumerate(processed_comments):
        topic = comment.get("Final_Topic")
        sentiment = sentiment_result["predictions"][idx]
        raw_comment = comments_list[idx]
        if topic:
            topic_examples[topic][sentiment].append(raw_comment)

    # Build formatted summary block
    summary_lines = []
    for topic in topic_examples:
        summary_lines.append(f"\nTopic: {topic}")
        for sentiment_type in ["Positive", "Negative"]:
            examples = topic_examples[topic][sentiment_type]
            if examples:
                summary_lines.append(f"{sentiment_type} Comments:")
                for i, example in enumerate(examples[:5], 1):
                    summary_lines.append(f"{i}. {example}")
    return "\n".join(summary_lines)

def generateRecommendation2(sentiment_result, comments_list, processed_comments, top_words, category_counts):
    try:
        # Sentiment counts
        positive_count = sentiment_result["predictions"].count("Positive")
        negative_count = sentiment_result["predictions"].count("Negative")

        # Predefined topics
        predefined_topics = [
            "Teaching Effectiveness", "Preparedness and Punctuality", "Fairness and Supportiveness", "Student Engagement",
            "Professional Appearance", "Cleanliness and Classroom Management", "Teaching Quality",
            "Availability and Communication", "Tardiness", "Assessment Fairness and Difficulty",
            "Instructional Materials and Aids"
        ]

        # Track sentiment counts per topic
        topic_sentiment_summary = {topic: {"Positive": 0, "Negative": 0} for topic in predefined_topics}
        for idx, comment in enumerate(processed_comments):
            topic = comment.get("Final_Topic")
            sentiment = sentiment_result["predictions"][idx]
            if topic in topic_sentiment_summary:
                topic_sentiment_summary[topic][sentiment] += 1

        # Top 5 topics by frequency
        topic_frequency = {}
        for comment in processed_comments:
            topic = comment.get("Final_Topic")
            if topic:
                topic_frequency[topic] = topic_frequency.get(topic, 0) + 1
        top_topics = sorted(topic_frequency.items(), key=lambda x: x[1], reverse=True)[:5]
        top_topics_list = [topic for topic, _ in top_topics]

        # Summary sections
        positive_summary = []
        negative_summary = []
        for topic in top_topics_list:
            pos = topic_sentiment_summary[topic]["Positive"]
            neg = topic_sentiment_summary[topic]["Negative"]
            if pos > 0:
                positive_summary.append(f"- {topic}: {pos} positive mentions")
            if neg > 0:
                negative_summary.append(f"- {topic}: {neg} negative mentions")

        # Topic-specific comment samples
        topic_comments_summary = build_topic_comments_summary(processed_comments, sentiment_result, comments_list)

        # Final prompt
        prompt = f"""Using the data provided below, generate a formal and concise teacher performance report.

FEEDBACK SUMMARY:
Positive comments: {positive_count} | Negative comments: {negative_count}
Top topics: {', '.join(top_topics_list)}

POSITIVE HIGHLIGHTS:
{chr(10).join(positive_summary)}

AREAS FOR IMPROVEMENT:
{chr(10).join(negative_summary)}

TOPIC-SPECIFIC COMMENT EXAMPLES:
{topic_comments_summary}

Structure your response as follows:

1. STRENGTHS  
   - Recommend action for each positive highlight in one sentence each, supported by student examples where relevant.

2. AREAS REQUIRING ATTENTION  
   - Recommend action for each negative highlight in one sentence each, informed by the negative examples provided.

Guidelines:
- Use a professional and objective tone.
- Avoid assumptions or commentary outside the data.
- Keep language concise and action-oriented.
- Number all recommended actions clearly.
"""

        print(prompt)

        # Generate recommendation using Gemini
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction="You are an LLM-driven recommendation system. You are tasked to give accurate and specific recommendations especially on improving weaknesses.",
                temperature=0.4
            ),
        )

        recommendation_text = response.text.strip()
        print(recommendation_text)
        return recommendation_text

    except Exception as e:
        print(f"[generateRecommendation] Error: {str(e)}")
        return "Failed to generate recommendation."

def generateRecommendation(sentiment_result, comments_list, processed_comments, top_words, category_counts):
    try:
        # Extract sentiment counts
        positive_count = sentiment_result["predictions"].count("Positive")
        negative_count = sentiment_result["predictions"].count("Negative")
        # Topics list
        predefined_topics = [
            "Preparedness", "Cleanliness", "Tardiness", "Teaching Effectiveness",
            "Fairness and Leniency", "Student Engagement", "Availability and Approachability",
            "Wears Faculty Uniform", "On-time Starts and Ending of Class", "Professor's Activity Participation",
            "Supervision of out-of-classroom activities"
        ]
        # Map topics to positive/negative counts
        topic_sentiment_summary = {topic: {"Positive": 0, "Negative": 0} for topic in predefined_topics}
        for idx, comment in enumerate(processed_comments):
            topic = comment.get("Final_Topic")
            sentiment = sentiment_result["predictions"][idx]
            if topic in topic_sentiment_summary:
                topic_sentiment_summary[topic][sentiment] += 1
        # Extract top 5 topics by frequency
        topic_frequency = {}
        for comment in processed_comments:
            topic = comment.get("Final_Topic")
            if topic:
                topic_frequency[topic] = topic_frequency.get(topic, 0) + 1
        top_topics = sorted(topic_frequency.items(), key=lambda x: x[1], reverse=True)[:5]
        top_topics_list = [topic for topic, _ in top_topics]  # Fixed this line
        # Build Positive and Negative Summaries
        positive_summary = []
        negative_summary = []
        for topic in top_topics_list:
            pos = topic_sentiment_summary[topic]["Positive"]
            neg = topic_sentiment_summary[topic]["Negative"]
            if pos > 0:
                positive_summary.append(f"- {topic}: {pos} positive mentions")
            if neg > 0:
                negative_summary.append(f"- {topic}: {neg} negative mentions")

        feedback_summary = (
            f"FEEDBACK SUMMARY:\n"
            f"Positive comments: {positive_count} | Negative comments: {negative_count}\n"
            f"Top topics: {', '.join(top_topics_list)}\n"
            f"Positive highlights:\n{chr(10).join(positive_summary)}\n"
            f"Areas for improvement:\n{chr(10).join(negative_summary)}\n"
            f"Top words: {top_words}\n"
            f"Category Counts: {category_counts}\n"
        )


        prompt = f"""Using the data provided below, generate a formal and concise teacher performance report.

        {feedback_summary}

        Structure your response as follows:

        1. STRENGTHS  
           - Recommend action for each positive highlights in one sentence each.

        2. AREAS REQUIRING ATTENTION  
           - Recommend action for each negative highlight in one sentence each.

        Guidelines:
        - Use a professional and objective tone.
        - Avoid assumptions or commentary outside the data.
        - Keep language concise and action-oriented.
        - Number all recommended actions clearly.
        """

        print(prompt)
        # Generate the recommendation
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction="You are an LLM-driven recommendation system. You are tasked to give accurate and specific recommendation especially on improving weaknesses",
                temperature=0.4
            ),

        )
        recommendation_text = response.text.strip()
        print(recommendation_text)
        return recommendation_text
    except Exception as e:
        print(f"[generateRecommendation] Error: {str(e)}")
        return "Failed to generate recommendation."

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
            grade = request.form.get('grade')

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

            # Recommendation text using GEMINI
            recommendation_text = generateRecommendation2(sentiment_result, comments_list, processed_comments, top_words, category_counts);

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
                "teacherUName": teacherUName,
                "grade": grade
            }
            print(session.get('upload_results', {}));
            results = {
                "filename": new_filename,
                "sentiment": sentiment_result["predictions"],
                "comments": comments_list,
                "processed_comments": processed_comments,
                "top_words": top_words,
                "category_counts": category_counts,
                "topics": [item["Final_Topic"] for item in processed_comments],
                "recommendation": recommendation_text,
                "teacherUName": teacherUName,
                "grade": grade
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
        print("# Retrieve stored session data");

        if not stored_results:
            return jsonify({"error": "No data received!"}), 400
        
        filename = stored_results.get("filename")
        comments_list = stored_results.get("comments")
        sentiment_result = stored_results.get("sentiment")
        topic_result = stored_results.get("topics")
        recommendation_text = stored_results.get("recommendation")
        teacherUName = stored_results.get("teacherUName")
        grade = stored_results.get("grade")
        print("# Storing data");

        if not comments_list or not sentiment_result or not recommendation_text or not teacherUName:
            return jsonify({"error": "Missing required fields"}), 400

        # Check row count limit
        max_allowed_rows = 1500
        if len(comments_list) > max_allowed_rows:
            return jsonify({"error": "Data rows exceed 1500 limit"}), 400

        # Helper function to split into chunks of 500
        def split_chunks(lst, size):
            return [lst[i:i + size] for i in range(0, len(lst), size)]

        print("Comments Chunk");
        comments_chunks = split_chunks(comments_list, 500)
        print("Sentiment Chunk");
        sentiment_chunks = split_chunks(sentiment_result, 500)
        print("Topic Chunk");
        topics_chunks = split_chunks(topic_result, 500)

        # Prepare field data
        upload_data = {
            "filename": filename,
            "recommendation": recommendation_text,
            "teacher_uname": teacherUName,
            "grade": grade
        }

        # Map chunks to dynamic column names (up to 3)
        for i in range(len(comments_chunks)):
            idx = i + 1
            upload_data[f"comments{idx}"] = comments_chunks[i]
            upload_data[f"sentiment{idx}"] = sentiment_chunks[i]
            upload_data[f"topics{idx}"] = topics_chunks[i]
        print("# Map Chunking");
        # Create CSVUpload instance dynamically with only the fields present
        upload_record = CSVUpload(**upload_data)

        db.session.add(upload_record)
        db.session.commit()

        return jsonify({"success": True, "message": "Data saved successfully!"}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Exception occurred: {str(e)}")
        traceback.print_exc()
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
        comments = extract_json_chunks('comments', upload)

        file_data.append({
            "filename": upload.filename,
            "sentiment": sentiments,
            "topics": topics,
            "comments": comments
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
    try:
        campus_acronym = request.args.get("campus_acronym")
        college_acronym = request.args.get("college_acronym")
        program_acronym = request.args.get("program_acronym")

        if not campus_acronym or not college_acronym or not program_acronym:
            return jsonify({"error": "Missing campus, college, or program acronym"}), 400

        campus = Campus.query.filter_by(campus_acronym=campus_acronym).first()
        college = College.query.filter_by(college_acronym=college_acronym).first()
        program = Program.query.filter_by(program_acronym=program_acronym).first()

        if not campus or not college or not program:
            return jsonify({"error": "Campus, College, or Program not found."}), 404

        # Fetch teachers in this specific campus, college, and program
        teachers = User.query.filter_by(
            campus_acronym=campus_acronym,
            college_name=college.college_name,
            program_acronym=program_acronym,
            userType="Teacher",
            isDeleted=False
        ).all()

        if not teachers:
            return jsonify({"error": "No teachers found for this program."}), 404

        # Fetch their uploads
        uploads = CSVUpload.query.filter(
            CSVUpload.teacher_uname.in_([t.uName for t in teachers])
        ).all()

        if not uploads:
            return jsonify({"error": "No uploaded sentiment data found for this program."}), 404

        import re, json
        def extract_json_chunks(prefix, upload):
            chunks = []
            for attr in dir(upload):
                if re.match(f"{prefix}\\d+", attr):
                    chunk = getattr(upload, attr)
                    if chunk is None:
                        continue
                    if isinstance(chunk, list):
                        chunks.extend(chunk)
                    elif isinstance(chunk, str):
                        try:
                            parsed = json.loads(chunk)
                            if isinstance(parsed, (list, dict)):
                                chunks.extend(parsed if isinstance(parsed, list) else [parsed])
                        except json.JSONDecodeError:
                            continue
                    elif isinstance(chunk, dict):
                        chunks.append(chunk)
            print(f"Extracted {prefix} chunks: {chunks}")  # Debugging line
            return chunks

        file_data = {}

        for upload in sorted(uploads, key=lambda x: x.upload_date):
            comments_chunks = extract_json_chunks('comments', upload)
            sentiment_chunks = extract_json_chunks('sentiment', upload)
            topics_chunks = extract_json_chunks('topics', upload)

            if upload.filename not in file_data:
                file_data[upload.filename] = {
                    "filename": upload.filename,
                    "sentiment": [],
                    "topics": [],
                    "comments": []
                }

            file_data[upload.filename]["sentiment"].extend(sentiment_chunks)
            file_data[upload.filename]["topics"].extend(topics_chunks)
            file_data[upload.filename]["comments"].extend(comments_chunks)

        def sort_key(filename):
            try:
                start, end, sem = map(int, filename.split('_'))
                return (start, end, sem)
            except:
                return (9999, 9999, 9)

        sorted_file_data = [file_data[f] for f in sorted(file_data.keys(), key=sort_key)]

        all_sentiments = []
        all_topics = []
        all_comments = []

        # Processing each file entry to extract sentiments, topics, and comments
        for file_entry in sorted_file_data:
            sentiments = file_entry.get("sentiment", [])
            topics = file_entry.get("topics", [])
            comments = file_entry.get("comments", [])

            # Debugging the raw extracted data for sentiments, topics, and comments
            print(f"Processing file: {file_entry['filename']}")
            print(f"Sentiments: {sentiments}")
            print(f"Topics: {topics}")
            print(f"Comments: {comments}")

            # Handling sentiment entries
            for sentiment_entry in sentiments:
                all_sentiments.append({
                    "filename": file_entry["filename"],
                    "sentiment_score": sentiment_entry
                })

            # Handling topic entries correctly
            for idx, topic_entry in enumerate(topics):
                corresponding_sentiment = sentiments[idx] if idx < len(sentiments) else "Unknown"

                if isinstance(topic_entry, dict):
                    topic = topic_entry.get("topic")
                    sentiment = topic_entry.get("sentiment", corresponding_sentiment)
                    if topic is not None and sentiment is not None:
                        all_topics.append({
                            "topic": topic,
                            "sentiment": sentiment
                        })
                else:  # If it's a string, handle accordingly
                    all_topics.append({
                        "topic": topic_entry,
                        "sentiment": corresponding_sentiment
                    })

            # Handling comment entries
            for idx, comment_entry in enumerate(comments):
                corresponding_sentiment = sentiments[idx] if idx < len(sentiments) else "Unknown"
                corresponding_topic = None

                if idx < len(topics):
                    topic_entry = topics[idx]
                    if isinstance(topic_entry, dict):
                        corresponding_topic = topic_entry.get("topic", "Unknown")
                    else:
                        corresponding_topic = topic_entry  # if it's just a string

                if isinstance(comment_entry, dict):
                    text = comment_entry.get("text")
                    sentiment = comment_entry.get("sentiment", corresponding_sentiment)
                    topic = comment_entry.get("topic", corresponding_topic)
                    if text:
                        all_comments.append({
                            "text": text,
                            "sentiment": sentiment if sentiment else "Unknown",
                            "topic": topic if topic else "Unknown"
                        })
                else:  # If it's a string, handle accordingly
                    all_comments.append({
                        "text": comment_entry,
                        "sentiment": corresponding_sentiment,
                        "topic": corresponding_topic if corresponding_topic else "Unknown"
                    })

        files = [f["filename"] for f in sorted_file_data]

        return jsonify({
            "files": files,
            "sentiment": all_sentiments,
            "topics": all_topics,
            "comments": all_comments
        }), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": "Internal Server Error"}), 500

@app.route('/campus_analytics', methods=['GET'])
def campus_analytics():
    try:
        campus_acronym = request.args.get("campus_acronym")
        college_acronym = request.args.get("college_acronym")

        if not campus_acronym or not college_acronym:
            return jsonify({"error": "Missing campus or college acronym"}), 400

        campus = Campus.query.filter_by(campus_acronym=campus_acronym).first()
        college = College.query.filter_by(college_acronym=college_acronym).first()

        if not campus or not college:
            return jsonify({"error": "Campus or College not found."}), 404

        # Fetch teachers in this specific campus and college (no program filter)
        teachers = User.query.filter_by(
            campus_acronym=campus_acronym,
            college_name=college.college_name,
            userType="Teacher",
            isDeleted=False
        ).all()

        if not teachers:
            return jsonify({"error": "No teachers found for this college in the campus."}), 404

        # Fetch their uploads
        uploads = CSVUpload.query.filter(
            CSVUpload.teacher_uname.in_([t.uName for t in teachers])
        ).all()

        if not uploads:
            return jsonify({"error": "No uploaded sentiment data found for this college."}), 404

        import re, json
        def extract_json_chunks(prefix, upload):
            chunks = []
            for attr in dir(upload):
                if re.match(f"{prefix}\\d+", attr):
                    chunk = getattr(upload, attr)
                    if chunk is None:
                        continue
                    if isinstance(chunk, list):
                        chunks.extend(chunk)
                    elif isinstance(chunk, str):
                        try:
                            parsed = json.loads(chunk)
                            if isinstance(parsed, (list, dict)):
                                chunks.extend(parsed if isinstance(parsed, list) else [parsed])
                        except json.JSONDecodeError:
                            continue
                    elif isinstance(chunk, dict):
                        chunks.append(chunk)
            return chunks

        file_data = {}

        for upload in sorted(uploads, key=lambda x: x.upload_date):
            comments_chunks = extract_json_chunks('comments', upload)
            sentiment_chunks = extract_json_chunks('sentiment', upload)
            topics_chunks = extract_json_chunks('topics', upload)

            if upload.filename not in file_data:
                file_data[upload.filename] = {
                    "filename": upload.filename,
                    "sentiment": [],
                    "topics": [],
                    "comments": []
                }

            file_data[upload.filename]["sentiment"].extend(sentiment_chunks)
            file_data[upload.filename]["topics"].extend(topics_chunks)
            file_data[upload.filename]["comments"].extend(comments_chunks)

        def sort_key(filename):
            try:
                start, end, sem = map(int, filename.split('_'))
                return (start, end, sem)
            except:
                return (9999, 9999, 9)

        sorted_file_data = [file_data[f] for f in sorted(file_data.keys(), key=sort_key)]

        all_sentiments = []
        all_topics = []
        all_comments = []

        for file_entry in sorted_file_data:
            sentiments = file_entry.get("sentiment", [])
            topics = file_entry.get("topics", [])
            comments = file_entry.get("comments", [])

            for sentiment_entry in sentiments:
                all_sentiments.append({
                    "filename": file_entry["filename"],
                    "sentiment_score": sentiment_entry
                })

            for idx, topic_entry in enumerate(topics):
                corresponding_sentiment = sentiments[idx] if idx < len(sentiments) else "Unknown"

                if isinstance(topic_entry, dict):
                    topic = topic_entry.get("topic")
                    sentiment = topic_entry.get("sentiment", corresponding_sentiment)
                    if topic is not None and sentiment is not None:
                        all_topics.append({
                            "topic": topic,
                            "sentiment": sentiment
                        })
                else:
                    all_topics.append({
                        "topic": topic_entry,
                        "sentiment": corresponding_sentiment
                    })

            for idx, comment_entry in enumerate(comments):
                corresponding_sentiment = sentiments[idx] if idx < len(sentiments) else "Unknown"
                corresponding_topic = None

                if idx < len(topics):
                    topic_entry = topics[idx]
                    if isinstance(topic_entry, dict):
                        corresponding_topic = topic_entry.get("topic", "Unknown")
                    else:
                        corresponding_topic = topic_entry

                if isinstance(comment_entry, dict):
                    text = comment_entry.get("text")
                    sentiment = comment_entry.get("sentiment", corresponding_sentiment)
                    topic = comment_entry.get("topic", corresponding_topic)
                    if text:
                        all_comments.append({
                            "text": text,
                            "sentiment": sentiment if sentiment else "Unknown",
                            "topic": topic if topic else "Unknown"
                        })
                else:
                    all_comments.append({
                        "text": comment_entry,
                        "sentiment": corresponding_sentiment,
                        "topic": corresponding_topic if corresponding_topic else "Unknown"
                    })

        files = [f["filename"] for f in sorted_file_data]

        return jsonify({
            "files": files,
            "sentiment": all_sentiments,
            "topics": all_topics,
            "comments": all_comments
        }), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": "Internal Server Error"}), 500

@app.route('/dashboard_analytics', methods=['GET'])
def dashboard_analytics():
    try:
        campus_acronym = request.args.get("campus_acronym")

        if not campus_acronym:
            return jsonify({"error": "Missing campus acronym"}), 400

        campus = Campus.query.filter_by(campus_acronym=campus_acronym).first()

        if not campus:
            return jsonify({"error": "Campus not found."}), 404

        # Fetch all teachers in this campus (all colleges and programs under the campus)
        teachers = User.query.filter_by(
            campus_acronym=campus_acronym,
            userType="Teacher",
            isDeleted=False
        ).all()

        if not teachers:
            return jsonify({"error": "No teachers found for this campus."}), 404

        # Fetch their uploads
        uploads = CSVUpload.query.filter(
            CSVUpload.teacher_uname.in_([t.uName for t in teachers])
        ).all()

        if not uploads:
            return jsonify({"error": "No uploaded sentiment data found for this campus."}), 404

        import re, json

        def extract_json_chunks(prefix, upload):
            chunks = []
            for attr in dir(upload):
                if re.match(f"{prefix}\\d+", attr):
                    chunk = getattr(upload, attr)
                    if chunk is None:
                        continue
                    if isinstance(chunk, list):
                        chunks.extend(chunk)
                    elif isinstance(chunk, str):
                        try:
                            parsed = json.loads(chunk)
                            if isinstance(parsed, (list, dict)):
                                chunks.extend(parsed if isinstance(parsed, list) else [parsed])
                        except json.JSONDecodeError:
                            continue
                    elif isinstance(chunk, dict):
                        chunks.append(chunk)
            return chunks

        file_data = {}

        # Loop through all uploads and aggregate data by file
        for upload in sorted(uploads, key=lambda x: x.upload_date):
            comments_chunks = extract_json_chunks('comments', upload)
            sentiment_chunks = extract_json_chunks('sentiment', upload)
            topics_chunks = extract_json_chunks('topics', upload)

            if upload.filename not in file_data:
                file_data[upload.filename] = {
                    "filename": upload.filename,
                    "sentiment": [],
                    "topics": [],
                    "comments": []
                }

            file_data[upload.filename]["sentiment"].extend(sentiment_chunks)
            file_data[upload.filename]["topics"].extend(topics_chunks)
            file_data[upload.filename]["comments"].extend(comments_chunks)

        # Sort files based on naming convention or date
        def sort_key(filename):
            try:
                start, end, sem = map(int, filename.split('_'))
                return (start, end, sem)
            except:
                return (9999, 9999, 9)

        sorted_file_data = [file_data[f] for f in sorted(file_data.keys(), key=sort_key)]

        all_sentiments = []
        all_topics = []
        all_comments = []

        # Aggregate sentiments, topics, and comments for each file
        for file_entry in sorted_file_data:
            sentiments = file_entry.get("sentiment", [])
            topics = file_entry.get("topics", [])
            comments = file_entry.get("comments", [])

            for sentiment_entry in sentiments:
                all_sentiments.append({
                    "filename": file_entry["filename"],
                    "sentiment_score": sentiment_entry
                })

            for idx, topic_entry in enumerate(topics):
                corresponding_sentiment = sentiments[idx] if idx < len(sentiments) else "Unknown"

                if isinstance(topic_entry, dict):
                    topic = topic_entry.get("topic")
                    sentiment = topic_entry.get("sentiment", corresponding_sentiment)
                    if topic is not None and sentiment is not None:
                        all_topics.append({
                            "topic": topic,
                            "sentiment": sentiment
                        })
                else:
                    all_topics.append({
                        "topic": topic_entry,
                        "sentiment": corresponding_sentiment
                    })

            for idx, comment_entry in enumerate(comments):
                corresponding_sentiment = sentiments[idx] if idx < len(sentiments) else "Unknown"
                corresponding_topic = None

                if idx < len(topics):
                    topic_entry = topics[idx]
                    if isinstance(topic_entry, dict):
                        corresponding_topic = topic_entry.get("topic", "Unknown")
                    else:
                        corresponding_topic = topic_entry

                if isinstance(comment_entry, dict):
                    text = comment_entry.get("text")
                    sentiment = comment_entry.get("sentiment", corresponding_sentiment)
                    topic = comment_entry.get("topic", corresponding_topic)
                    if text:
                        all_comments.append({
                            "text": text,
                            "sentiment": sentiment if sentiment else "Unknown",
                            "topic": topic if topic else "Unknown"
                        })
                else:
                    all_comments.append({
                        "text": comment_entry,
                        "sentiment": corresponding_sentiment,
                        "topic": corresponding_topic if corresponding_topic else "Unknown"
                    })

        # List of all files in the campus (aggregated)
        files = [f["filename"] for f in sorted_file_data]

        return jsonify({
            "campus_acronym": campus_acronym,
            "files": files,
            "sentiment": all_sentiments,
            "topics": all_topics,
            "comments": all_comments
        }), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": "Internal Server Error"}), 500

