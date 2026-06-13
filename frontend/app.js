const productContainer = document.getElementById('product-container');

let globalProducts = []; // Stores all products downloaded from the database
let cart = []; // Our shopping cart memory!

// --- TOAST NOTIFICATION ENGINE ---
// --- TOAST NOTIFICATION ENGINE ---
function showNotification(message, type = 'success') {
    const container = document.getElementById('toast-container');
    
    // Create the physical notification box
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type === 'success' ? 'toast-success' : 'toast-error'}`;
    
    // 1. Pick the Font Awesome icon
    const icon = type === 'success' 
        ? '<i class="fa-solid fa-circle-check" style="color: var(--success-color); font-size: 18px;"></i>' 
        : '<i class="fa-solid fa-triangle-exclamation" style="color: var(--danger-color); font-size: 18px;"></i>';
    
    // 2. THE CRITICAL LINE: Put the icon and message inside the box
    toast.innerHTML = `<span style="display: flex; align-items: center;">${icon}</span> <span>${message}</span>`;
    
    // Put it on the screen
    container.appendChild(toast);
    
    // Trigger the CSS slide-in animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Make it automatically disappear after 3.5 seconds
    setTimeout(() => {
        toast.classList.remove('show'); 
        setTimeout(() => toast.remove(), 300); 
    }, 3500);
}
// 1. Fetch products
async function fetchProducts() {
    try {
        const response = await fetch('http://localhost:3000/api/products');
        globalProducts = await response.json(); // Save them globally
        
        displayProducts(globalProducts);
    } catch (error) {
        console.error("Error fetching data:", error);
        productContainer.innerHTML = "<p>Failed to load products. Is the server running?</p>";
    }
}

// 2. Display products
function displayProducts(products) {
    productContainer.innerHTML = ''; 
    
    products.forEach(product => {
        // Determine if item is sold out
        const isSoldOut = product.stock <= 0;
        
        const card = document.createElement('div');
        card.className = 'product-card';
        // If it's sold out, let's slightly fade the card visually
        if (isSoldOut) card.style.opacity = '0.6';
        
        card.innerHTML = `
            <div class="img-wrapper" style="position: relative; cursor: pointer;" onclick="openProductModal('${product._id}')" title="Click to view details">
                <button onclick="toggleWishlist('${product._id}')" style="position: absolute; top: 10px; right: 10px; background: white; color: var(--text-muted); border: none; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; box-shadow: var(--shadow-sm); font-size: 16px; display: flex; align-items: center; justify-content: center; transition: var(--transition-smooth);">
                    <i class="fa-regular fa-heart"></i>
                </button>
                <img src="${product.imageUrl}" alt="${product.name}">
            </div>
            
            <span style="font-size: 11px; font-weight: 700; color: var(--accent-color); text-transform: uppercase; letter-spacing: 1px;">
                ${product.category}
            </span>
            
            <h3 style="margin-top: 5px;">${product.name}</h3>
            <p>${product.description}</p>
            
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 15px; color: ${isSoldOut ? 'var(--danger-color)' : 'var(--text-muted)'};">
                ${isSoldOut ? '<i class="fa-solid fa-triangle-exclamation"></i> SOLD OUT' : `<i class="fa-solid fa-boxes-stacked"></i> Only ${product.stock} left in stock`}
            </div>

            <div class="card-footer">
                <span class="price-tag">$${product.price.toFixed(2)}</span>
                
                <button class="btn-ui btn-primary" 
                        onclick="${isSoldOut ? '' : `addToCart('${product._id}')`}" 
                        style="${isSoldOut ? 'background: var(--text-muted); cursor: not-allowed;' : ''}"
                        ${isSoldOut ? 'disabled' : ''}>
                    ${isSoldOut ? 'Out of Stock' : 'Add to Cart'}
                </button>
            </div>
        `;
        productContainer.appendChild(card);
    });
}

// --- NEW CATEGORY FILTERING LOGIC ---

// --- NEW: UNIFIED SEARCH & CATEGORY FILTERING ---

let currentCategory = 'All'; // Remembers the active category
let searchQuery = '';        // Remembers what is typed in the search bar

// 1. When a user clicks a Category Pill
function setCategory(category) {
    currentCategory = category;
    
    // Update the visual highlights on the buttons
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText === category) btn.classList.add('active');
    });

    applyFilters(); // Run the unified filter!
}

// 2. When a user types in the Search Bar
document.getElementById('search-bar').addEventListener('input', (event) => {
    // Grab what they typed and make it lowercase so "SONY" matches "sony"
    searchQuery = event.target.value.toLowerCase(); 
    
    applyFilters(); // Run the unified filter!
});

// 3. The Unified Filter (Looks at both Category AND Search)
// --- UPGRADED SEARCH, FILTER, AND SORT LOGIC ---
function applyFilters() {
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    const sortValue = document.getElementById('sort-select').value;
    
    // 1. Filter by Category and Search Text
    let filteredProducts = globalProducts.filter(product => {
        const matchesCategory = currentCategory === 'All' || product.category === currentCategory;
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) || product.description.toLowerCase().includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    // 2. Apply the active Sorting method!
    if (sortValue === 'price-asc') {
        filteredProducts.sort((a, b) => a.price - b.price);
    } else if (sortValue === 'price-desc') {
        filteredProducts.sort((a, b) => b.price - a.price);
    } else if (sortValue === 'rating-desc') {
        filteredProducts.sort((a, b) => b.rating - a.rating); // Highest rated first
    } else if (sortValue === 'rating-asc') {
        filteredProducts.sort((a, b) => a.rating - b.rating); // Lowest rated first
    }

    // 3. Draw the newly sorted and filtered list
    displayProducts(filteredProducts);
}

// 3. Add item to cart
// --- UPGRADED ADD TO CART LOGIC ---
function addToCart(productId) {
    const product = globalProducts.find(p => p._id === productId);

    // 1. Count how many of this exact item the user already put in their cart
    const amountAlreadyInCart = cart.filter(item => item._id === productId).length;

    // 2. If their cart has the max amount, block the action and warn them!
    if (amountAlreadyInCart >= product.stock) {
        return showNotification(`Limit reached! Only ${product.stock} of ${product.name} left in stock.`, "error");
    }

    // 3. Otherwise, let them add it
    cart.push(product);
    updateCartUI();
    showNotification("Added to cart!", "success");
}

// 4. Remove item from cart
function removeFromCart(index) {
    cart.splice(index, 1); // Remove 1 item at the specific index position
    updateCartUI(); // Refresh the screen
}

// 5. Update the Cart visuals (numbers and lists)
function updateCartUI() {
    document.getElementById('cart-count').innerText = cart.length;
    const cartItemsList = document.getElementById('cart-items');
    cartItemsList.innerHTML = ''; 
    
    let total = 0;
    cart.forEach((item, index) => {
        total += item.price;
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <h4>${item.name}</h4>
                <span>$${item.price.toFixed(2)}</span>
            </div>
            <button class="remove-btn" onclick="removeFromCart(${index})">Remove</button>
        `;
        cartItemsList.appendChild(li);
    });
    document.getElementById('cart-total').innerText = total.toFixed(2);
    // Save a text version of the cart array to the browser's memory
    localStorage.setItem('savedCart', JSON.stringify(cart));
}

