from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
import datetime

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False)
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
    db.create_all()

# Serve static files (HTML, JS, CSS)
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(path):
        return send_from_directory('.', path)
    return "Not found", 404

# API Endpoints

@app.route('/api/subscribe', methods=['POST'])
def subscribe():
    data = request.json
    name = data.get('name')
    phone = data.get('phone')
    trx_id = data.get('trx_id')
    plan = data.get('plan')

    if not all([name, phone, trx_id, plan]):
        return jsonify({"error": "All fields are required"}), 400

    user = User.query.filter_by(phone=phone).first()
    if not user:
        user = User(name=name, phone=phone)
        db.session.add(user)
        db.session.flush() # To get user.id

    # Check if trx_id already exists
    if Transaction.query.filter_by(trx_id=trx_id).first():
        return jsonify({"error": "Transaction ID already used"}), 400

    # Create transaction
    trx = Transaction(user_id=user.id, trx_id=trx_id, plan=plan, status='pending')
    db.session.add(trx)
    db.session.commit()

    return jsonify({"message": "Subscription request submitted successfully! Awaiting admin approval."}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    phone = data.get('phone')
    
    user = User.query.filter_by(phone=phone).first()
    if not user:
        return jsonify({"error": "Phone number not registered"}), 404

    # Check if subscription is still active
    is_active = False
    if user.current_status == 'active' and user.end_date:
        if user.end_date > datetime.datetime.utcnow():
            is_active = True
        else:
            user.current_status = 'inactive'
            db.session.commit()

    return jsonify({
        "name": user.name,
        "phone": user.phone,
        "is_active": is_active,
        "end_date": user.end_date.isoformat() if user.end_date else None
    }), 200

# Admin Authentication
ADMIN_USER = 'admin'
ADMIN_PASS = 'admin123'
ADMIN_TOKEN = 'mathhub_admin_secret_token_999'

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
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
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
            "phone": t.user.phone,
            "trx_id": t.trx_id,
            "plan": t.plan,
            "status": t.status,
            "created_at": t.created_at.isoformat()
        })
    return jsonify(res), 200

@app.route('/api/admin/transactions/<int:trx_id>/approve', methods=['POST'])
@require_admin
def approve_transaction(trx_id):
    trx = Transaction.query.get_or_404(trx_id)
    if trx.status != 'pending':
        return jsonify({"error": "Transaction is already processed"}), 400
        
    trx.status = 'approved'
    user = trx.user
    
    # Calculate new end date
    now = datetime.datetime.utcnow()
    # If user already has an active sub, extend it. Otherwise, start from now.
    current_end = user.end_date if (user.end_date and user.end_date > now) else now
    
    if trx.plan == 'monthly':
        user.end_date = current_end + datetime.timedelta(days=30)
    elif trx.plan == 'yearly':
        user.end_date = current_end + datetime.timedelta(days=365)
        
    user.current_status = 'active'
    db.session.commit()
    
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
    app.run(debug=True, port=5000)
