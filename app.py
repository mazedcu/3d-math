from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
import datetime
import uuid
import ssl
import smtplib
import threading
import time
import re
from collections import defaultdict
from email.message import EmailMessage
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', uuid.uuid4().hex)
CORS(app, origins=os.environ.get('CORS_ORIGINS', '*').split(','))

# ------------------------------------------------------------------
# Security headers — injected on every response
# ------------------------------------------------------------------
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    return response

# ------------------------------------------------------------------
# Simple in-memory rate limiter (no extra dependencies)
# ------------------------------------------------------------------
_rate_store = defaultdict(list)   # key → list of timestamps

def _rate_limited(key, max_requests, window_seconds):
    """Return True if the key has exceeded max_requests within window."""
    now = time.time()
    timestamps = _rate_store[key]
    # Prune old entries
    _rate_store[key] = [t for t in timestamps if now - t < window_seconds]
    if len(_rate_store[key]) >= max_requests:
        return True
    _rate_store[key].append(now)
    return False

def rate_limit(endpoint, max_req=5, window=60):
    """Check rate limit for the current request IP + endpoint.
    Returns a 429 response if exceeded, or None if OK."""
    ip = request.remote_addr or 'unknown'
    key = f"{endpoint}:{ip}"
    if _rate_limited(key, max_req, window):
        return jsonify({"error": "Too many requests. Please wait and try again."}), 429
    return None

# ------------------------------------------------------------------
# Input validation helpers
# ------------------------------------------------------------------
def validate_password(password):
    """Enforce minimum password requirements. Returns error string or None."""
    if not password or len(password) < 8:
        return "Password must be at least 8 characters long."
    if len(password) > 128:
        return "Password must be at most 128 characters."
    return None

def validate_email(email):
    """Basic server-side email format check."""
    if not email or len(email) > 120:
        return "Invalid email address."
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(pattern, email):
        return "Invalid email format."
    return None

def validate_name(name):
    if not name or len(name) > 100:
        return "Name must be between 1 and 100 characters."
    return None

# ------------------------------------------------------------------
# Email configuration (read from environment variables, never hardcode)
#   SMTP_HOST   - default smtp.gmail.com
#   SMTP_PORT   - default 587
#   SMTP_USER   - the Gmail address that sends the mail
#   SMTP_PASS   - the Gmail App Password (16 chars, no spaces)
#   FROM_EMAIL  - optional display "from" address (defaults to SMTP_USER)
#   FROM_NAME   - optional sender name (defaults to "Numberfield")
#   SITE_URL    - public site url used in email links
# ------------------------------------------------------------------
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
FROM_EMAIL = os.environ.get('FROM_EMAIL', SMTP_USER)
FROM_NAME = os.environ.get('FROM_NAME', 'Numberfield')
SITE_URL = os.environ.get('SITE_URL', 'https://numberfield.xyz')


def _send_email_sync(to_email, subject, text_body, html_body=None):
    """Send a single email via SMTP. Logs and swallows errors so the
    caller (e.g. an admin approval) never fails just because mail did."""
    if not (SMTP_USER and SMTP_PASS):
        print('[email] SMTP_USER/SMTP_PASS not configured; skipping email to', to_email)
        return
    try:
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = f'{FROM_NAME} <{FROM_EMAIL}>'
        msg['To'] = to_email
        msg.set_content(text_body)
        if html_body:
            msg.add_alternative(html_body, subtype='html')

        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        print('[email] sent to', to_email, '-', subject)
    except Exception as e:
        print('[email] FAILED to send to', to_email, ':', repr(e))


def send_email_async(to_email, subject, text_body, html_body=None):
    """Fire-and-forget email so HTTP requests are not blocked by SMTP latency."""
    threading.Thread(
        target=_send_email_sync,
        args=(to_email, subject, text_body, html_body),
        daemon=True,
    ).start()


