@echo off
cd /d "%~dp0"
echo Adding all changes...
git add .
echo Committing changes...
git commit -m "feat: updated chess game and UI components"
echo Pushing to GitHub (origin/main)...
git push origin main
echo Done!
pause
