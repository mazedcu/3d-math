import paramiko
import time

def run_cmd(ssh, cmd):
    print(f"Executing: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    status = stdout.channel.recv_exit_status()
    
    if out: print(out.strip())
    if err: print(f"ERROR: {err.strip()}")
    return status

nginx_config = """
server {
    listen 80;
    server_name _;

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
}
"""

systemd_service = """
[Unit]
Description=Math Hub Gunicorn Daemon
After=network.target

[Service]
User=root
Group=www-data
WorkingDirectory=/var/www/html
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
    run_cmd(ssh, 'apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx python3-pip python3-venv git')
    
    print("\n--- Deploying Math Hub ---")
    run_cmd(ssh, 'rm -rf /var/www/html/*')
    run_cmd(ssh, 'git clone https://github.com/mazedcu/3d-math.git /var/www/html/')
    
    print("\n--- Setting up Python Virtual Environment ---")
    run_cmd(ssh, 'cd /var/www/html && python3 -m venv venv')
    run_cmd(ssh, 'cd /var/www/html && ./venv/bin/pip install Flask Flask-SQLAlchemy Flask-Cors gunicorn')
    
    print("\n--- Configuring Nginx ---")
    run_cmd(ssh, f"cat << 'EOF' > /etc/nginx/sites-available/default\n{nginx_config}EOF")
    run_cmd(ssh, 'systemctl restart nginx')

    print("\n--- Configuring Systemd Service ---")
    run_cmd(ssh, f"cat << 'EOF' > /etc/systemd/system/mathhub.service\n{systemd_service}EOF")
    run_cmd(ssh, 'systemctl daemon-reload')
    run_cmd(ssh, 'systemctl enable mathhub')
    run_cmd(ssh, 'systemctl restart mathhub')
    
    print("\n--- Configuring Firewall ---")
    run_cmd(ssh, 'ufw allow "Nginx Full"')
    
    ssh.close()
    print("\nDeployment complete! Math Hub backend is now running.")
except Exception as e:
    print(f"Failed to deploy: {e}")