def send_approval_email(user, plan, end_date):
    plan_label = 'Yearly' if plan == 'yearly' else 'Monthly'
    end_str = end_date.strftime('%d %b %Y') if end_date else ''
    subject = 'Your Numberfield subscription is active!'
    text_body = (
        f"Hi {user.name},\n\n"
        f"Great news \u2014 your registration was successful and your {plan_label} "
        f"subscription has been approved!\n\n"
        f"You now have full access to all premium games until {end_str}.\n\n"
        f"Start playing here: {SITE_URL}\n\n"
        f"Thanks for joining,\n"
        f"The Numberfield Team"
    )
    html_body = f"""\
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#0d0524;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.25);">
        <div style="background:linear-gradient(135deg,#ff4ecd,#a855f7,#22d3ee);padding:28px 24px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;">Numberfield</h1>
        </div>
        <div style="padding:28px 28px 32px;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a2e;">Registration successful! &#127881;</h2>
          <p style="margin:0 0 14px;color:#444;font-size:15px;line-height:1.6;">Hi {user.name},</p>
          <p style="margin:0 0 14px;color:#444;font-size:15px;line-height:1.6;">
            Your <strong>{plan_label} subscription</strong> has been approved and is now active.
            You have full access to every premium math game{f' until <strong>{end_str}</strong>' if end_str else ''}.
          </p>
          <div style="text-align:center;margin:26px 0;">
            <a href="{SITE_URL}" style="display:inline-block;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;text-decoration:none;font-weight:700;padding:14px 32px;border-radius:12px;font-size:15px;">Start Playing</a>
          </div>
          <p style="margin:0;color:#888;font-size:13px;line-height:1.6;">Thanks for joining,<br>The Numberfield Team</p>
        </div>
      </div>
    </div>
  </body>
</html>"""
    send_email_async(user.email, subject, text_body, html_body)


def send_reset_email(user, token):
    reset_link = f"{SITE_URL}/?reset_token={token}"
    subject = 'Reset your Numberfield password'
    text_body = (
        f"Hi {user.name},\n\n"
        f"We received a request to reset your Numberfield password.\n\n"
        f"Click the link below to choose a new password:\n{reset_link}\n\n"
        f"If you didn't request this, you can safely ignore this email \u2014 "
        f"your password will stay the same.\n\n"
        f"The Numberfield Team"
    )
    html_body = f"""\
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#0d0524;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.25);">
        <div style="background:linear-gradient(135deg,#ff4ecd,#a855f7,#22d3ee);padding:28px 24px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;">Numberfield</h1>
        </div>
        <div style="padding:28px 28px 32px;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a2e;">Reset your password</h2>
          <p style="margin:0 0 14px;color:#444;font-size:15px;line-height:1.6;">Hi {user.name},</p>
          <p style="margin:0 0 14px;color:#444;font-size:15px;line-height:1.6;">
            We received a request to reset your Numberfield password. Click the button below to choose a new one.
          </p>
          <div style="text-align:center;margin:26px 0;">
            <a href="{reset_link}" style="display:inline-block;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;text-decoration:none;font-weight:700;padding:14px 32px;border-radius:12px;font-size:15px;">Reset Password</a>
          </div>
          <p style="margin:0 0 14px;color:#888;font-size:13px;line-height:1.6;word-break:break-all;">
            Or paste this link into your browser:<br><a href="{reset_link}" style="color:#a855f7;">{reset_link}</a>
          </p>
          <p style="margin:0;color:#888;font-size:13px;line-height:1.6;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      </div>
    </div>
  </body>
</html>"""
    send_email_async(user.email, subject, text_body, html_body)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    reset_token = db.Column(db.String(100), nullable=True)
    current_status = db.Column(db.String(20), default='inactive') # inactive, active
    end_date = db.Column(db.DateTime, nullable=True)

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    trx_id = db.Column(db.String(100), unique=True, nullable=False)
    plan = db.Column(db.String(20), nullable=False) # monthly, yearly
    status = db.Column(db.String(20), default='pending') # pending, approved, rejected
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    user = db.relationship('User', backref=db.backref('transactions', lazy=True))

with app.app_context():
    try:
        db.create_all()
    except Exception as e:
        pass

# Serve static files (HTML, JS, CSS)
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(path):
        return send_from_directory('.', path)
    return "Not found", 404

