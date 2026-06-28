import paramiko
import time
import os

def run_cmd(ssh, cmd):
    print(f"Executing: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    status = stdout.channel.recv_exit_status()
    
    # Safe print for Windows console
    if out: 
        safe_out = out.encode('ascii', errors='replace').decode('ascii')
        print(safe_out.strip())
    if err: 
        safe_err = err.encode('ascii', errors='replace').decode('ascii')
        print(f"ERROR: {safe_err.strip()}")
    return status

nginx_config = """
server {
    listen 80;
    listen 8080;
    server_name numberfield.xyz www.numberfield.xyz;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /play {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
"""

systemd_service = """
[Unit]
Description=Numberfield Gunicorn Daemon
After=network.target

[Service]
User=root
Group=www-data
WorkingDirectory=/var/www/html
# Secrets (SMTP_USER, SMTP_PASS, etc.) live here, NOT in git. The leading
# '-' means deploy still works even if the file does not exist yet.
EnvironmentFile=-/etc/numberfield.env
ExecStart=/var/www/html/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5000 app:app

[Install]
WantedBy=multi-user.target
"""

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("Connecting to 198.211.96.4...")
    ssh.connect('198.211.96.4', username='root', password='114598Tonni')
    print("Connected successfully!")
    
    print("\n--- Installing Dependencies ---")
    run_cmd(ssh, 'apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx python3-pip python3-venv git certbot python3-certbot-nginx')
    
    print("\n--- Deploying Numberfield ---")
    run_cmd(ssh, "systemctl stop mathhub || true")
    run_cmd(ssh, "cp /var/www/html/database.db /tmp/database_backup.db || true")
    run_cmd(ssh, 'rm -rf /var/www/html')
    run_cmd(ssh, 'git clone https://github.com/mazedcu/3d-math.git /var/www/html')
    run_cmd(ssh, 'cp /tmp/database_backup.db /var/www/html/database.db || true')
    run_cmd(ssh, 'cd /var/www/html && python3 migrate_db.py || true')
    
    print("\n--- Setting up Python Virtual Environment ---")
    run_cmd(ssh, 'cd /var/www/html && python3 -m venv venv')
    run_cmd(ssh, 'cd /var/www/html && ./venv/bin/pip install Flask Flask-SQLAlchemy Flask-Cors gunicorn')
    
    print("\n--- Configuring Nginx ---")
    run_cmd(ssh, f"cat << 'EOF' > /etc/nginx/sites-available/3d-math\n{nginx_config}EOF")
    run_cmd(ssh, 'ln -sf /etc/nginx/sites-available/3d-math /etc/nginx/sites-enabled/')
    run_cmd(ssh, 'rm -f /etc/nginx/sites-enabled/default')
    run_cmd(ssh, 'systemctl restart nginx')
    
    print("\n--- Setting up SSL/TLS ---")
    run_cmd(ssh, 'certbot --nginx -d numberfield.xyz -d www.numberfield.xyz --non-interactive --agree-tos -m mazedcu@gmail.com --redirect || true')

    print("\n--- Configuring Systemd Service ---")
    run_cmd(ssh, f"cat << 'EOF' > /etc/systemd/system/mathhub.service\n{systemd_service}EOF")
    run_cmd(ssh, 'systemctl daemon-reload')
    run_cmd(ssh, 'systemctl enable mathhub')
    run_cmd(ssh, 'systemctl restart mathhub')
    
    print("\n--- Configuring Firewall ---")
    run_cmd(ssh, 'ufw allow "Nginx Full"')
    run_cmd(ssh, 'ufw allow 8080/tcp')
    
    ssh.close()
    print("\nDeployment complete! Numberfield backend is now running.")
except Exception as e:
    print(f"Failed to deploy: {e}")
