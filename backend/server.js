// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const SECRET_KEY = "my_super_secret_key_change_this_later"; 

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/ecommerce_db')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// --- SCHEMAS ---
const Product = mongoose.model('Product', new mongoose.Schema({
    name: String, 
    price: Number, 
    description: String, 
    imageUrl: String, 
    category: String,
    stock: { type: Number, default: 10 },
    rating: { type: Number, default: 0 }, // NEW: Saved specifically so we can sort by it!
    specs: { type: Array, default: [] } 
}));

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    wishlist: { type: Array, default: [] } // NEW: A secure place to store their favorites!
}));

// NEW: Order Schema
const Order = mongoose.model('Order', new mongoose.Schema({
    username: String,
    items: Array,
    total: Number,
    address: String, // NEW: Where are we shipping this?
    date: Date
}));

// --- THE BOUNCER (Middleware) ---
// This function checks if the user has a valid wristband before letting them order
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Grab the token from the header

    if (!token) return res.status(401).json({ message: "Access Denied. Please log in first!" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid or expired session. Please log in again." });
        req.user = user; // Attach the user's info to the request
        next(); // Let them through!
    });
}

// --- API ROUTES ---

// 1. Fetch Products
app.get('/api/products', async (req, res) => {
    try { res.json(await Product.find()); } 
    catch (err) { res.status(500).json({ message: "Error fetching products" }); }
});

// 2. Register (Upgraded for Auto-Login & Password Security)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // --- NEW: BACKEND PASSWORD VALIDATION ---
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters long." });
        }
        
        const hasLetters = /[a-zA-Z]/.test(password);
        const hasNumbers = /[0-9]/.test(password);
        
        if (!hasLetters || !hasNumbers) {
            return res.status(400).json({ message: "Password must contain both letters and numbers." });
        }
        // ----------------------------------------
        
        // Check if username is taken
        if (await User.findOne({ username })) return res.status(400).json({ message: "Username taken!" });
        
        // Scramble the password and save the new user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();

        // Generate the digital wristband (Token) immediately!
        const token = jwt.sign({ userId: newUser._id, username: newUser.username }, SECRET_KEY, { expiresIn: '1h' });

        // Send back the success message AND the token/username
        res.status(201).json({ 
            message: "Account created securely! You are now logged in.", 
            token: token, 
            username: newUser.username 
        });
    } catch (error) { 
        res.status(500).json({ message: "Error registering user" }); 
    }
});

// 3. Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "Invalid username or password!" });
        }
        
        const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ message: "Login successful!", token, username: user.username });
    } catch (error) { res.status(500).json({ message: "Error logging in" }); }
});

// 4. Place an Order (Now with Shipping Address!)
app.post('/api/orders', authenticateToken, async (req, res) => {
    try {
        // NEW: Pull the address from the incoming request
        const { items, total, address } = req.body; 

        const requestedQuantities = {};
        for (let item of items) {
            requestedQuantities[item._id] = (requestedQuantities[item._id] || 0) + 1;
        }

        for (let itemId in requestedQuantities) {
            const dbProduct = await Product.findById(itemId);
            if (dbProduct.stock < requestedQuantities[itemId]) {
                return res.status(400).json({ 
                    message: `Checkout failed! We only have ${dbProduct.stock} left of ${dbProduct.name}. Someone just bought it!` 
                });
            }
        }

        // NEW: Save the address into the database receipt!
        const newOrder = new Order({
            username: req.user.username,
            items: items,
            total: total,
            address: address, 
            date: new Date()
        });
        await newOrder.save();

        for (let item of items) {
            await Product.findByIdAndUpdate(item._id, { $inc: { stock: -1 } });
        }

        res.status(201).json({ message: "Order placed successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error placing order" });
    }
});

// 5. NEW: Get User's Order History
app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        // Search the database for orders matching the logged-in user's name
        // The .sort({ date: -1 }) ensures the newest orders show up at the top!
        const userOrders = await Order.find({ username: req.user.username }).sort({ date: -1 });
        
        res.json(userOrders);
    } catch (error) {
        res.status(500).json({ message: "Error fetching order history" });
    }
});

