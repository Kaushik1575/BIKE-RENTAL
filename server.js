const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const multer = require('multer');

const app = express();

// Enable CORS for all origins (for development)
app.use(cors());

// Parse incoming JSON (for other endpoints)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Serve static files from the current directory
app.use(express.static(__dirname));

// Serve HTML files
app.get('*.html', (req, res) => {
    res.sendFile(path.join(__dirname, req.path));
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve uploads directory
app.use('/uploads', express.static('uploads'));

// File paths
const USER_DATA_FILE = 'USER_DATA.xlsx';
const UPLOADS_DIR = './uploads';

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR); // Save files to the 'uploads' directory
    },
    filename: function (req, file, cb) {
        // Create a unique file name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Helper function to hash passwords
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Initialize Excel file if it doesn't exist
function initializeExcelFile() {
    try {
        console.log('Checking Excel file...');
        if (!fs.existsSync(USER_DATA_FILE)) {
            console.log('Creating new Excel file...');
            const workbook = XLSX.utils.book_new();
            
            // Users sheet headers
            const usersHeaders = [
                'Timestamp',
                'Registration Date',
                'Registration Time',
                'Name',
                'Email',
                'User Type',
                'Status',
                'Mobile',
                'Gender',
                'Aadhar',
                'Role',
                'Password'
            ];
            const usersSheet = XLSX.utils.aoa_to_sheet([usersHeaders]);
            XLSX.utils.book_append_sheet(workbook, usersSheet, 'Users');
            
            // Admins sheet headers
            const adminsHeaders = [
                'Timestamp',
                'Registration Date',
                'Registration Time',
                'Name',
                'Email',
                'User Type',
                'Status',
                'Admin ID',
                'Role',
                'Security Code',
                'Permissions',
                'Last Access',
                'Password'
            ];
            const adminsSheet = XLSX.utils.aoa_to_sheet([adminsHeaders]);
            XLSX.utils.book_append_sheet(workbook, adminsSheet, 'Admins');

            // Inventory sheet headers
            const inventoryHeaders = [
                'vehicleId',
                'vehicleName',
                'category',
                'totalQuantity',
                'availableQuantity',
                'lastUpdated'
            ];
            const inventorySheet = XLSX.utils.aoa_to_sheet([inventoryHeaders]);
            XLSX.utils.book_append_sheet(workbook, inventorySheet, 'Inventory');

            // Bookings sheet headers
            const bookingHeaders = [
                'bookingId',
                'vehicleId',
                'userEmail',
                'bookingDate',
                'returnDate',
                'returned',
                'duration'
            ];
            const bookingsSheet = XLSX.utils.aoa_to_sheet([bookingHeaders]);
            XLSX.utils.book_append_sheet(workbook, bookingsSheet, 'Bookings');
            
            XLSX.writeFile(workbook, USER_DATA_FILE);
            console.log('Excel file created successfully with proper structure');
        } else {
            console.log('Excel file already exists, verifying structure...');
            const workbook = XLSX.readFile(USER_DATA_FILE);
            
            // Verify sheets exist
            const requiredSheets = ['Users', 'Admins', 'Inventory', 'Bookings'];
            const missingSheets = requiredSheets.filter(sheet => !workbook.Sheets[sheet]);
            
            if (missingSheets.length > 0) {
                console.log('Missing sheets detected:', missingSheets);
                console.log('Recreating Excel file...');
                fs.unlinkSync(USER_DATA_FILE);
                initializeExcelFile();
                return;
            }
            
            console.log('Excel file structure verified');
        }
    } catch (error) {
        console.error('Error in initializeExcelFile:', error);
        throw error;
    }
}

// Safe file operations with retries
async function safeReadExcel(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            if (!fs.existsSync(USER_DATA_FILE)) {
                console.log('Excel file not found, creating new one...');
                initializeExcelFile();
            }
            return XLSX.readFile(USER_DATA_FILE);
        } catch (error) {
            console.error(`Attempt ${i + 1} failed to read Excel file:`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

async function safeWriteExcel(workbook, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            XLSX.writeFile(workbook, USER_DATA_FILE);
            return true;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed to write Excel file:`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Format date to Indian timezone
function getFormattedDate() {
    const now = new Date();
    const options = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };
    return now.toLocaleString('en-IN', options);
}

// Save data to Excel
app.post('/save-to-excel', async (req, res) => {
    try {
        console.log('Received registration request:', JSON.stringify(req.body, null, 2));
        const { data, type } = req.body;
        
        if (!data || !type) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required data or type' 
            });
        }

        // Initialize file if it doesn't exist
        if (!fs.existsSync(USER_DATA_FILE)) {
            console.log('Creating new Excel file...');
            initializeExcelFile();
        }
        
        // Read existing workbook with retry logic
        let workbook;
        try {
            workbook = await safeReadExcel();
            console.log('Successfully read Excel file');
        } catch (readError) {
            console.error('Failed to read Excel file after retries:', readError);
            return res.status(500).json({ 
                success: false, 
                error: 'Server busy or unable to access data file. Please try again shortly.'
            });
        }

        const sheetName = type === 'user' ? 'Users' : 'Admins';
        const ws = workbook.Sheets[sheetName];
        
        if (!ws) {
            console.error(`Sheet ${sheetName} not found in Excel file`);
            return res.status(500).json({
                success: false,
                error: 'Database structure error. Please contact support.'
            });
        }
        
        // Get existing data
        const existingData = XLSX.utils.sheet_to_json(ws);
        console.log(`Found ${existingData.length} existing records in ${sheetName} sheet`);
        
        // Check for duplicate email (case-insensitive)
        if (existingData.some(record => record.email.toLowerCase() === data.email.toLowerCase())) {
            console.log('Duplicate email found:', data.email);
            return res.status(400).json({ 
                success: false, 
                error: 'Email already registered' 
            });
        }
        
        // Check for duplicate admin ID if admin registration
        if (type === 'admin') {
            if (!data.adminId) {
                console.error('Admin ID missing');
                return res.status(400).json({
                    success: false,
                    error: 'Admin ID is required'
                });
            }

            if (existingData.some(record => record.adminId === data.adminId)) {
                console.log('Duplicate admin ID found:', data.adminId);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Admin ID already exists' 
                });
            }

            // Validate admin ID format
            const adminIdRegex = /^ADM\d{4}$/;
            if (!adminIdRegex.test(data.adminId)) {
                console.error('Invalid admin ID format:', data.adminId);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid Admin ID format. Must be ADM followed by 4 digits (e.g., ADM1234)'
                });
            }

            // Validate security code
            if (data.securityCode !== "1575") {
                console.error('Invalid security code');
                return res.status(400).json({
                    success: false,
                    error: 'Invalid security code'
                });
            }
        }

        // Add timestamps
        const now = new Date();
        data.timestamp = now.getTime();
        data.registrationDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
        data.registrationTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
        
        // Hash password before storing
        data.password = hashPassword(data.password);
        
        // Add new data
        existingData.push(data);
        console.log('Added new record to data array:', JSON.stringify(data, null, 2));
        
        // Update sheet
        const newWs = XLSX.utils.json_to_sheet(existingData);
        workbook.Sheets[sheetName] = newWs;
        
        // Save to file with retry logic
        try {
            await safeWriteExcel(workbook);
            console.log('Data saved successfully to Excel file');
            res.json({ 
                success: true,
                message: 'Registration successful'
            });
        } catch (writeError) {
            console.error('Failed to write to Excel file after retries:', writeError);
            return res.status(500).json({ 
                success: false, 
                error: 'Server busy or unable to save data. Please ensure USER_DATA.xlsx is closed and try again.'
            });
        }

    } catch (error) {
        console.error('General error in /save-to-excel:', error);
        res.status(500).json({ 
            success: false, 
            error: 'An unexpected server error occurred: ' + error.message 
        });
    }
});

// Create new booking
app.post('/api/book', async (req, res) => {
    try {
        const { vehicleId, duration } = req.body;
        
        // Validate duration
        if (!duration || isNaN(duration) || duration <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid duration. Please provide a positive number.'
            });
        }

        const workbook = await safeReadExcel();
        if (!workbook) {
            return res.status(500).json({
                success: false,
                error: 'Could not access database'
            });
        }

        // Check inventory
        const inventorySheet = workbook.Sheets['Inventory'];
        const inventory = XLSX.utils.sheet_to_json(inventorySheet);
        const vehicle = inventory.find(v => v.vehicleId === vehicleId);

        if (!vehicle) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        if (vehicle.availableQuantity <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle not available'
            });
        }

        // Update inventory
        vehicle.availableQuantity--;
        vehicle.lastUpdated = getFormattedDate();

        // Generate unique booking ID
        const bookingId = `BK${Date.now()}`;

        // Update bookings
        const bookingsSheet = workbook.Sheets['Bookings'];
        const bookings = XLSX.utils.sheet_to_json(bookingsSheet);

        const newBooking = {
            bookingId,
            ...req.body,
            bookingDate: getFormattedDate(),
            returnDate: new Date(Date.now() + duration * 60 * 60 * 1000).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata'
            }),
            returned: false
        };
        bookings.push(newBooking);

        // Update Excel file
        const newInventorySheet = XLSX.utils.json_to_sheet(inventory);
        const newBookingsSheet = XLSX.utils.json_to_sheet(bookings);
        
        workbook.Sheets['Inventory'] = newInventorySheet;
        workbook.Sheets['Bookings'] = newBookingsSheet;
        
        await safeWriteExcel(workbook);

        res.json({ 
            success: true,
            message: 'Booking successful',
            bookingId: newBooking.bookingId,
            availableQuantity: vehicle.availableQuantity
        });
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({
            success: false,
            error: 'Booking failed: ' + error.message
        });
    }
});

// Update vehicle inventory
app.post('/api/update-inventory', async (req, res) => {
    try {
        const { vehicleId, vehicleName, category, totalQuantity, availableQuantity } = req.body;
        
        if (!vehicleId || totalQuantity === undefined || availableQuantity === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate quantities
        if (availableQuantity > totalQuantity) {
            return res.status(400).json({ error: 'Available quantity cannot be greater than total quantity' });
        }

        const workbook = await safeReadExcel();
        if (!workbook) {
            return res.status(500).json({ error: 'Could not access inventory database' });
        }

        const inventorySheet = workbook.Sheets['Inventory'];
        const inventory = XLSX.utils.sheet_to_json(inventorySheet);

        // Find and update vehicle or add new one
        const vehicleIndex = inventory.findIndex(v => v.vehicleId === vehicleId);
        const updateData = {
            vehicleId,
            vehicleName,
            category,
            totalQuantity,
            availableQuantity,
            lastUpdated: getFormattedDate()
        };

        if (vehicleIndex >= 0) {
            inventory[vehicleIndex] = { ...inventory[vehicleIndex], ...updateData };
        } else {
            inventory.push(updateData);
        }

        // Check for low quantity alerts
        const lowQuantityVehicles = inventory.filter(v => 
            v.availableQuantity < (v.totalQuantity * 0.2) && v.availableQuantity > 0
        );

        if (lowQuantityVehicles.length > 0) {
            console.log('LOW QUANTITY ALERT:', lowQuantityVehicles);
        }

        // Update Excel file
        const newInventorySheet = XLSX.utils.json_to_sheet(inventory);
        workbook.Sheets['Inventory'] = newInventorySheet;
        
        await safeWriteExcel(workbook);

        res.json({ 
            message: 'Inventory updated successfully',
            lowQuantityAlert: lowQuantityVehicles.length > 0
        });
    } catch (error) {
        console.error('Inventory update error:', error);
        res.status(500).json({ error: 'Inventory update failed: ' + error.message });
    }
});

// Get vehicle inventory
app.get('/api/inventory', async (req, res) => {
    try {
        const workbook = await safeReadExcel();
        if (!workbook) {
            return res.status(500).json({ error: 'Could not access inventory database' });
        }

        const inventorySheet = workbook.Sheets['Inventory'];
        const inventory = XLSX.utils.sheet_to_json(inventorySheet);

        res.json(inventory);
    } catch (error) {
        console.error('Inventory fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory: ' + error.message });
    }
});

// Return vehicle endpoint
app.post('/api/return', async (req, res) => {
    try {
        const { vehicleId, bookingId } = req.body;
        
        const workbook = await safeReadExcel();
        if (!workbook) {
            return res.status(500).json({ error: 'Could not access database' });
        }

        // Update inventory
        const inventorySheet = workbook.Sheets['Inventory'];
        const inventory = XLSX.utils.sheet_to_json(inventorySheet);
        const vehicle = inventory.find(v => v.vehicleId === vehicleId);

        if (!vehicle) {
            return res.status(400).json({ error: 'Vehicle not found' });
        }

        vehicle.availableQuantity++;
        vehicle.lastUpdated = getFormattedDate();

        // Update bookings
        const bookingsSheet = workbook.Sheets['Bookings'];
        const bookings = XLSX.utils.sheet_to_json(bookingsSheet);
        const booking = bookings.find(b => b.bookingId === bookingId);

        if (!booking) {
            return res.status(400).json({ error: 'Booking not found' });
        }

        booking.returned = true;
        booking.returnDate = getFormattedDate();

        // Update Excel file
        const newInventorySheet = XLSX.utils.json_to_sheet(inventory);
        const newBookingsSheet = XLSX.utils.json_to_sheet(bookings);
        
        workbook.Sheets['Inventory'] = newInventorySheet;
        workbook.Sheets['Bookings'] = newBookingsSheet;
        
        await safeWriteExcel(workbook);

        res.json({ 
            message: 'Vehicle returned successfully',
            availableQuantity: vehicle.availableQuantity
        });
    } catch (error) {
        console.error('Return error:', error);
        res.status(500).json({ error: 'Return failed: ' + error.message });
    }
});

// Auto-update inventory every 5 minutes
setInterval(async () => {
    try {
        const workbook = await safeReadExcel();
        if (!workbook) return;

        const inventorySheet = workbook.Sheets['Inventory'];
        const inventory = XLSX.utils.sheet_to_json(inventorySheet);

        // Update lastUpdated timestamp for all vehicles
        const updatedInventory = inventory.map(vehicle => ({
            ...vehicle,
            lastUpdated: getFormattedDate()
        }));

        const newInventorySheet = XLSX.utils.json_to_sheet(updatedInventory);
        workbook.Sheets['Inventory'] = newInventorySheet;
        
        await safeWriteExcel(workbook);
        console.log('Inventory auto-updated at:', getFormattedDate());
    } catch (error) {
        console.error('Auto-update error:', error);
    }
}, 5 * 60 * 1000); // 5 minutes

// Initialize Excel file on server start
initializeExcelFile();

// Serve registration page
app.get('/registration', (req, res) => {
    res.sendFile(path.join(__dirname, 'registration.html'));
});

// User login endpoint
app.post('/api/user-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('User login attempt:', email);

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Read Excel file
        const workbook = await safeReadExcel();
        const usersSheet = workbook.Sheets['Users'];
        const users = XLSX.utils.sheet_to_json(usersSheet);

        // Find user by email and password (case-insensitive email)
        const user = users.find(u => 
            u.email.toLowerCase() === email.toLowerCase() && 
            u.password === hashPassword(password)
        );

        if (!user) {
            console.log('Invalid user credentials:', email);
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        console.log('User login successful:', email);
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('User login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.'
        });
    }
});

// Admin login endpoint
app.post('/api/admin-login', async (req, res) => {
    try {
        const { adminId, password, securityCode } = req.body;
        console.log('Admin login attempt:', adminId);

        if (!adminId || !password || !securityCode) {
            return res.status(400).json({
                success: false,
                error: 'Admin ID, password, and security code are required'
            });
        }

        if (securityCode !== "1575") {
            return res.status(401).json({
                success: false,
                error: 'Invalid security code'
            });
        }

        // Read Excel file
        const workbook = await safeReadExcel();
        const adminsSheet = workbook.Sheets['Admins'];
        const admins = XLSX.utils.sheet_to_json(adminsSheet);

        // Find admin by ID and password
        const admin = admins.find(a => 
            a.adminId === adminId && 
            a.password === hashPassword(password)
        );

        if (!admin) {
            console.log('Invalid admin credentials:', adminId);
            return res.status(401).json({
                success: false,
                error: 'Invalid Admin ID or password'
            });
        }

        console.log('Admin login successful:', adminId);
        res.json({
            success: true,
            message: 'Login successful',
            admin: {
                name: admin.name,
                email: admin.email,
                adminId: admin.adminId,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.'
        });
    }
});

// Serve admin login page
app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Endpoint to handle booking submissions
app.post('/submit-booking', upload.single('aadharUpload'), async (req, res) => {
    console.log('Received booking submission request:');
    console.log('Body:', req.body);
    console.log('File:', req.file);

    try {
        const bookingData = req.body;
        const aadharFile = req.file; // Get the uploaded file details

        const { userName, mobileNumber, aadharNumber, pickupTime, deliveryMethod, address, transactionId } = bookingData;
        const userId = localStorage.getItem('loggedInUserId'); // Still need to figure out how to pass userId from client side

        if (!userName || !mobileNumber || !aadharNumber || !pickupTime || !deliveryMethod || !transactionId || !aadharFile) {
             // Delete the uploaded file if validation fails
            if (aadharFile && fs.existsSync(aadharFile.path)) {
                 fs.unlinkSync(aadharFile.path);
             }
            return res.status(400).json({ success: false, error: 'Missing required booking information, including Aadhar upload.' });
        }

         if (deliveryMethod === 'home' && !address) {
             // Delete the uploaded file if validation fails
            if (aadharFile && fs.existsSync(aadharFile.path)) {
                 fs.unlinkSync(aadharFile.path);
             }
             return res.status(400).json({ success: false, error: 'Delivery address is required for home delivery.' });
         }

        // Read existing workbook with retry logic
        let workbook;
        try {
            workbook = await safeReadExcel();
            console.log('Successfully read Excel file for booking');
        } catch (readError) {
            console.error('Failed to read Excel file after retries for booking:', readError);
             // Delete the uploaded file if reading Excel fails
            if (aadharFile && fs.existsSync(aadharFile.path)) {
                 fs.unlinkSync(aadharFile.path);
             }
            return res.status(500).json({ 
                success: false, 
                error: 'Server busy or unable to access data file. Please try again shortly.'
            });
        }

        const bookingsSheetName = 'Bookings';
        let bookingsWs = workbook.Sheets[bookingsSheetName];

         // If Bookings sheet does not exist, create it with headers
        if (!bookingsWs) {
             console.warn(`Sheet ${bookingsSheetName} not found. Creating it.`);
             const bookingHeaders = [
                'bookingId', 'vehicleId', 'userName', 'mobileNumber', 'aadharNumber', 
                'aadharDocumentPath', 'pickupTime', 'deliveryMethod', 'deliveryAddress', 
                'transactionId', 'bookingTimestamp', 'status'
            ];
            bookingsWs = XLSX.utils.aoa_to_sheet([bookingHeaders]);
            XLSX.utils.book_append_sheet(workbook, bookingsWs, bookingsSheetName);
             console.log(`Sheet ${bookingsSheetName} created with headers.`);
        } else {
             // Ensure existing sheet has correct headers (optional but good practice)
             const existingHeaders = XLSX.utils.sheet_to_json(bookingsWs, { header: 1 })[0];
             const requiredHeaders = [
                'bookingId', 'vehicleId', 'userName', 'mobileNumber', 'aadharNumber', 
                'aadharDocumentPath', 'pickupTime', 'deliveryMethod', 'deliveryAddress', 
                'transactionId', 'bookingTimestamp', 'status'
             ];
             const headersMatch = requiredHeaders.every(header => existingHeaders.includes(header));

             if (!headersMatch) {
                 console.warn('Bookings sheet headers do not match expected format. Appending headers.');
                  // Append missing headers if necessary - this might mess up existing data though
                  // A better approach might be to inform the user or attempt to map
                  // For now, we'll just log a warning and proceed, assuming new rows will have the full set.
             }
        }

        // Get existing bookings data
        const existingBookings = XLSX.utils.sheet_to_json(bookingsWs);
        // Simple booking ID generation
        const bookingId = `BOOKING-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        // New booking record data
        const newBookingRow = {
            bookingId: bookingId,
            vehicleId: bookingData.vehicleId, // Assuming vehicleId is sent from client
            userName: userName,
            mobileNumber: mobileNumber,
            aadharNumber: aadharNumber,
            aadharDocumentPath: aadharFile ? aadharFile.path : '', // Save the path to the uploaded file
            pickupTime: pickupTime,
            deliveryMethod: deliveryMethod,
            deliveryAddress: deliveryMethod === 'home' ? address : '', // Save address only for home delivery
            transactionId: transactionId,
            bookingTimestamp: new Date().toISOString(),
            status: 'Pending' // Initial status
        };

        // Append new row to the sheet
        const newBookingsData = [...existingBookings, newBookingRow];

        // Convert JSON back to sheet
        const newBookingsWs = XLSX.utils.json_to_sheet(newBookingsData);
        workbook.Sheets[bookingsSheetName] = newBookingsWs;
        
        // Write the updated workbook back to the file with retry logic
        try {
            await safeWriteExcel(workbook);
            console.log('Booking successfully saved to Excel');
            res.json({ success: true, message: 'Booking request submitted successfully!', bookingId: bookingId });
        } catch (writeError) {
            console.error('Failed to write Excel file after retries for booking:', writeError);
             // Delete the uploaded file if writing Excel fails
            if (aadharFile && fs.existsSync(aadharFile.path)) {
                 fs.unlinkSync(aadharFile.path);
             }
            res.status(500).json({ 
                success: false, 
                error: 'Failed to save booking data. Please try again.'
            });
        }

    } catch (error) {
        console.error('Error handling booking submission:', error);
         // Delete the uploaded file if any other error occurs
         if (req.file && fs.existsSync(req.file.path)) {
             fs.unlinkSync(req.file.path);
         }
        res.status(500).json({ success: false, error: 'Internal server error during booking submission: ' + error.message });
    }
});

// Endpoint to get all booking requests
app.get('/get-bookings', async (req, res) => {
    console.log('Received request for booking data');
    try {
        // Read existing workbook with retry logic
        let workbook;
        try {
            workbook = await safeReadExcel();
            console.log('Successfully read Excel file for getting bookings');
        } catch (readError) {
            console.error('Failed to read Excel file after retries for getting bookings:', readError);
            return res.status(500).json({ 
                success: false, 
                error: 'Server busy or unable to access data file. Please try again shortly.'
            });
        }

        const bookingsSheetName = 'Bookings';
        const bookingsWs = workbook.Sheets[bookingsSheetName];

        if (!bookingsWs) {
            console.warn(`Sheet ${bookingsSheetName} not found in Excel file.`);
            return res.json({ success: true, bookings: [] }); // Return empty array if sheet is missing
        }

        // Convert sheet to JSON
        const bookingsData = XLSX.utils.sheet_to_json(bookingsWs);
        console.log(`Found ${bookingsData.length} booking records.`);

        res.json({ success: true, bookings: bookingsData });

    } catch (error) {
        console.error('Error handling get bookings request:', error);
        res.status(500).json({ success: false, error: 'Internal server error while fetching bookings.' });
    }
});

// Vehicle management endpoints
app.get('/api/vehicles', async (req, res) => {
    try {
        const workbook = await safeReadExcel();
        if (!workbook) {
            return res.status(500).json({ 
                success: false, 
                error: 'Could not access database' 
            });
        }

        const vehiclesSheet = workbook.Sheets['Vehicles'];
        if (!vehiclesSheet) {
            // If Vehicles sheet doesn't exist, create it
            const vehiclesHeaders = [
                'id',
                'name',
                'type',
                'price',
                'image',
                'description',
                'status',
                'createdAt',
                'updatedAt'
            ];
            const newVehiclesSheet = XLSX.utils.aoa_to_sheet([vehiclesHeaders]);
            workbook.Sheets['Vehicles'] = newVehiclesSheet;
            await safeWriteExcel(workbook);
            return res.json({ success: true, vehicles: [] });
        }

        const vehicles = XLSX.utils.sheet_to_json(vehiclesSheet);
        res.json({ success: true, vehicles });
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch vehicles' 
        });
    }
});

