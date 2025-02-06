from . import db

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

class CSVUpload(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(150), nullable=False)
    upload_date = db.Column(db.DateTime, server_default=db.func.now())

    def __repr__(self):
        return f'<CSVUpload {self.filename}>'
