# Cursor Testing Instructions

## Testing Collaborative Cursors

### Setup
1. Open the application in two browser windows/tabs: http://localhost:3002/plate
2. Place the windows side by side so you can see both

### Test Steps
1. **Initial Load**: Both browsers should connect and show "synced" status
2. **Type in Browser 1**: Start typing in the first browser window
3. **Check Browser 2**: You should see the text appear in real-time
4. **Move cursor in Browser 1**: Click to different positions in the text
5. **Check Browser 2**: You should see a colored cursor with username appear
6. **Type in Browser 2**: Start typing in the second browser
7. **Check Browser 1**: You should see the second user's cursor and text

### What to Look For
- **Console Logs**: Check browser console for debugging information
- **Cursor Appearance**: Colored cursor with username label
- **Real-time Updates**: Text changes appear immediately in both browsers
- **No Errors**: No console errors or warnings

### Fixed Issues
- ✅ Removed conflicting awareness state setting in SupabaseProvider
- ✅ Let YjsPlugin handle cursor data exclusively
- ✅ Ensured consistent color generation
- ✅ Fixed TypeScript compilation errors

### Debugging Info
The application now logs:
- 🎯 Remote cursor details (count, positions, data)
- 👁️ Awareness state updates every 5 seconds  
- 📍 Selection changes with cursor position
- 🔌 Connection status and user info