app.post('/api/vehicles', async (req, res) => {
    console.log('POST /api/vehicles received data:', req.body); // Log received data
    const { name, type, price, engine, mileage, seats, image, status } = req.body;

    if (!name || !type || !price || !engine || !mileage || !seats || !image || !status) {
        console.error('Missing required fields for new vehicle'); // Log missing fields
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        const workbook = await safeReadExcel();
        const sheetName = 'Vehicles';

        if (!workbook.Sheets[sheetName]) {
            // Create the sheet if it doesn't exist and add headers
            workbook.Sheets[sheetName] = XLSX.utils.json_to_sheet([
                ['id', 'name', 'type', 'price', 'description', 'image', 'status']
            ], { skipHeader: true });
            console.log(`Created new sheet: ${sheetName}`); // Log sheet creation
        }

        const vehiclesSheet = workbook.Sheets[sheetName];
        const vehiclesData = XLSX.utils.sheet_to_json(vehiclesSheet);

        // Generate a unique ID (simple increment for now, better in real app)
        const newVehicleId = vehiclesData.length > 0 ? Math.max(...vehiclesData.map(v => v.id)) + 1 : 1;
        
        const newVehicle = {
            id: newVehicleId,
            name,
            type,
            price: parseFloat(price),
            description: `${engine}cc, ${mileage} km/l, ${seats} Seater`,
            image,
            status
        };

        console.log('New vehicle data to be added:', newVehicle); // Log vehicle data before adding

        // Append the new vehicle row
        XLSX.utils.sheet_add_json(vehiclesSheet, [newVehicle], { origin: -1, skipHeader: true });

        console.log('Attempting to write to Excel file...'); // Log before writing
        const writeSuccess = await safeWriteExcel(workbook);

        if (writeSuccess) {
            console.log('Successfully wrote new vehicle to Excel file.'); // Log write success
            res.json({ success: true, vehicle: newVehicle });
        } else {
            console.error('Failed to write new vehicle to Excel file after retries.'); // Log write failure
            res.status(500).json({ success: false, error: 'Server busy or unable to save data. Please ensure USER_DATA.xlsx is closed and try again.' });
        }

    } catch (error) {
        console.error('Error adding new vehicle:', error); // Log general error
        res.status(500).json({ success: false, error: 'Failed to add vehicle', details: error.message });
    }
});

