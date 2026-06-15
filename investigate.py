import paramiko
import sys

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
    
    run_cmd(ssh, 'ls -la /var/www/')
    run_cmd(ssh, 'ls -la /etc/nginx/sites-available/')
    run_cmd(ssh, 'cat /etc/nginx/sites-available/default')
    run_cmd(ssh, 'tail -n 50 /root/.bash_history')
    
    ssh.close()
except Exception as e:
    print(f"Failed: {e}")