// 6. Show/Hide the Cart Window
function toggleCart() {
    const modal = document.getElementById('cart-modal');
    modal.classList.toggle('open'); // Toggles the offscreen class sliding it in smoothly!
}

// 7. Checkout Placeholder
async function checkout() {
    const token = localStorage.getItem('token');
    
    // NEW: Grab the shipping address
    const address = document.getElementById('checkout-address').value.trim();

    // The checks!
    if (cart.length === 0) return showNotification("Your cart is empty!", "error");
    if (!token) return showNotification("Please log in to place an order!", "error");
    
    // NEW: Make sure they actually typed an address
    if (!address) return showNotification("Please enter a shipping address!", "error");

    const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

    try {
        const response = await fetch('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            // NEW: Add the address to the data we are sending to the Bouncer!
            body: JSON.stringify({ items: cart, total: cartTotal, address: address })
        });

        const data = await response.json();

        // ... the rest of your checkout code stays exactly the same!
        if (response.ok) {
            showNotification(data.message, "success"); 
            cart = []; 
            localStorage.removeItem('savedCart'); 
            
            // NEW: Clear the address box for the next time they shop
            document.getElementById('checkout-address').value = ''; 
            
            updateCartUI(); 
            toggleCart(); 
        } else {
            showNotification(data.message, "error");
            
            // NEW: Auto-kick if the token is expired!
            if (response.status === 401 || response.status === 403) {
                setTimeout(logout, 2000); // Wait 2 seconds, then refresh
            }
        }
    } catch (error) {
        console.error("Checkout error:", error);
    }
}

