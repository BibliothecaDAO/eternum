# call the katana.sh script and save the process id and save logs to katana.log
./katana.sh &
echo $! > katana.pid
./katana.sh >> katana.log 2>&1 &
