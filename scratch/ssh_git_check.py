import paramiko

hostname = "171.22.174.199"
username = "osaf"
password = "fastapi135"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(hostname, username=username, password=password, timeout=10)

    commands = [
        "cd /home/osaf/Ergon-project && git status",
        "cd /home/osaf/Ergon-project && git remote -v",
        "cd /home/osaf/Ergon-project && git log -n 3 --oneline"
    ]

    for cmd in commands:
        print(f"\n--- Running: {cmd} ---")
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode("utf-8", errors="ignore")
        err = stderr.read().decode("utf-8", errors="ignore")
        if out:
            print("STDOUT:\n", out)
        if err:
            print("STDERR:\n", err)

finally:
    client.close()
