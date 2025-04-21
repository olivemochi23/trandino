#!/bin/bash
sudo apt update
sudo apt install -y nodejs npm git
sudo npm install -g pm2
cd /home/$(whoami)
git clone https://github.com/yuuki/discordbot.git trandino || true
cd trandino
npm install
pm run build || true
pm2 start src/index.js --name trandino-bot || true
pm2 save 