// Run when the page loads
fetchProducts();

// 1. Remember what the user is trying to do (default is login)
let currentMode = 'login'; 

// 2. The function to show the popup box
function toggleAuthModal(mode) {
    currentMode = mode; // Save whether they clicked 'login' or 'register'
    
    // Make the hidden box visible
    document.getElementById('auth-modal').style.display = 'block';
    
    // Change the title at the top of the box to match
    document.getElementById('auth-title').innerText = mode === 'login' ? 'Login' : 'Register';
    
    // Clear out the text boxes so they are empty and ready to type in
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-password').value = '';
}

// Listen for when they click the Submit button inside the popup
// Listen for the submit button click
document.getElementById('auth-submit-btn').addEventListener('click', async () => {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;

    if (!username || !password) return showNotification("Please fill in both fields!", "error");

    // --- NEW: FRONTEND PASSWORD VALIDATION ---
    if (currentMode === 'register') {
        // 1. Check length
        if (password.length < 8) {
            return showNotification("Security check failed: Password must be at least 8 characters long.", "error");
        }
        
        // 2. Check for letters and numbers using our "scanners"
        const hasLetters = /[a-zA-Z]/.test(password);
        const hasNumbers = /[0-9]/.test(password);
        
        if (!hasLetters || !hasNumbers) {
            return showNotification("Security check failed: Password must contain both letters and numbers.", "error");
        }
    }
    // -----------------------------------------

    // Tell the backend whether we want to hit the /login route or the /register route
    const endpoint = currentMode === 'login' ? 'http://localhost:3000/api/login' : 'http://localhost:3000/api/register';

    try {
        // Send the data to the backend
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        // If the backend says "Success!"
        if (response.ok) {
            showNotification(data.message, "success");
            document.getElementById('auth-modal').style.display = 'none';

            // NEW: Because both routes now return a token, we don't need to check 
            // if currentMode === 'login'. We just save the token no matter what!
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            
            // Instantly update the header to show their name!
            updateHeaderForLoggedInUser(); 
            
        } else {
            showNotification(data.message, "error");
        }
    } catch (error) {
        console.error("Auth error:", error);
    }
});

// Updated: Make the username a clickable button to open the dashboard!
function updateHeaderForLoggedInUser() {
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
        document.getElementById('user-status').innerHTML = `
            <button class="btn-ui" onclick="openAccount()" style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-user"></i> ${savedUsername}
            </button>
        `;
    }
}

// How to logout: Just throw the wristband in the trash!
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    location.reload(); // Refresh the page to reset everything to normal
}

// Run this check immediately when the webpage first loads
updateHeaderForLoggedInUser();

// --- NEW: LIGHT/DARK MODE LOGIC ---

function toggleTheme() {
    const htmlElement = document.documentElement; // Grabs the <html> tag
    const themeBtn = document.getElementById('theme-toggle-btn');
    
    // Check what the current theme is
    const currentTheme = htmlElement.getAttribute('data-theme');
    
    if (currentTheme === 'dark') {
        // Switch to Light
        // Inside toggleTheme():
        htmlElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light'); 
        themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>'; // Upgraded!
    } else {
        htmlElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark'); 
        themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>'; // Upgraded!
    }
}

// When the page first loads, check if they previously chose dark mode!
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    // Inside initializeTheme():
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('theme-toggle-btn').innerHTML = '<i class="fa-solid fa-sun"></i>'; // Upgraded!
    }
}

// Run the check immediately
initializeTheme();

// --- NEW: ACCOUNT DASHBOARD LOGIC ---

