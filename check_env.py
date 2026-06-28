import paramiko

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('198.211.96.4', username='root', password='114598Tonni')
    
    stdin, stdout, stderr = ssh.exec_command('cat /etc/numberfield.env')
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    
    if "No such file or directory" in err:
        print("The file /etc/numberfield.env does not exist on the server.")
    else:
        print("File contents (masked):")
        for line in out.splitlines():
            key = line.split('=')[0] if '=' in line else line
            print(f"{key}=***")
            
    ssh.close()
except Exception as e:
    print(f"Error: {e}")
