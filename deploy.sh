ssh raspberrypi -T <<'EOL'
	cd raspberrypi && \
	git fetch && git reset --hard origin/cron && \
	sudo docker compose -f docker/compose.yml down
	sudo docker compose -f docker/compose.yml up --build -d
EOL