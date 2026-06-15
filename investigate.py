import paramiko
import sys

def run_cmd(ssh, cmd):
    print(f"--- Running: {cmd} ---")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    if out: print(out.strip().encode('ascii', 'replace').decode('ascii'))
    if err: print(f"ERROR: {err.strip().encode('ascii', 'replace').decode('ascii')}")
    print("")

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('198.211.96.4', username='root', password='114598Tonni')
    
    run_cmd(ssh, 'curl -I http://127.0.0.1:5000/api/admin/transactions')
    run_cmd(ssh, 'curl -I http://198.211.96.4:8080/api/admin/transactions')
    
    ssh.close()
except Exception as e:
    print(f"Failed: {e}")
