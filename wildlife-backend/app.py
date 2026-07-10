from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()
import os
import requests
import base64
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Tuple
from werkzeug.utils import secure_filename

IST = timezone(timedelta(hours=5, minutes=30))

# ========== CREATE FLASK APP ==========
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure app
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-123')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///wildlife_alerts.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Image configuration
app.config['UPLOAD_FOLDER'] = 'static/images'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif'}

# Create upload directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize extensions 
db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")  # Enable CORS for SocketIO

# ========== ANIMAL SPECIES CONFIGURATION ==========
ANIMAL_SPECIES = {
    # Wild Animals (High Priority)
    'elephant': {'category': 'wildlife', 'priority': 'critical', 'emoji': '🐘', 'danger': 'high'},
    'lion': {'category': 'wildlife', 'priority': 'critical', 'emoji': '🦁', 'danger': 'high'},
    'tiger': {'category': 'wildlife', 'priority': 'critical', 'emoji': '🐅', 'danger': 'high'},
    'leopard': {'category': 'wildlife', 'priority': 'critical', 'emoji': '🐆', 'danger': 'high'},
    'bear': {'category': 'wildlife', 'priority': 'high', 'emoji': '🐻', 'danger': 'high'},
    'wild_boar': {'category': 'wildlife', 'priority': 'high', 'emoji': '🐗', 'danger': 'medium'},
    'deer': {'category': 'wildlife', 'priority': 'medium', 'emoji': '🦌', 'danger': 'low'},
    'monkey': {'category': 'wildlife', 'priority': 'medium', 'emoji': '🐒', 'danger': 'low'},
    'fox': {'category': 'wildlife', 'priority': 'medium', 'emoji': '🦊', 'danger': 'low'},
    'wolf': {'category': 'wildlife', 'priority': 'high', 'emoji': '🐺', 'danger': 'high'},
    
    # Domestic Animals
    'cow': {'category': 'livestock', 'priority': 'medium', 'emoji': '🐄', 'danger': 'low'},
    'buffalo': {'category': 'livestock', 'priority': 'medium', 'emoji': '🐃', 'danger': 'low'},
    'goat': {'category': 'livestock', 'priority': 'low', 'emoji': '🐐', 'danger': 'low'},
    'sheep': {'category': 'livestock', 'priority': 'low', 'emoji': '🐑', 'danger': 'low'},
    'dog': {'category': 'domestic', 'priority': 'low', 'emoji': '🐕', 'danger': 'low'},
    'cat': {'category': 'domestic', 'priority': 'low', 'emoji': '🐈', 'danger': 'low'},
    'horse': {'category': 'livestock', 'priority': 'medium', 'emoji': '🐎', 'danger': 'low'},
    'donkey': {'category': 'livestock', 'priority': 'low', 'emoji': '🫏', 'danger': 'low'},
    
    # Human
    'human': {'category': 'human', 'priority': 'critical', 'emoji': '👤', 'danger': 'high'},
    
    # Unknown/Other
    'unknown': {'category': 'unknown', 'priority': 'low', 'emoji': '❓', 'danger': 'unknown'},
    'vehicle': {'category': 'vehicle', 'priority': 'medium', 'emoji': '🚗', 'danger': 'low'}
}