// --- TARGETED LIVE API SEED ROUTE ---
app.post('/api/seed', async (req, res) => {
    try {
        await Product.deleteMany({}); // Wipe the old database

        console.log("Fetching premium tech data from DummyJSON...");
        
        // 1. Define the specific tech categories we want
        const targetCategories = ['laptops', 'smartphones', 'tablets', 'mobile-accessories'];
        
        // 2. Fetch them all at the exact same time to be fast
        const fetchPromises = targetCategories.map(category => 
            fetch(`https://dummyjson.com/products/category/${category}`).then(res => res.json())
        );
        const results = await Promise.all(fetchPromises);
        
        // 3. Combine all the separate category lists into one massive list
        const externalProducts = results.flatMap(data => data.products);

        // 4. Translate data and generate Smart Specs!
        const mappedProducts = externalProducts.map(item => {
            const categoryName = item.category === 'mobile-accessories' ? 'Accessories' : 
                                 item.category.charAt(0).toUpperCase() + item.category.slice(1);
            
            const numericRating = item.rating || 4.5;
            const itemNameLower = item.title.toLowerCase();
            
            // --- SMART SPEC ENGINE ---
            let specificSpecs = [];
            
            if (categoryName === 'Laptops') {
                specificSpecs = [
                    'Processor: Next-Gen Silicon Architecture', 
                    'RAM: 16GB Unified High-Bandwidth Memory', 
                    'Battery Capacity: 70Wh Lithium-Polymer (Up to 18 hrs)'
                ];
            } else if (categoryName === 'Smartphones' || categoryName === 'Tablets') {
                specificSpecs = [
                    'Display: 120Hz ProMotion OLED', 
                    'Camera: 48MP Main / 12MP Ultrawide System', 
                    'Battery Capacity: 4500mAh with 65W Fast Charge'
                ];
            } else if (itemNameLower.includes('headphone') || itemNameLower.includes('earbud') || itemNameLower.includes('speaker') || itemNameLower.includes('audio')) {
                // Audio specific!
                specificSpecs = [
                    'Frequency Response: 20Hz - 20kHz', 
                    'Speaker Maximum Output Power: 15W RMS', 
                    'Audio Tech: Active Noise Cancellation (ANC)'
                ];
            } else {
                // General accessories
                specificSpecs = [
                    'Connectivity: Ultra-Low Latency Bluetooth 5.3', 
                    'Material: Premium Grade Aerospace Aluminum', 
                    'Compatibility: Universal USB-C'
                ];
            }

            return {
                name: item.title,          
                price: item.price,
                description: item.description,
                imageUrl: item.thumbnail,  
                category: categoryName,
                stock: Math.floor(Math.random() * 10) + 5,
                rating: numericRating, // Save the number to the database
                
                specs: [
                    `Brand: ${item.brand || 'Premium Tech'}`,
                    `Rating: <i class="fa-solid fa-star" style="color: #fbbf24;"></i> ${numericRating} / 5.0`, // Upgraded Icon!
                    `Warranty: 1-Year Comprehensive Guarantee`,
                    ...specificSpecs // Inject the dynamic specs here!
                ]
            };
        });

        // 5. Save the translated list into our database
        await Product.insertMany(mappedProducts);
        
        res.json({ 
            message: `Successfully fetched and saved ${mappedProducts.length} live tech products!`
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching from live API" });
    }
});

// 6. NEW: Toggle Wishlist Items
app.post('/api/wishlist', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username });
        const product = req.body.product;

        // Check if the item is already in their wishlist
        const existsIndex = user.wishlist.findIndex(item => item.name === product.name);
        
        if (existsIndex >= 0) {
            user.wishlist.splice(existsIndex, 1); // If it's there, remove it
            res.json({ message: "Removed from wishlist!" });
        } else {
            user.wishlist.push(product); // If it's not there, add it!
            res.json({ message: "Added to wishlist! ❤️" });
        }
        
        await user.save(); // Save the changes to the database
    } catch (error) {
        res.status(500).json({ message: "Error updating wishlist" });
    }
});

// 7. NEW: Get User's Wishlist
app.get('/api/wishlist', authenticateToken, async (req, res) => {
    try {
        // Find the user in the database
        const user = await User.findOne({ username: req.user.username });
        
        // Send back their saved array!
        res.json(user.wishlist);
    } catch (error) {
        res.status(500).json({ message: "Error fetching wishlist" });
    }
});

// --- NEW: LIVE INVENTORY SIMULATOR ---
// Every 7 seconds, a fake external customer buys a random product from your store!
setInterval(async () => {
    try {
        // Find all items that still have a stock greater than 0
        const availableProducts = await Product.find({ stock: { $gt: 0 } });
        
        if (availableProducts.length > 0) {
            // Pick a random product from that list
            const randomProduct = availableProducts[Math.floor(Math.random() * availableProducts.length)];
            
            // Decrease its stock by 1
            randomProduct.stock -= 1;
            await randomProduct.save();
            
            console.log(`[SIMULATION] External user bought 1 unit of: ${randomProduct.name}. Remaining stock: ${randomProduct.stock}`);
        }
    } catch (error) {
        console.error("Simulation engine failed to sync stock:", error);
    }
}, 7000);

app.listen(PORT, () => console.log(`🚀 Server is running on http://localhost:${PORT}`));