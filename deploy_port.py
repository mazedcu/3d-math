import paramiko

def run_cmd(ssh, cmd):
    print(f"--- Running: {cmd} ---")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    if out: print(out.strip())
    if err: print(f"ERROR: {err.strip()}")
    print("")

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('198.211.96.4', username='root', password='114598Tonni')
    
    # Create Nginx config string
    nginx_conf = """
server {
    listen 8080;
    server_name _;
    root /var/www/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
}
"""
    # Write config to droplet
    cmd = f"cat << 'EOF' > /etc/nginx/sites-available/3d-math{nginx_conf}\nEOF"
    run_cmd(ssh, cmd)
    
    # Enable site
    run_cmd(ssh, 'ln -sf /etc/nginx/sites-available/3d-math /etc/nginx/sites-enabled/')
    
    # Open port 8080 on firewall
    run_cmd(ssh, 'ufw allow 8080/tcp')
    
    # Restart Nginx
    run_cmd(ssh, 'systemctl restart nginx')
    
    ssh.close()
    print("Port 8080 setup complete!")
except Exception as e:
    print(f"Failed: {e}")