# ========== TELEGRAM BOT CLASS ==========
class TelegramBot:
    """Handles Telegram notifications with image support"""
    
    def __init__(self):
        self.token = os.getenv('TELEGRAM_BOT_TOKEN', '').strip()
        self.chat_id = os.getenv('TELEGRAM_CHAT_ID', '').strip()
        self.enabled = os.getenv('TELEGRAM_ENABLED', 'False').lower() in ('true', '1', 't')
        self.send_images = os.getenv('TELEGRAM_SEND_IMAGES', 'False').lower() in ('true', '1', 't')
        
        print("DEBUG → TELEGRAM_ENABLED:", self.enabled)
        print("DEBUG → TELEGRAM_SEND_IMAGES:", self.send_images)
        print("DEBUG → BOT TOKEN LENGTH:", len(self.token))
        print("DEBUG → CHAT ID:", self.chat_id)
        # Validate configuration
        self._validate_config()
    
    def _validate_config(self):
        """Check if Telegram is properly configured"""
        if not self.enabled:
            print("ℹ️ Telegram notifications are disabled")
            return
        
        if not self.token:
            print("⚠️ TELEGRAM_BOT_TOKEN not set. Telegram disabled.")
            self.enabled = False
            return
            
        if not self.chat_id:
            print("⚠️ TELEGRAM_CHAT_ID not set. Telegram disabled.")
            self.enabled = False
            return
            
        print(f"✅ Telegram bot configured for chat ID: {self.chat_id}")
        print(f"📸 Image sending: {'✅ ENABLED' if self.send_images else '❌ DISABLED'}")
    
    def send_alert(self, alert_data: Dict[str, Any]) -> bool:
        """
        Send alert notification to Telegram with image if available
        Returns True if successful, False otherwise
        """
        if not self.enabled:
            return False
        
        try:
            # Format the message
            message = self._format_alert_message(alert_data)
            
            # Try to send with image first
            if self.send_images and alert_data.get('image_url'):
                success = self._send_alert_with_image(alert_data, message)
                if success:
                    return True
            
            # Fallback to text-only if image fails or not available
            return self._send_text_alert(message)
            
        except Exception as e:
            print(f"❌ Telegram send error: {e}")
            return False
    
    def _send_text_alert(self, message: str) -> bool:
        """Send text-only alert to Telegram"""
        try:
            url = f"https://api.telegram.org/bot{self.token}/sendMessage"
            payload = {
                'chat_id': self.chat_id,
                'text': message,
                'parse_mode': 'HTML',
                'disable_web_page_preview': False
            }
            
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            
            print(f"✅ Telegram text alert sent")
            return True
            
        except Exception as e:
            print(f"❌ Failed to send Telegram text alert: {e}")
            return False
    
    def _send_alert_with_image(self, alert_data, caption):
        try:
            image_url = alert_data.get('image_url')
            if not image_url:
                print("❌ No image_url in alert_data")
                return False

            # Convert API URL to local file path
            filename = image_url.split('/')[-1]
            image_path = os.path.join(
                os.path.dirname(__file__),
                "static",
                "images",
                filename
            )

            print("📸 Telegram image path:", image_path)

            if not os.path.exists(image_path):
                print("❌ Image file not found:", image_path)
                return False

            url = f"https://api.telegram.org/bot{self.token}/sendPhoto"

            with open(image_path, "rb") as img:
                response = requests.post(
                    url,
                    data={
                        "chat_id": self.chat_id,
                        "caption": caption,
                        "parse_mode": "HTML"
                    },
                    files={"photo": img},
                    timeout=20
                )

            print("📨 Telegram response:", response.status_code, response.text)
            return response.ok

        except Exception as e:
            print("❌ Telegram image send exception:", e)
            return False

        

    def _format_alert_message(self, alert_data: Dict[str, Any]) -> str:
        """Format alert data into a nice Telegram message"""
        detection = alert_data['detection']
        location = alert_data['location']
        
        # Get species info
        species = detection['species']
        species_info = ANIMAL_SPECIES.get(species, {})
        emoji = species_info.get('emoji', '❓')
        danger = species_info.get('danger', 'unknown')
        
        # Format display name
        display_name = species.replace('_', ' ').title()
        
        # Priority indicator
        priority = detection['priority']
        if priority == 'critical':
            priority_icon = '🔴'
            urgency = "CRITICAL ALERT"
        elif priority == 'high':
            priority_icon = '🟠' 
            urgency = "HIGH PRIORITY"
        else:
            priority_icon = '🟡'
            urgency = "ALERT"
        
        # Confidence indicator
        confidence = detection['confidence']
        if confidence >= 0.9:
            confidence_icon = '🎯'
        elif confidence >= 0.7:
            confidence_icon = '✅'
        else:
            confidence_icon = '⚠️'
        
        # Build message
        message = f"{priority_icon} <b>{urgency}</b> {priority_icon}\n"
        message += f"{emoji} <b>{display_name}</b> detected\n\n"
        
        message += f"<b>Confidence:</b> {confidence_icon} {confidence*100:.1f}%\n"
        message += f"<b>Category:</b> {detection['category'].title()}\n"
        message += f"<b>Danger Level:</b> {danger.upper()}\n"
        message += f"<b>Device:</b> {alert_data['device_id']}\n"
        message += f"<b>Alert ID:</b> #{alert_data['id']}\n"
        
        # Add image info
        if alert_data.get('image_url'):
            message += f"<b>Image:</b> ✅ Included\n"
        else:
            message += f"<b>Image:</b> ❌ Not available\n"
        
        # Add location if available
        if location.get('lat') and location.get('lng'):
            lat = location['lat']
            lng = location['lng']
            google_maps = f"https://maps.google.com/?q={lat},{lng}"
            message += f"\n📍 <b>Location:</b>\n"
            message += f"Lat: {lat:.6f}\n"
            message += f"Lng: {lng:.6f}\n"
            message += f"<a href='{google_maps}'>View on Google Maps</a>\n"
        
        # Add timestamp
        timestamp = alert_data.get('timestamp', datetime.now(IST).isoformat())
        if isinstance(timestamp, str):
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                timestamp = dt.strftime("%d %b %Y, %I:%M %p")
            except:
                pass
        
        message += f"\n🕒 <i>{timestamp}</i>\n"
        
        # Add dashboard link
        message += f"\n📊 <a href='http://localhost:5173'>View in Dashboard</a>"
        
        return message
    
    def send_test_message(self) -> Tuple[bool, str]:
        """Send test message to verify bot is working"""
        if not self.enabled:
            return False, "Telegram is disabled"
        
        try:
            test_data = {
                'id': 999,
                'device_id': 'TEST_DEVICE',
                'detection': {
                    'species': 'elephant',
                    'category': 'wildlife',
                    'priority': 'critical',
                    'confidence': 0.95
                },
                'location': {
                    'lat': 12.9716,
                    'lng': 77.5946
                },
                'timestamp': datetime.now(IST).isoformat(),
                'image_url': None
            }
            
            success = self.send_alert(test_data)
            
            if success:
                return True, "✅ Test message sent successfully!"
            else:
                return False, "❌ Failed to send test message"
                
        except Exception as e:
            return False, f"❌ Error: {str(e)}"

