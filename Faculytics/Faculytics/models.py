# models.py
from enum import unique
from . import db
from sqlalchemy.dialects.postgresql import JSON
from datetime import datetime
import pytz

# Association table for the many-to-many relationship between Campus and College.
campus_colleges = db.Table(
    'Campus_Colleges',
    db.Column('campus_acronym', db.String(10), db.ForeignKey('Campuses.campus_acronym', ondelete="CASCADE"), primary_key=True),
    db.Column('college_name', db.String(50), db.ForeignKey('Colleges.college_name', ondelete="CASCADE"), primary_key=True),
    db.UniqueConstraint('campus_acronym', 'college_name', name='campus_college_unique')
)

class User(db.Model):
    __tablename__ = 'Users'

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    uName = db.Column(db.String(50), unique=True, nullable=False)
    pWord = db.Column(db.String(200), nullable=False)  # Hashed password
    userType = db.Column(db.String(50), nullable=False)
    firstName = db.Column(db.String(50), nullable=False)
    lastName = db.Column(db.String(50), nullable=False)
    campus_acronym = db.Column(
        db.String(10),
        db.ForeignKey('Campuses.campus_acronym', onupdate="CASCADE", ondelete="NO ACTION"),
        nullable=True
    )
    college_name = db.Column(
        db.String(50),
        db.ForeignKey('Colleges.college_name', onupdate="CASCADE", ondelete="NO ACTION"),
        nullable=True
    )
    profilePicture = db.Column(db.String(255), nullable=True, default='../static/assets/default-avatar.png')
    emailAddress = db.Column(db.String(100), nullable=True)
    phoneNumber = db.Column(db.String(20), nullable=True)

    # Relationships
    campus = db.relationship('Campus', back_populates='users')
    college = db.relationship('College', back_populates='users')
    uploads = db.relationship('CSVUpload', back_populates='user', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<User {self.uName}>'

class Campus(db.Model):
    __tablename__ = 'Campuses'

    campus_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    campus_name = db.Column(db.String(50), unique=True, nullable=False)
    campus_acronym = db.Column(db.String(10), unique=True, nullable=False)

    # Relationships
    users = db.relationship('User', back_populates='campus')
    colleges = db.relationship('College', secondary=campus_colleges, back_populates='campuses')

    def __repr__(self):
        return f'<Campus {self.campus_name}>'

class College(db.Model):
    __tablename__ = 'Colleges'

    college_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    college_name = db.Column(db.String(50), unique=True, nullable=False)
    college_acronym = db.Column(db.String(10), unique=True, nullable=False)

    # Relationships
    users = db.relationship('User', back_populates='college')
    campuses = db.relationship('Campus', secondary=campus_colleges, back_populates='colleges')

    def __repr__(self):
        return f'<College {self.college_name}>'

class UserApproval(db.Model):
    __tablename__ = 'UserApproval'

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    uName = db.Column(db.String(50), unique=True, nullable=False)
    pWord = db.Column(db.String(200), nullable=False)  # Hashed password
    userType = db.Column(db.String(50), nullable=False)
    firstName = db.Column(db.String(50), nullable=False)
    lastName = db.Column(db.String(50), nullable=False)
    campus_acronym = db.Column(
        db.String(10),
        db.ForeignKey('Campuses.campus_acronym', onupdate="CASCADE", ondelete="SET NULL"),
        nullable=True
    )
    college_name = db.Column(
        db.String(50),
        db.ForeignKey('Colleges.college_name', onupdate="CASCADE", ondelete="SET NULL"),
        nullable=True
    )
    date_registered = db.Column(db.DateTime, default=lambda: datetime.now(PH_TZ))

    # Relationships
    campus = db.relationship('Campus', back_populates='pending_users')
    college = db.relationship('College', back_populates='pending_users')

    def __repr__(self):
        return f'<UserApproval {self.uName}>'

# Add relationship properties to Campus and College models
Campus.pending_users = db.relationship('UserApproval', back_populates='campus', cascade="all, delete-orphan")
College.pending_users = db.relationship('UserApproval', back_populates='college', cascade="all, delete-orphan")

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
    teacher_uname = db.Column(db.String(50), db.ForeignKey('Users.uName', ondelete='SET NULL'), nullable=False)

    # Relationships
    user = db.relationship('User', back_populates='uploads')

    def __repr__(self):
        return f'<CSVUpload {self.filename}>'