# Auth API Endpoints
@app.route('/api/register', methods=['POST'])
def register():
    rl = rate_limit('register', max_req=5, window=60)
    if rl: return rl

    data = request.json
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not all([name, email, password]):
        return jsonify({"error": "All fields are required"}), 400

    err = validate_name(name)
    if err: return jsonify({"error": err}), 400
    err = validate_email(email)
    if err: return jsonify({"error": err}), 400
    err = validate_password(password)
    if err: return jsonify({"error": err}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400

    hashed = generate_password_hash(password)
    user = User(name=name, email=email, password_hash=hashed)
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Registration successful"}), 201

@app.route('/api/trial/register', methods=['POST'])
def trial_register():
    rl = rate_limit('trial_register', max_req=5, window=60)
    if rl: return rl

    data = request.json
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not all([name, email, password]):
        return jsonify({"error": "All fields are required"}), 400

    err = validate_name(name)
    if err: return jsonify({"error": err}), 400
    err = validate_email(email)
    if err: return jsonify({"error": err}), 400
    err = validate_password(password)
    if err: return jsonify({"error": err}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400

    hashed = generate_password_hash(password)
    trial_end = datetime.datetime.utcnow() + datetime.timedelta(days=3)
    user = User(
        name=name,
        email=email,
        password_hash=hashed,
        current_status='active',
        end_date=trial_end
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "Trial started!",
        "name": user.name,
        "email": user.email,
        "is_active": True,
        "is_trial": True,
        "end_date": trial_end.isoformat()
    }), 201

@app.route('/api/login', methods=['POST'])
def login():
    rl = rate_limit('login', max_req=5, window=60)
    if rl: return rl

    data = request.json
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    # Check if subscription is still active
    is_active = False
    now = datetime.datetime.utcnow()
    if user.current_status == 'active' and user.end_date:
        if user.end_date > now:
            is_active = True
        else:
            user.current_status = 'inactive'
            db.session.commit()

    # Determine trial status (trial users have no paid transaction)
    has_paid = any(t.status == 'approved' for t in user.transactions)
    is_trial = is_active and not has_paid
    days_left = max(0, (user.end_date - now).days) if user.end_date and is_active else 0

    return jsonify({
        "name": user.name,
        "email": user.email,
        "is_active": is_active,
        "is_trial": is_trial,
        "days_left": days_left,
        "end_date": user.end_date.isoformat() if user.end_date else None
    }), 200

@app.route('/api/status', methods=['POST'])
def status():
    data = request.json
    email = data.get('email')
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    is_active = False
    now = datetime.datetime.utcnow()
    if user.current_status == 'active' and user.end_date:
        if user.end_date > datetime.datetime.utcnow():
            is_active = True
        else:
            user.current_status = 'inactive'
            db.session.commit()

    return jsonify({
        "is_active": is_active,
        "end_date": user.end_date.isoformat() if user.end_date else None
    }), 200


@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    rl = rate_limit('forgot_password', max_req=3, window=60)
    if rl: return rl

    email = (request.json.get('email') or '').strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user:
        # Don't reveal if email exists, just pretend it succeeded
        return jsonify({"message": "If the email exists, a reset link has been provided."}), 200
        
    token = str(uuid.uuid4())
    user.reset_token = token
    db.session.commit()

    # Email the reset link to the user (non-blocking)
    send_reset_email(user, token)

    return jsonify({"message": "If that email is registered, a password reset link has been sent. Please check your inbox."}), 200

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    rl = rate_limit('reset_password', max_req=5, window=60)
    if rl: return rl

    data = request.json
    token = data.get('token')
    new_password = data.get('password', '')

    err = validate_password(new_password)
    if err: return jsonify({"error": err}), 400
    
    user = User.query.filter_by(reset_token=token).first()
    if not user:
        return jsonify({"error": "Invalid or expired token"}), 400
        
    user.password_hash = generate_password_hash(new_password)
    user.reset_token = None
    db.session.commit()
    
    return jsonify({"message": "Password reset successfully!"}), 200

@app.route('/api/subscribe', methods=['POST'])
def subscribe():
    rl = rate_limit('subscribe', max_req=5, window=60)
    if rl: return rl

    data = request.json
    email = (data.get('email') or '').strip().lower()
    trx_id = (data.get('trx_id') or '').strip()
    plan = data.get('plan')

    if not all([email, trx_id, plan]):
        return jsonify({"error": "Missing required fields"}), 400

    if len(trx_id) > 100:
        return jsonify({"error": "Transaction ID is too long."}), 400

    if plan not in ('monthly', 'yearly'):
        return jsonify({"error": "Invalid plan."}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found, please log in again"}), 401

    # Check if trx_id already exists
    if Transaction.query.filter_by(trx_id=trx_id).first():
        return jsonify({"error": "Transaction ID already used"}), 400

    # Create transaction
    trx = Transaction(user_id=user.id, trx_id=trx_id, plan=plan, status='pending')
    db.session.add(trx)
    db.session.commit()

    return jsonify({"message": "Subscription request submitted successfully! Awaiting admin approval."}), 201

# Admin Authentication — credentials from environment variables, never hardcoded
ADMIN_USER = os.environ.get('ADMIN_USER', 'admin')
ADMIN_PASS = os.environ.get('ADMIN_PASS', '')          # MUST be set in /etc/numberfield.env
ADMIN_TOKEN = os.environ.get('ADMIN_TOKEN', uuid.uuid4().hex)

def require_admin(f):
    def wrapper(*args, **kwargs):
        auth = request.headers.get('Authorization')
        if not auth or auth != f"Bearer {ADMIN_TOKEN}":
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    rl = rate_limit('admin_login', max_req=3, window=60)
    if rl: return rl

    if not ADMIN_PASS:
        return jsonify({"error": "Admin not configured."}), 503

    data = request.json
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    
    if username == ADMIN_USER and password == ADMIN_PASS:
        return jsonify({"token": ADMIN_TOKEN}), 200
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/admin/transactions', methods=['GET'])
@require_admin
def get_transactions():
    transactions = Transaction.query.order_by(Transaction.created_at.desc()).all()
    res = []
    for t in transactions:
        res.append({
            "id": t.id,
            "name": t.user.name,
            "email": t.user.email,
            "trx_id": t.trx_id,
            "plan": t.plan,
            "status": t.status,
            "created_at": t.created_at.isoformat()
        })
    return jsonify(res), 200

@app.route('/api/admin/users', methods=['GET'])
@require_admin
def get_users():
    users = User.query.all()
    res = []
    now = datetime.datetime.utcnow()
    for u in users:
        days_left = 0
        if u.current_status == 'active' and u.end_date:
            delta = u.end_date - now
            days_left = max(0, delta.days)
            
        res.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "status": u.current_status,
            "days_left": days_left
        })
    return jsonify(res), 200

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@require_admin
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    Transaction.query.filter_by(user_id=user.id).delete()
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted successfully"}), 200