# Initialize Telegram bot
telegram_bot = TelegramBot()

# ========== DATABASE MODEL ==========
class Alert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), nullable=False, default='unknown_device')
    timestamp = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(IST))
    species = db.Column(db.String(50), nullable=False)
    label = db.Column(db.String(50))
    confidence = db.Column(db.Float, nullable=False, default=0.0)
    bbox = db.Column(db.String(100), default='0,0,0,0')
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    category = db.Column(db.String(20))
    priority = db.Column(db.String(10))
    status = db.Column(db.String(20), default='new')
    acknowledged_by = db.Column(db.String(100))
    notes = db.Column(db.Text)
    has_image = db.Column(db.Boolean, default=False)
    image_filename = db.Column(db.String(255))  # Stores the image filename
    
    def to_dict(self):
        species_info = ANIMAL_SPECIES.get(self.species, {})
        
        return {
            'id': self.id,
            'device_id': self.device_id,
            'timestamp': self.timestamp.astimezone(IST).isoformat() if self.timestamp else None,
            'detection': {
                'species': self.species,
                'label': self.label,
                'confidence': self.confidence,
                'bbox': [int(x) for x in self.bbox.split(',')] if self.bbox else [0,0,0,0],
                'category': self.category,
                'priority': self.priority,
                'emoji': species_info.get('emoji', '❓'),
                'display_name': self.species.replace('_', ' ').title(),
                'danger': species_info.get('danger', 'unknown')
            },
            'location': {
                'lat': self.latitude,
                'lng': self.longitude
            },
            'has_image': self.has_image,
            'image_url': (
                f"http://localhost:5000/api/images/{self.image_filename}" 
                if self.image_filename else None
            ),
            'status': self.status,
            'acknowledged_by': self.acknowledged_by
        }

# ========== HELPER FUNCTIONS ==========
def save_base64_image(base64_string: str, alert_id: int) -> str:
    """Save base64 image to file and return filename"""
    try:
        if not base64_string or 'base64,' not in base64_string:
            return None
        
        # Extract base64 data
        if ',' in base64_string:
            header, data = base64_string.split(',', 1)
        else:
            data = base64_string
        
        # Generate unique filename
        filename = f"{alert_id}_{uuid.uuid4().hex[:8]}.jpg"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Decode and save
        img_data = base64.b64decode(data)
        with open(filepath, 'wb') as f:
            f.write(img_data)
        
        print(f"📸 Image saved: {filename}")
        return filename
        
    except Exception as e:
        print(f"❌ Error saving image: {e}")
        return None

