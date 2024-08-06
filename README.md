# tweeres04/raspberrypi

This is a little project that helped me learn how to use rasperry pis, arduinos, and temperature sensors.

## Raspberry pi

The code in this repo. 

- A small Remix web server for displaying the temperature history and trends
  - Includes a tiny `/temperatures` API endpoint for logging temperature readings from arduinos
- A tiny cron job that logs the current temperatures on the sensors connected to the raspberry pi every 5 mins
- Data is stored in an sqlite database

## Arduino

Code not in this repo yet.

- I placed a few arduinos with temperature sensors in different rooms around my house
- They're loaded with a small program that sends its temperature readings through an API endpoint `/temperatures` on the raspberry pi
  - The temperatures are logged every 5 minutes, just like the raspberry pi temps
  - The temperatures include a `source` property so I know which room the temperature is coming from