@app.route('/api/admin/transactions/<int:trx_id>/approve', methods=['POST'])
@require_admin
def approve_transaction(trx_id):
    trx = Transaction.query.get_or_404(trx_id)
    if trx.status != 'pending':
        return jsonify({"error": "Transaction is already processed"}), 400
        
    trx.status = 'approved'
    user = trx.user
    
    now = datetime.datetime.utcnow()
    current_end = user.end_date if (user.end_date and user.end_date > now) else now
    
    if trx.plan == 'monthly':
        user.end_date = current_end + datetime.timedelta(days=30)
    elif trx.plan == 'yearly':
        user.end_date = current_end + datetime.timedelta(days=365)
        
    user.current_status = 'active'
    db.session.commit()

    # Notify the user that their subscription is now active (non-blocking)
    send_approval_email(user, trx.plan, user.end_date)

    return jsonify({"message": "Transaction approved!"}), 200

@app.route('/api/admin/transactions/<int:trx_id>/reject', methods=['POST'])
@require_admin
def reject_transaction(trx_id):
    trx = Transaction.query.get_or_404(trx_id)
    if trx.status != 'pending':
        return jsonify({"error": "Transaction is already processed"}), 400
        
    trx.status = 'rejected'
    db.session.commit()
    return jsonify({"message": "Transaction rejected!"}), 200

if __name__ == '__main__':
    app.run(debug=False, port=5000)