def normalize_species(label: str) -> Tuple[str, str]:
    label_lower = label.lower().strip()
    
    if label_lower in ANIMAL_SPECIES:
        return label_lower, ANIMAL_SPECIES[label_lower]['category']
    
    if 'wild' in label_lower or 'animal' in label_lower:
        return 'unknown', 'wildlife'
    elif 'domestic' in label_lower or 'livestock' in label_lower:
        return 'unknown', 'livestock'
    elif 'human' in label_lower or 'person' in label_lower:
        return 'human', 'human'
    elif 'vehicle' in label_lower or 'car' in label_lower:
        return 'vehicle', 'vehicle'
    else:
        for species in ANIMAL_SPECIES:
            if species in label_lower or label_lower in species:
                return species, ANIMAL_SPECIES[species]['category']
    
    return 'unknown', 'unknown'

def get_species_info(species: str) -> Dict[str, Any]:
    if species in ANIMAL_SPECIES:
        return ANIMAL_SPECIES[species]
    
    if 'wild' in species or species == 'unknown':
        return {'category': 'wildlife', 'priority': 'medium', 'emoji': '🐾', 'danger': 'unknown'}
    else:
        return {'category': 'unknown', 'priority': 'low', 'emoji': '❓', 'danger': 'unknown'}

def parse_pi_data(data: Dict[str, Any]) -> Dict[str, Any]:
    device_id = data.get('device_id', 'unknown_device')
    
    timestamp_str = data.get("timestamp")

    if timestamp_str:
        try:
            timestamp = datetime.fromisoformat(timestamp_str)

            if timestamp.tzinfo is None:
              timestamp = timestamp.replace(tzinfo=IST)
            else:
              timestamp = timestamp.astimezone(IST)

        except Exception as e:
            print(f"Timestamp parse error: {e}")
            timestamp = datetime.now(IST)

    else:
        timestamp = datetime.now(IST)
    
    detection = data.get('detection', {})
    raw_label = detection.get('label', 'unknown')
    confidence = detection.get('confidence', 0.0)
    bbox = detection.get('bbox', [0, 0, 0, 0])
    bbox_str = ','.join(str(int(x)) for x in bbox)
    
    species, category = normalize_species(raw_label)
    species_info = get_species_info(species)
    
    location = data.get('location', {})
    latitude = location.get('lat')
    longitude = location.get('lng')
    
    has_image = bool(data.get('image_base64'))
    image_base64 = data.get('image_base64')

    
    return {
        'device_id': device_id,
        'timestamp': timestamp,
        'species': species,
        'raw_label': raw_label,
        'confidence': confidence,
        'bbox_str': bbox_str,
        'latitude': latitude,
        'longitude': longitude,
        'category': category,
        'priority': species_info['priority'],
        'has_image': has_image,
        'image_base64': image_base64
    }

# ========== API ROUTES ==========
@app.route('/')
def home():
    return jsonify({
        "message": "Wildlife Alert System Backend",
        "status": "running",
        "version": "7.0 - With Image Support",
        "telegram_enabled": telegram_bot.enabled,
        "telegram_images": telegram_bot.send_images,
        "websocket_enabled": True,
        "image_storage": True,
        "endpoints": {
            "POST /api/alert": "Send detection (with image)",
            "GET /api/alerts": "Get alerts",
            "GET /api/alerts/<id>": "Get specific alert",
            "GET /api/images/<filename>": "Get image",
            "PUT /api/alerts/<id>/status": "Update alert status",
            "GET /api/species": "List detectable species",
            "GET /api/stats": "Get statistics",
            "GET /api/telegram/test": "Test Telegram connection",
            "GET /api/telegram/status": "Check Telegram status",
            "GET /health": "Health check",
            "WS /socket.io": "WebSocket for real-time updates"
        }
    })

@app.route('/health')
def health_check():
    try:
        alert_count = Alert.query.count()
        image_count = Alert.query.filter(Alert.image_filename.isnot(None)).count()
        
        return jsonify({
            "status": "healthy",
            "database": "connected",
            "telegram": telegram_bot.enabled,
            "telegram_images": telegram_bot.send_images,
            "websocket": True,
            "image_storage": True,
            "alerts_in_db": alert_count,
            "alerts_with_images": image_count,
            "time": datetime.now(IST).isoformat()
        })
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

