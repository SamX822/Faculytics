from functools import wraps
from flask import session, redirect, url_for, abort

def dean_chairperson_hr_vcaa_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        allowed_types = ['Dean', 'Chairperson', 'University HR', 'Campus HR', 'Vice Chancellor for Academic Affairs']
        if 'userType' not in session or session['userType'] not in allowed_types:
            abort(403)  # Forbidden
        return f(*args, **kwargs)
    return decorated_function