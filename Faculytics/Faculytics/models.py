# models.py
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

    def __repr__(self):
        return f'<User {self.uName}>'

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

    def __repr__(self):
        return f'<CSVUpload {self.filename}>'