@app.route('/api/alert', methods=['POST'])
def receive_alert():
    """
    Receive alert from Raspberry Pi
    Saves to database, broadcasts via WebSocket, and sends Telegram notification
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data received"}), 400
        
        # Parse Pi data
        parsed_data = parse_pi_data(data)
        
        # Create alert object
        alert = Alert(
            device_id=parsed_data['device_id'],
            timestamp=parsed_data['timestamp'],
            species=parsed_data['species'],
            label=parsed_data['raw_label'],
            confidence=parsed_data['confidence'],
            bbox=parsed_data['bbox_str'],
            latitude=parsed_data['latitude'],
            longitude=parsed_data['longitude'],
            category=parsed_data['category'],
            priority=parsed_data['priority'],
            has_image=parsed_data['has_image']
        )
        
        db.session.add(alert)
        db.session.flush()  # Get alert ID before commit
        
        # Save image if present
        if parsed_data['has_image'] and parsed_data.get('image_base64'):
            image_filename = save_base64_image(
                parsed_data['image_base64'], 
                alert.id
            )
            if image_filename:
                alert.image_filename = image_filename
                alert.has_image = True
        
        db.session.commit()
        
        # Convert to dict for responses
        alert_dict = alert.to_dict()
        
        # ========== WEBSOCKET BROADCAST ==========
        socketio.emit('new_alert', alert_dict, namespace='/')
        print(f"📡 WebSocket broadcast sent for alert #{alert.id}")
        # =========================================
        
        # Send Telegram notification
        telegram_sent = False
        if alert.priority in ['critical', 'high'] and alert.confidence > 0.7:
            telegram_sent = telegram_bot.send_alert(alert_dict)
        
        # Console output
        species_info = get_species_info(alert.species)
        emoji = species_info.get('emoji', '❓')
        display_name = alert.species.replace('_', ' ').title()
        
        print(f"\n{'='*60}")
        print(f"{emoji} NEW {alert.priority.upper()} ALERT #{alert.id}")
        print(f"{emoji} Species: {display_name}")
        print(f"{emoji} Confidence: {alert.confidence*100:.1f}%")
        print(f"{emoji} Image: {'✅ SAVED' if alert.image_filename else '❌ NO IMAGE'}")
        print(f"{emoji} WebSocket: ✅ BROADCAST")
        print(f"{emoji} Telegram: {'✅ SENT' if telegram_sent else '⏭️ SKIPPED'}")
        print(f"{emoji} {'='*60}")
        
        return jsonify({
            "message": f"Alert saved: {display_name} detected",
            "alert_id": alert.id,
            "telegram_sent": telegram_sent,
            "has_image": alert.has_image,
            "image_url": alert_dict.get('image_url'),
            "websocket_broadcast": True,
            "alert": alert_dict
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/images/<filename>')
def serve_image(filename):
    """Serve uploaded images"""
    try:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if os.path.exists(filepath):
            return send_file(filepath, mimetype='image/jpeg')
        else:
            return jsonify({"error": "Image not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    try:
        species = request.args.get('species')
        category = request.args.get('category')
        priority = request.args.get('priority')
        has_image = request.args.get('has_image')
        min_confidence = request.args.get('min_confidence', type=float)
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        query = Alert.query
        
        if species:
            query = query.filter_by(species=species)
        if category:
            query = query.filter_by(category=category)
        if priority:
            query = query.filter_by(priority=priority)
        if has_image:
            if has_image.lower() == 'true':
                query = query.filter(Alert.has_image == True)
            elif has_image.lower() == 'false':
                query = query.filter(Alert.has_image == False)
        if min_confidence:
            query = query.filter(Alert.confidence >= min_confidence)
        
        total = query.count()
        alerts = query.order_by(Alert.timestamp.desc()).offset(offset).limit(limit).all()
        
        return jsonify({
            "count": len(alerts),
            "total": total,
            "offset": offset,
            "limit": limit,
            "filters": {
                "species": species,
                "category": category,
                "priority": priority,
                "has_image": has_image,
                "min_confidence": min_confidence
            },
            "alerts": [alert.to_dict() for alert in alerts]
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/alerts/<int:alert_id>', methods=['GET'])
def get_alert(alert_id):
    try:
        alert = Alert.query.get(alert_id)
        if not alert:
            return jsonify({"error": "Alert not found"}), 404
        
        return jsonify({
            "alert": alert.to_dict()
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/alerts/<int:alert_id>/status', methods=['PUT'])
def update_alert_status(alert_id):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        alert = Alert.query.get(alert_id)
        if not alert:
            return jsonify({"error": "Alert not found"}), 404
        
        # Update fields if provided
        if 'status' in data:
            alert.status = data['status']
        if 'acknowledged_by' in data:
            alert.acknowledged_by = data['acknowledged_by']
        if 'notes' in data:
            alert.notes = data['notes']
        
        db.session.commit()
        
        # Broadcast update via WebSocket
        socketio.emit('alert_updated', alert.to_dict(), namespace='/')
        
        return jsonify({
            "message": "Alert updated successfully",
            "alert": alert.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/telegram/test', methods=['GET'])
def test_telegram():
    """Test Telegram bot connection"""
    success, message = telegram_bot.send_test_message()
    
    return jsonify({
        "success": success,
        "message": message,
        "telegram_enabled": telegram_bot.enabled,
        "send_images": telegram_bot.send_images
    })

@app.route('/api/telegram/status', methods=['GET'])
def telegram_status():
    """Check Telegram bot status"""
    return jsonify({
        "enabled": telegram_bot.enabled,
        "configured": bool(telegram_bot.token and telegram_bot.chat_id),
        "send_images": telegram_bot.send_images,
        "has_token": bool(telegram_bot.token),
        "has_chat_id": bool(telegram_bot.chat_id)
    })

@app.route('/api/species', methods=['GET'])
def list_species():
    return jsonify({
        "species": ANIMAL_SPECIES,
        "count": len(ANIMAL_SPECIES),
        "telegram_enabled": telegram_bot.enabled,
        "telegram_images": telegram_bot.send_images
    })

@app.route('/api/stats', methods=['GET'])
def get_detailed_stats():
    try:
        from sqlalchemy import func
        
        species_counts = db.session.query(
            Alert.species, 
            func.count(Alert.id)
        ).group_by(Alert.species).all()
        
        category_counts = db.session.query(
            Alert.category,
            func.count(Alert.id)
        ).group_by(Alert.category).all()
        
        priority_counts = db.session.query(
            Alert.priority,
            func.count(Alert.id)
        ).group_by(Alert.priority).all()
        
        image_stats = db.session.query(
            func.count(Alert.id).filter(Alert.has_image == True),
            func.count(Alert.id).filter(Alert.has_image == False)
        ).first()
        
        twenty_four_hours_ago = datetime.now(IST) - timedelta(hours=24)
        recent_alerts = Alert.query.filter(
            Alert.timestamp >= twenty_four_hours_ago
        ).count()
        
        recent_alerts_with_images = Alert.query.filter(
            Alert.timestamp >= twenty_four_hours_ago,
            Alert.has_image == True
        ).count()
        
        by_species = {species: count for species, count in species_counts}
        by_category = {cat: count for cat, count in category_counts}
        by_priority = {pri: count for pri, count in priority_counts}
        
        most_common = max(species_counts, key=lambda x: x[1]) if species_counts else None
        
        return jsonify({
            "total_alerts": Alert.query.count(),
            "recent_24h": recent_alerts,
            "alerts_with_images": image_stats[0] if image_stats else 0,
            "alerts_without_images": image_stats[1] if image_stats else 0,
            "recent_alerts_with_images": recent_alerts_with_images,
            "by_species": by_species,
            "by_category": by_category,
            "by_priority": by_priority,
            "most_common_species": {
                "species": most_common[0] if most_common else None,
                "count": most_common[1] if most_common else 0
            },
            "telegram_enabled": telegram_bot.enabled,
            "telegram_images": telegram_bot.send_images
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== WEBSOCKET EVENT HANDLERS ==========
@socketio.on('connect', namespace='/')
def handle_connect():
    """When a WebSocket client connects"""
    print(f"✅ WebSocket client connected: {request.sid}")
    emit('connection_response', {'message': 'Connected to wildlife alert server', 'sid': request.sid})

@socketio.on('disconnect', namespace='/')
def handle_disconnect():
    """When a WebSocket client disconnects"""
    print(f"❌ WebSocket client disconnected: {request.sid}")

@socketio.on('join_dashboard', namespace='/')
def handle_join_dashboard():
    """Client wants to join dashboard updates"""
    join_room('dashboard')
    emit('joined_dashboard', {'message': 'Joined dashboard room', 'sid': request.sid})
    print(f"📊 Client joined dashboard room: {request.sid}")

@socketio.on('request_initial_alerts', namespace='/')
def handle_initial_alerts_request():
    """Send recent alerts when client requests"""
    alerts = Alert.query.order_by(Alert.timestamp.desc()).limit(20).all()
    emit('initial_alerts', {
        'alerts': [alert.to_dict() for alert in alerts],
        'count': len(alerts),
        'sid': request.sid
    })
    print(f"📨 Sent {len(alerts)} initial alerts to client: {request.sid}")

@socketio.on('update_alert_status', namespace='/')
def handle_update_alert_status(data):
    """Update alert status (e.g., mark as resolved)"""
    try:
        alert_id = data.get('alert_id')
        status = data.get('status')
        acknowledged_by = data.get('acknowledged_by')
        
        alert = Alert.query.get(alert_id)
        if alert:
            if status:
                alert.status = status
            if acknowledged_by:
                alert.acknowledged_by = acknowledged_by
            
            db.session.commit()
            
            # Broadcast the update
            socketio.emit('alert_updated', alert.to_dict(), namespace='/')
            print(f"📝 Alert #{alert_id} updated to status: {status}")
            
            emit('update_success', {'alert_id': alert_id, 'status': status})
        else:
            emit('update_error', {'error': f'Alert {alert_id} not found'})
            
    except Exception as e:
        print(f"❌ Error updating alert: {e}")
        emit('update_error', {'error': str(e)})

# ========== DATABASE INIT ==========
def init_database():
    with app.app_context():
        db.create_all()
        alert_count = Alert.query.count()
        image_count = Alert.query.filter(Alert.image_filename.isnot(None)).count()
        print("✅ Database initialized")
        print(f"📊 Total alerts in database: {alert_count}")
        print(f"📸 Alerts with images: {image_count}")

# ========== MAIN ==========
if __name__ == '__main__':
    # Initialize database
    init_database()
    
    port = int(os.getenv('PORT', 5000))
    
    print("\n" + "="*70)
    print("🚀 WILDLIFE ALERT SYSTEM v7.0 - WITH IMAGE SUPPORT")
    print("="*70)
    print(f"📁 Database: wildlife_alerts.db")
    print(f"🖼️ Image folder: {app.config['UPLOAD_FOLDER']}")
    print(f"🌐 HTTP API: http://localhost:{port}")
    print(f"🔌 WebSocket: ws://localhost:{port}/socket.io")
    print(f"🤖 Telegram: {'✅ ENABLED' if telegram_bot.enabled else '❌ DISABLED'}")
    print(f"📸 Telegram Images: {'✅ ENABLED' if telegram_bot.send_images else '❌ DISABLED'}")
    print("="*70)
    
    if telegram_bot.enabled:
        print("\n📱 Telegram Configuration:")
        print(f"   Bot Token: {'✅ Set' if telegram_bot.token else '❌ Missing'}")
        print(f"   Chat ID: {'✅ Set' if telegram_bot.chat_id else '❌ Missing'}")
        print(f"   Send Images: {'✅ Yes' if telegram_bot.send_images else '❌ No'}")
        print(f"   Test URL: http://localhost:{port}/api/telegram/test")
    
    print("\n📚 Test Endpoints:")
    print(f"  GET  http://localhost:{port}/health")
    print(f"  GET  http://localhost:{port}/api/telegram/status")
    print(f"  POST http://localhost:{port}/api/alert")
    print(f"  GET  http://localhost:{port}/api/alerts?has_image=true")
    print("\n💡 Test WebSocket:")
    print("  1. Open React dashboard at http://localhost:5173")
    print("  2. Send alert with image via Postman")
    print("  3. Alert with image should appear instantly")
    print("="*70 + "\n")
    
    # Start server with SocketIO support
    socketio.run(app, debug=True, port=port, host='0.0.0.0')