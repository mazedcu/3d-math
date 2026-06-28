import paramiko

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('198.211.96.4', username='root', password='114598Tonni')
    
    stdin, stdout, stderr = ssh.exec_command('journalctl -u mathhub -n 50 --no-pager')
    print(stdout.read().decode('utf-8'))
    
    ssh.close()
except Exception as e:
    print(f"Error: {e}")
