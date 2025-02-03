"""
This script runs the Faculytics application using a development server.
"""

from os import environ
from Faculytics import app

if __name__ == '__main__':
    HOST = environ.get('SERVER_HOST', '127.0.0.1')  # Use localhost explicitly
    PORT = 5000  # Explicitly set port 5000
    app.run(host=HOST, port=PORT, debug=True, use_reloader=False)
