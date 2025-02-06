from flask import Flask
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# Configuration for PostgreSQL (adjust as needed)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:21463112@localhost:5432/postgres'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize the database
db = SQLAlchemy(app)

# Import views (routes) so that they are registered with the app.
from Faculytics import views