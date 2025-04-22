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

# Association table for the many-to-many relationship between Campus and Program.
campus_programs = db.Table(
    'Campus_Programs',
    db.Column('campus_acronym', db.String(10), db.ForeignKey('Campuses.campus_acronym', ondelete="CASCADE"), primary_key=True),
    db.Column('program_acronym', db.String(10), db.ForeignKey('Programs.program_acronym', ondelete="CASCADE"), primary_key=True),
    db.Column('isDeleted', db.Boolean, default=False),
    db.UniqueConstraint('campus_acronym', 'program_acronym', name='campus_program_unique')
)

# Association table for the many-to-many relationship between College and Program.
college_programs = db.Table(
    'College_Programs',
    db.Column('college_acronym', db.String(10), db.ForeignKey('Colleges.college_acronym', ondelete="CASCADE"), primary_key=True),
    db.Column('program_acronym', db.String(10), db.ForeignKey('Programs.program_acronym', ondelete="CASCADE"), primary_key=True),
    db.Column('isDeleted', db.Boolean, default=False),
    db.UniqueConstraint('college_acronym', 'program_acronym', name='college_program_unique')
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
    program_acronym = db.Column(
        db.String(10),
        db.ForeignKey('Programs.program_acronym', onupdate="CASCADE", ondelete="NO ACTION"),
        nullable=True
    )
    profilePicture = db.Column(db.String(255), nullable=True, default='../static/assets/default-avatar.png')
    emailAddress = db.Column(db.String(100), nullable=True)
    phoneNumber = db.Column(db.String(20), nullable=True)
    isDeleted = db.Column(db.Boolean, default=False)
    allowUpdate = db.Column(db.Boolean, default=False)

    # Relationships
    campus = db.relationship('Campus', back_populates='users')
    college = db.relationship('College', back_populates='users')
    program = db.relationship('Program', back_populates='users')
    uploads = db.relationship('CSVUpload', back_populates='user', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<User {self.uName}>'

class Campus(db.Model):
    __tablename__ = 'Campuses'

    campus_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    campus_name = db.Column(db.String(50), unique=True, nullable=False)
    campus_acronym = db.Column(db.String(10), unique=True, nullable=False)
    isDeleted = db.Column(db.Boolean, default=False)

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
    isDeleted = db.Column(db.Boolean, default=False)

    # Relationships
    users = db.relationship('User', back_populates='college')
    campuses = db.relationship('Campus', secondary=campus_colleges, back_populates='colleges')

    def __repr__(self):
        return f'<College {self.college_name}>'

class Program(db.Model):
    __tablename__ = 'Programs'

    program_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    program_name = db.Column(db.String(50), unique=True, nullable=False)
    program_acronym = db.Column(db.String(10), unique=True, nullable=False)
    isDeleted = db.Column(db.Boolean, default=False)

    # Relationships
    users = db.relationship('User', back_populates='program', foreign_keys='User.program_acronym', primaryjoin="Program.program_acronym==User.program_acronym", lazy=True)
    colleges = db.relationship('College', secondary=college_programs, backref='programs')
    campuses = db.relationship('Campus', secondary=campus_programs, backref='programs')

    def __repr__(self):
        return f'<Program {self.program_name}>'

class UserApproval(db.Model):
    __tablename__ = 'UserApproval'

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    uName = db.Column(db.String(50), unique=True, nullable=False)
    pWord = db.Column(db.String(200), nullable=False)  # Hashed password
    userType = db.Column(db.String(50), nullable=False)
    firstName = db.Column(db.String(50), nullable=False)
    lastName = db.Column(db.String(50), nullable=False)
    campus_acronym = db.Column(
        db.String(50),
        db.ForeignKey('Campuses.campus_acronym', onupdate="CASCADE", ondelete="NO ACTION"),
        nullable=True
    )
    college_name = db.Column(
        db.String(50),
        db.ForeignKey('Colleges.college_name', onupdate="CASCADE", ondelete="NO ACTION"),
        nullable=True
    )
    program_acronym = db.Column(
        db.String(10),
        db.ForeignKey('Programs.program_acronym', onupdate="CASCADE", ondelete="NO ACTION"),
        nullable=True
    )
    date_registered = db.Column(db.DateTime, default=lambda: datetime.now(PH_TZ))

    # Relationships
    campus = db.relationship('Campus', back_populates='pending_users')
    college = db.relationship('College', back_populates='pending_users')
    program = db.relationship(
        'Program',
        back_populates='pending_users',
        foreign_keys=[program_acronym],
        primaryjoin="Program.program_acronym==UserApproval.program_acronym"
    )

    def __repr__(self):
        return f'<UserApproval {self.uName}>'

# Add relationship properties to Campus and College models
Campus.pending_users = db.relationship('UserApproval', back_populates='campus', cascade="all, delete-orphan")
College.pending_users = db.relationship('UserApproval', back_populates='college', cascade="all, delete-orphan")
Program.pending_users = db.relationship('UserApproval', back_populates='program', cascade="all, delete-orphan")

PH_TZ = pytz.timezone('Asia/Manila')
class CSVUpload(db.Model):
    __tablename__ = 'Uploads'
    
    upload_id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(150), nullable=False)
    comments1 = db.Column(db.JSON, nullable=False)  # Stores original comments
    comments2 = db.Column(db.JSON, nullable=False)  # Stores original comments
    comments3 = db.Column(db.JSON, nullable=False)  # Stores original comments
    sentiment1 = db.Column(db.JSON, nullable=False)  # Stores sentiment results
    sentiment2 = db.Column(db.JSON, nullable=False)  # Stores sentiment results
    sentiment3 = db.Column(db.JSON, nullable=False)  # Stores sentiment results
    topics1 = db.Column(db.JSON, nullable=True)  # Stores topic modeling results
    topics2 = db.Column(db.JSON, nullable=True)  # Stores topic modeling results
    topics3 = db.Column(db.JSON, nullable=True)  # Stores topic modeling results
    recommendation = db.Column(db.String, nullable=False)  # Stores recommendation
    upload_date = db.Column(db.DateTime, default=lambda: datetime.now(PH_TZ))
    teacher_uname = db.Column(db.String(50), db.ForeignKey('Users.uName', ondelete='SET NULL'), nullable=False)

    # Relationships
    user = db.relationship('User', back_populates='uploads')

    def __repr__(self):
        return f'<CSVUpload {self.filename}>'
