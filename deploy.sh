ssh raspberrypi -T <<'EOL'
	rm -rf raspberrypi
	git clone git@github.com:tweeres04/raspberrypi.git && \
	cd raspberrypi && \
	touch database.db && \
	sudo docker compose down
	sudo docker compose up --build -d
EOL