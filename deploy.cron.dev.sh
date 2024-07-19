echo '20000' > in_temp_input_dev && \
docker compose -f docker/compose.cron.dev.yml down
docker compose -f docker/compose.cron.dev.yml up --build