async function openAccount() {
    document.getElementById('account-modal').style.display = 'block';
    const token = localStorage.getItem('token');
    
    try {
        // Fetch BOTH Orders and Wishlist from the backend at the same time
        const [ordersResponse, wishlistResponse] = await Promise.all([
            fetch('http://localhost:3000/api/orders', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('http://localhost:3000/api/wishlist', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        // NEW: Check if the token expired before trying to draw the dashboard
        if (ordersResponse.status === 401 || ordersResponse.status === 403) {
            document.getElementById('account-modal').style.display = 'none'; // Hide the dashboard
            showNotification("Session expired. Please log in again.", "error");
            return setTimeout(logout, 2000); // Wait 2 seconds, then refresh
        }

        const orders = await ordersResponse.json();
        const wishlist = await wishlistResponse.json();
        
        // --- 1. RENDER ORDERS ---
        const orderList = document.getElementById('order-history-list');
        if (orders.length === 0) {
            orderList.innerHTML = '<p style="color: var(--text-muted);">You have no past orders yet.</p>';
        } else {
            orderList.innerHTML = orders.map(order => `
                <div style="border: 1px solid #64748b; border-radius: var(--radius-sm); padding: 15px; margin-bottom: 15px; background: var(--bg-primary);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong>Order Placed:</strong> 
                        <span style="color: var(--text-muted);">${new Date(order.date).toLocaleDateString()}</span>
                    </div>
                    <div style="margin-bottom: 15px;">
                        ${order.items.map(item => `
                            <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 4px;">
                                • ${item.name} <span style="float: right;">$${item.price.toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div style="text-align: right; font-weight: 700; border-top: 1px solid #64748b; padding-top: 10px;">
                        Total: $${order.total.toFixed(2)}
                    </div>
                </div>
            `).join('');
        }

        // --- 2. RENDER WISHLIST ---
        const wishlistContainer = document.getElementById('wishlist-container');
        if (wishlist.length === 0) {
            wishlistContainer.innerHTML = '<p style="color: var(--text-muted);">Your wishlist is empty.</p>';
        } else {
            wishlistContainer.innerHTML = wishlist.map(item => `
                <div style="display: flex; align-items: center; justify-content: space-between; border: 1px solid #64748b; padding: 10px; margin-bottom: 10px; border-radius: var(--radius-sm); background: var(--bg-primary);">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <img src="${item.imageUrl}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: contain; background: white; border-radius: 4px; padding: 5px;">
                        <div>
                            <div style="font-weight: 600; font-size: 14px;">${item.name}</div>
                            <div style="color: var(--text-muted); font-size: 13px;">$${item.price.toFixed(2)}</div>
                        </div>
                    </div>
                    <button class="btn-ui btn-primary" onclick="addToCart('${item._id}'); showNotification('Moved to cart!', 'success');" style="padding: 6px 12px; font-size: 12px; white-space: nowrap;">
                        Add to Cart
                    </button>
                </div>
            `).join('');
        }
        
    } catch (error) {
        document.getElementById('order-history-list').innerHTML = '<p style="color: var(--danger-color);">Error loading dashboard.</p>';
        document.getElementById('wishlist-container').innerHTML = '';
    }
}

function closeAccount() {
    document.getElementById('account-modal').style.display = 'none';
}

// --- NEW: PERSISTENT CART LOGIC ---
function loadCart() {
    const saved = localStorage.getItem('savedCart');
    if (saved) {
        cart = JSON.parse(saved); // Translate it back from text into a Javascript array
        updateCartUI(); // Update the visual cart window!
    }
}

// Run this immediately when the website opens
loadCart();

// --- NEW: WISHLIST LOGIC ---
async function toggleWishlist(productId) {
    const token = localStorage.getItem('token');
    
    if (!token) {
        return showNotification("Please log in to save items to your wishlist!", "error");
    }

    // Find the exact product details from our loaded list
    const productToSave = globalProducts.find(product => product._id === productId);

    try {
        // Send it to the Bouncer!
        const response = await fetch('http://localhost:3000/api/wishlist', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ product: productToSave })
        });

        // ... (your existing fetch setup)
        
        // NEW: Check if the Bouncer rejected the token before doing anything else
        if (response.status === 401 || response.status === 403) {
            showNotification("Session expired. Please log in again.", "error");
            return setTimeout(logout, 2000); // Wait 2 seconds, then refresh
        }

        const data = await response.json();
        showNotification(data.message, "success"); 
        
    } catch (error) {
        console.error("Wishlist error:", error);
    }
}

// --- NEW: PRODUCT DETAILS MODAL LOGIC ---
function openProductModal(productId) {
    // 1. Find the exact product from our global list
    const product = globalProducts.find(p => p._id === productId);
    if (!product) return;

    // 2. Check if it is sold out
    const isSoldOut = product.stock <= 0;
    
    // 3. Draw the beautiful split-screen layout
    const modalContent = document.getElementById('product-details-content');
    modalContent.innerHTML = `
        <div style="flex: 1; min-width: 250px; background: white; padding: 20px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            <img src="${product.imageUrl}" alt="${product.name}" style="width: 100%; max-width: 300px; object-fit: contain;">
        </div>
        
        <div style="flex: 1; min-width: 250px; display: flex; flex-direction: column; gap: 15px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--accent-color); text-transform: uppercase; letter-spacing: 1px;">
                ${product.category}
            </span>
            <h2 style="margin: 0; font-size: 28px;">${product.name}</h2>
            <div style="font-size: 24px; font-weight: 700;">$${product.price.toFixed(2)}</div>

            <div style="font-size: 14px; font-weight: 600; color: ${isSoldOut ? 'var(--danger-color)' : 'var(--success-color)'};">
                ${isSoldOut ? '<i class="fa-solid fa-triangle-exclamation"></i> SOLD OUT' : `<i class="fa-solid fa-boxes-stacked"></i> ${product.stock} units available`}
            </div>

            <p style="color: var(--text-muted); line-height: 1.6; margin-bottom: 0;">
                ${product.description}
            </p>

            <div style="margin-top: 5px; border-top: 1px solid #64748b; border-bottom: 1px solid #64748b; padding: 15px 0;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px;">Specifications</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: var(--text-main);">
                    ${product.specs ? product.specs.map(spec => `<li>${spec}</li>`).join('') : '<li>No specifications available.</li>'}
                </ul>
            </div>

            <div style="margin-top: auto; display: flex; gap: 10px; padding-top: 15px;">
                <button class="btn-ui btn-primary" 
                        onclick="${isSoldOut ? '' : `addToCart('${product._id}');`}" 
                        style="flex: 1; padding: 15px; font-size: 16px; ${isSoldOut ? 'background: var(--text-muted); cursor: not-allowed;' : ''}"
                        ${isSoldOut ? 'disabled' : ''}>
                    ${isSoldOut ? 'Out of Stock' : '<i class="fa-solid fa-cart-plus"></i> Add to Cart'}
                </button>
                <button class="btn-ui" onclick="toggleWishlist('${product._id}')" style="padding: 15px; font-size: 18px;" title="Save for later">
                    <i class="fa-regular fa-heart"></i>
                </button>
            </div>
        </div>
    `;

    // 4. Show the window
    document.getElementById('product-modal').style.display = 'block';
}

function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
}

// --- LOGOUT LOGIC ---
function logout() {
    // 1. Rip up the digital wristband and username
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    
    // Note: We deliberately do NOT remove 'savedCart'. 
    // This way, when they log back in, their items are still waiting for them!
    
    // 2. Force the browser to refresh the page
    window.location.reload(); 
}

// --- NEW: INVENTORY POLLING HEARTBEAT ---
// Every 4 seconds, ask the server for the fresh inventory snapshot lists 
// and update what's displayed on screen seamlessly.
setInterval(async () => {
    try {
        const response = await fetch('http://localhost:3000/api/products');
        if (response.ok) {
            const freshProducts = await response.json();
            
            // Overwrite our global cache layout safely
            globalProducts = freshProducts;
            
            // Run our filters to update stock figures without breaking active user search filters!
            applyFilters(); 
        }
    } catch (error) {
        console.error("Heartbeat loop connection drop:", error);
    }
}, 4000);

