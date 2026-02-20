# How to Approve All Pending Products

## Quick Method (Using Admin Dashboard)

1. **Start your backend server** (if not already running):
   ```bash
   cd backend
   npm run dev
   ```

2. **Open Admin Dashboard** in your browser:
   - Go to: `http://localhost:3000/admin-dashboard`
   - Or click the "Approve Products" button in the header

3. **Navigate to Products Tab**:
   - Click the orange "Approve Products (X)" button in the header
   - OR manually change URL to: `http://localhost:3000/admin-dashboard?tab=products`

4. **Approve All Products**:
   - Click the green "Approve All Pending" button
   - Confirm the action
   - Wait for success message

5. **Refresh Supplier Portal**:
   - Go back to supplier portal
   - Refresh the page (F5)
   - All products should now show as "Approved"

## Alternative: Using Browser Console

If the button doesn't work, you can approve products directly from the browser console:

1. Open Admin Dashboard
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Paste and run this code:

```javascript
(async () => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/admin/products/approve-all', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  console.log(data);
  if (data.status === 'success') {
    alert(`Approved ${data.approvedCount} products!`);
    location.reload();
  } else {
    alert('Error: ' + data.message);
  }
})();
```

## Alternative: Using cURL (if server is running)

```bash
# First, get your admin token from browser localStorage
# Then run:
curl -X POST http://localhost:5000/api/admin/products/approve-all \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

Replace `YOUR_TOKEN_HERE` with the token from browser localStorage.
