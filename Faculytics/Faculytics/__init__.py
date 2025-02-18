from flask import Flask
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:admin@localhost:5432/postgres'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Set a secret key for session management
app.secret_key = "FaculSecure"

# Initialize the database
db = SQLAlchemy(app)

# Import views (routes) so that they are registered with the app.
from Faculytics import views