app.get('/api/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const workbook = await safeReadExcel();
        if (!workbook) {
            return res.status(500).json({
                success: false,
                error: 'Could not access database'
            });
        }

        const vehiclesSheet = workbook.Sheets['Vehicles'];
        if (!vehiclesSheet) {
            return res.status(404).json({
                success: false,
                error: 'No vehicles found'
            });
        }

        const vehicles = XLSX.utils.sheet_to_json(vehiclesSheet);
        const vehicle = vehicles.find(v => v.id === id);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        res.json({
            success: true,
            vehicle
        });
    } catch (error) {
        console.error('Error fetching vehicle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch vehicle'
        });
    }
});

app.put('/api/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, price, image, description, status } = req.body;

        if (!name || !type || !price || !image || !description || !status) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required'
            });
        }

        const workbook = await safeReadExcel();
        if (!workbook) {
            return res.status(500).json({
                success: false,
                error: 'Could not access database'
            });
        }

        const vehiclesSheet = workbook.Sheets['Vehicles'];
        if (!vehiclesSheet) {
            return res.status(404).json({
                success: false,
                error: 'No vehicles found'
            });
        }

        const vehicles = XLSX.utils.sheet_to_json(vehiclesSheet);
        const vehicleIndex = vehicles.findIndex(v => v.id === id);

        if (vehicleIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        const updatedVehicle = {
            ...vehicles[vehicleIndex],
            name,
            type,
            price: parseFloat(price),
            image,
            description,
            status,
            updatedAt: new Date().toISOString()
        };

        vehicles[vehicleIndex] = updatedVehicle;
        const newVehiclesSheet = XLSX.utils.json_to_sheet(vehicles);
        workbook.Sheets['Vehicles'] = newVehiclesSheet;
        await safeWriteExcel(workbook);

        res.json({
            success: true,
            message: 'Vehicle updated successfully',
            vehicle: updatedVehicle
        });
    } catch (error) {
        console.error('Error updating vehicle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update vehicle'
        });
    }
});

app.delete('/api/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const workbook = await safeReadExcel();
        if (!workbook) {
            return res.status(500).json({
                success: false,
                error: 'Could not access database'
            });
        }

        const vehiclesSheet = workbook.Sheets['Vehicles'];
        if (!vehiclesSheet) {
            return res.status(404).json({
                success: false,
                error: 'No vehicles found'
            });
        }

        const vehicles = XLSX.utils.sheet_to_json(vehiclesSheet);
        const vehicleIndex = vehicles.findIndex(v => v.id === id);

        if (vehicleIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        vehicles.splice(vehicleIndex, 1);
        const newVehiclesSheet = XLSX.utils.json_to_sheet(vehicles);
        workbook.Sheets['Vehicles'] = newVehiclesSheet;
        await safeWriteExcel(workbook);

        res.json({
            success: true,
            message: 'Vehicle deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete vehicle'
        });
    }
});

// Start the server
const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT}/registration in your browser`);
}); 