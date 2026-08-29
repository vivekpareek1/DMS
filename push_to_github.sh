#!/bin/bash
read -p "GitHub URL: " REPO
git init; git add .; git commit -m "complete dms"; git branch -M main; git remote add origin $REPO; git push -u origin main
