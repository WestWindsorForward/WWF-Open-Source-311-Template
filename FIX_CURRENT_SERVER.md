# Fix Your Current Server - Immediate Actions

## Step 1: Pull Latest Code

```bash
cd ~/township
git pull
```

This gets all the fixes I just made:
- ✅ Better logging for debugging
- ✅ Improved error handling
- ✅ Fixed system update button
- ✅ Better Maps API key handling
- ✅ One-command setup script

## Step 2: Restart with New Code

```bash
cd ~/township/infrastructure
docker compose down
docker compose up -d --build
```

Wait 30 seconds for everything to start.

## Step 3: Watch Logs to See What's Happening

Open **two terminal windows** on your server:

### Terminal 1: Watch backend logs
```bash
cd ~/township/infrastructure
docker compose logs backend -f
```

Keep this running. You'll see:
- "Updating branding: ..." when you save branding
- "Updating runtime config: ..." when you save config
- "Branding saved successfully" when it works
- Any errors that occur

### Terminal 2: Check database
```bash
cd ~/township/infrastructure
docker compose exec -T db psql -U postgres -d township -c "SELECT key, value FROM township_settings;"
```

This shows what's actually in the database.

## Step 4: Test Saving from Admin Portal

1. Go to your admin portal in browser
2. Try saving something (like branding or runtime config)
3. **Watch Terminal 1** - you should see log messages
4. **Re-run the database command in Terminal 2** - data should appear

If you see errors in the logs, copy and paste them to me.

## Step 5: Start the Update Watcher (For System Updates Button)

```bash
cd ~/township
nohup ./scripts/watch_updates.sh > update-watcher.log 2>&1 &
echo $! > update-watcher.pid
```

This starts the watcher that listens for update requests from the Admin Portal.

**To check if it's running:**
```bash
tail -f ~/township/update-watcher.log
```

## Step 6: Test System Update Button

1. Go to Admin Console → System Maintenance
2. Click "Update Now"
3. **Watch the update watcher log:**
   ```bash
   tail -f ~/township/update-watcher.log
   ```
   
You should see:
- "Update requested at..."
- "Pulling latest code..."
- "Rebuilding services..."
- "Update completed at..."

## Debugging: If Config Still Not Saving

Run this to see exactly what's happening:

```bash
# Enable debug logging
cd ~/township/infrastructure
docker compose down
docker compose up -d

# Watch ALL output
docker compose logs -f | grep -i "branding\|runtime\|config\|error"
```

Then try saving from the UI and watch the output.

## Debugging: If Update Button Not Working

Check if the flag file is being created:

```bash
# In Terminal 1: Watch backend
docker compose logs backend -f | grep -i update

# In Terminal 2: Watch for flag file
watch -n 1 "ls -la ~/township/flags/"

# Click "Update Now" in admin portal
# You should see update_requested file appear
```

## Quick Database Fix (If Needed)

If you want to manually set config while debugging:

```bash
cd ~/township/infrastructure

# Set Google Maps API key
docker compose exec -T db psql -U postgres -d township <<'EOF'
INSERT INTO township_settings (key, value, created_at, updated_at)
VALUES (
  'runtime_config',
  '{"google_maps_api_key": "YOUR_KEY_HERE"}',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
EOF

# Restart backend
docker compose restart backend
```

## Expected Behavior After Fixes

### When you save Runtime Config:
- Backend logs show: "Updating runtime config: {…}"
- Backend logs show: "Runtime config saved successfully: {…}"
- Database query shows the new value
- Frontend shows success message
- Changes visible immediately

### When you save Branding:
- Backend logs show: "Updating branding: {…}"
- Backend logs show: "Branding saved successfully: {…}"
- Logo uploads complete
- Portal preview updates
- Changes visible on resident portal

### When you click Update Now:
- Backend logs show: "System update triggered by admin@…"
- Backend logs show: "Creating flag file at: /app/flags/update_requested"
- Backend logs show: "Flag file created successfully"
- Update watcher log shows: "Update requested at…"
- System updates automatically

## What Changed

I added:
1. **Logging** - You'll see exactly what's happening
2. **Better error handling** - Clear error messages
3. **Flag file verification** - System update confirms file creation
4. **Maps error handling** - Better messages when API key missing
5. **Quick setup script** - One command to set up from scratch

## Still Having Issues?

Send me:
1. Output of: `docker compose logs backend --tail=100`
2. Output of: `docker compose ps`
3. Output of: `SELECT * FROM township_settings;` query
4. Screenshots of any errors in browser console (F12 → Console tab)

I'll help you debug!
