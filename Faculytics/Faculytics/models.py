# models.py
from enum import unique
from . import db
from sqlalchemy.dialects.postgresql import JSON
from datetime import datetime
import pytz

class User(db.Model):
    __tablename__ = 'Users'
    id = db.Column(db.Integer, primary_key=True)
    uName = db.Column(db.String(50), unique=True, nullable=False)
    pWord = db.Column(db.String(200), nullable=False)  # stored hashed password
    userType = db.Column(db.String(50), nullable=False)
    firstName = db.Column(db.String(50), nullable=False)
    lastName = db.Column(db.String(50), nullable=False)
    campus = db.Column(db.String(50), nullable=False)
    college = db.Column(db.String(50))  # Optional for non-Dean/Teacher
    profilePicture = db.Column(db.String(255), nullable=True, default='../static/assets/default-avatar.png')
    emailAddress = db.Column(db.String(100), nullable=True)
    phoneNumber = db.Column(db.String(20), nullable=True)    

    def assigned_courses(self):
        # Fetch all courses assigned to the user
        return [course for course in Course.query.filter_by(course_teacher=self.uName).all()]

    def __repr__(self):
        return f'<User {self.uName}>'

class Course(db.Model):
    __tablename__ = 'Courses'

    # Define the columns of the Courses table
    course_id = db.Column(db.BigInteger, primary_key=True)  # BigInteger for course_id
    course_code = db.Column(db.String(50), unique=True, nullable=False)
    course_name = db.Column(db.String(50), nullable=False)
    course_abbrev = db.Column(db.String(20), nullable=False)
    course_sched = db.Column(db.String(50), nullable=False)
    course_teacher = db.Column(db.String(50), db.ForeignKey('Users.uName'), nullable=True)  # Foreign key to Users table

    # Allow multiple courses per teacher
    teacher = db.relationship('User', backref=db.backref('courses', lazy=True))

    def __repr__(self):
        return f'<Course {self.course_code} - {self.course_abbrev} - {self.course_sched}>'

PH_TZ = pytz.timezone('Asia/Manila')
class CSVUpload(db.Model):
    __tablename__ = 'Uploads'
    
    upload_id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(150), nullable=False)
    comments = db.Column(db.JSON, nullable=False)  # Stores original comments
    sentiment = db.Column(db.JSON, nullable=False)  # Stores sentiment results
    topics = db.Column(db.JSON, nullable=False)  # Stores topic modeling results
    recommendation = db.Column(db.String, nullable=False)  # Stores recommendation
    upload_date = db.Column(db.DateTime, default=lambda: datetime.now(PH_TZ))
    upload_course = db.Column(db.String, db.ForeignKey('Courses.course_code'), nullable=False)  # Foreign Key to Courses

    # Relationship to Courses table
    course = db.relationship('Course', backref='uploads')

    def __repr__(self):
        return f'<CSVUpload {self.filename}>'
