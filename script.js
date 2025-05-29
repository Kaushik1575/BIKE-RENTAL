// Vehicle data
const allVehicles = [];

// Fuel prices
const fuelPrices = {
    petrol: 101.75,
    diesel: 95.01
};

// DOM Elements
const vehicleGrid = document.getElementById('vehicleGrid');
const tabButtons = document.querySelectorAll('.tab-button');
const contactForm = document.getElementById('contactForm');
const rentButtons = document.querySelectorAll('.rent-button');

// Modal Elements
const registrationModal = document.getElementById('registrationModal');
const bookingModal = document.getElementById('bookingModal');
const registrationForm = document.getElementById('registrationForm');
const bookingForm = document.getElementById('bookingForm');

// Current selected vehicle for booking
let selectedVehicle = null;

let searchQuery = '';

// Calculate fuel cost
function calculateFuelCost(vehicle, kilometers) {
    const fuelNeeded = kilometers / vehicle.mileage;
    const fuelPrice = vehicle.fuelType.toLowerCase() === 'petrol' ? fuelPrices.petrol : fuelPrices.diesel;
    return fuelNeeded * fuelPrice;
}

// Display vehicles based on search
function displayVehicles(search = '') {
    const vehicleGrid = document.getElementById('vehicleGrid');
    if (!vehicleGrid) {
        console.error('Vehicle grid element not found!');
        return;
    }

    // Filter vehicles based on search query
    const filteredVehicles = allVehicles.filter(vehicle => 
        vehicle.name.toLowerCase().includes(search.toLowerCase())
    );

    // Generate and display vehicle cards
    vehicleGrid.innerHTML = filteredVehicles.map(vehicle => `
        <div class="card">
            <img src="${vehicle.image}" 
                 alt="${vehicle.name}" 
                 onerror="this.onerror=null; this.src='images/default.jpg';">
            <h3>${vehicle.name}</h3>
            <p class="category">${vehicle.type}</p>
            <p class="price">₹${vehicle.price}/day</p>
            <p class="vehicle-specs">${vehicle.description}</p>
            <input type="number" placeholder="Km" class="km">
            <br>
            <button onclick="checkCost(this, ${parseFloat(vehicle.description.split(', ')[1])})">Check Mileage</button>
            <button class="rent-button" onclick="rentVehicle('${vehicle.id}')" ${vehicle.status !== 'available' ? 'disabled' : ''}>
                ${vehicle.status === 'available' ? 'Book Now' : 'Not Available'}
            </button>
            <div class="cost-result"></div>
        </div>
    `).join('');
}

// Calculate and display fuel cost
function checkCost(btn, mileage) {
    const card = btn.parentElement;
    const kmInput = card.querySelector(".km");
    const resultDiv = card.querySelector(".cost-result");
    const km = parseFloat(kmInput.value);
    
    // Assume a fixed fuel price (you can make this dynamic later)
    const fuelPricePerLiter = 101.74; // Example price for Petrol
    
    // Note: Mileage calculation might need adjustment based on fuelType if prices vary

    if (isNaN(km) || km <= 0) {
      resultDiv.innerText = "Enter valid km";
      resultDiv.style.color = 'red';
    } else {
      const fuelNeeded = km / mileage; // Calculate fuel needed based on vehicle mileage
      const cost = fuelNeeded * fuelPricePerLiter;
      resultDiv.innerText = `Estimated Cost: ₹${cost.toFixed(2)}`;
      resultDiv.style.color = 'green';
    }
}

// Rent a vehicle
async function rentVehicle(vehicleId) {
    // Check if user is logged in
    const userType = localStorage.getItem('userType');
    if (!userType) {
        showError('Please login to book a vehicle');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    const vehicle = allVehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
        showError('Vehicle not found');
        return;
    }

    if (!vehicle.available) {
        showError('This vehicle is not available for rent');
        return;
    }

    // Open booking modal
    openBookingModal(vehicle);
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.backgroundColor = type === 'info' ? '#3498db' : type === 'success' ? '#2ecc71' : '#e74c3c';
    notification.style.color = 'white';
    notification.style.padding = '1rem 2rem';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '1000';
    notification.style.animation = 'slideIn 0.5s ease-out';

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.5s ease-in';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Handle contact form submission
contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData);
    console.log('Contact form submitted:', data);
    showNotification('Thank you for your message! We will get back to you soon.');
    contactForm.reset();
});

// Handle pricing card rent buttons
rentButtons.forEach(button => {
    button.addEventListener('click', () => {
        const plan = button.parentElement.querySelector('h3').textContent;
        showNotification(`You selected the ${plan} plan! Please select a vehicle to continue.`);
    });
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Open Registration Modal
function openRegistrationModal() {
    registrationModal.style.display = 'block';
}

// Close Registration Modal
function closeRegistrationModal() {
    registrationModal.style.display = 'none';
}

// Generate random captcha
function generateCaptcha() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let captcha = '';
    for (let i = 0; i < 6; i++) {
        captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('captchaText').textContent = captcha;
    return captcha;
}

// Open Booking Modal
function openBookingModal(vehicle) {
    // Check if user is logged in
    const userType = localStorage.getItem('userType');
    if (!userType) {
        showError('Please login to book a vehicle');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    selectedVehicle = { ...vehicle };
    
    // Display selected vehicle name in the modal
    const selectedVehicleDisplay = document.getElementById('selectedVehicleDisplay');
    if (selectedVehicleDisplay) {
        selectedVehicleDisplay.textContent = `${vehicle.name} - ${vehicle.category}`;
    }

    // Generate captcha
    generateCaptcha();

    // Show modal
    const bookingModal = document.getElementById('bookingModal');
    if (bookingModal) {
        bookingModal.style.display = 'block';
    }

    // Add event listener for delivery method change within the modal context
    const deliveryOptions = document.querySelectorAll('#bookingModal input[name="deliveryMethod"]');
    deliveryOptions.forEach(option => {
        option.addEventListener('change', (e) => {
            const totalAmountText = e.target.value === 'home' ? '₹200' : '₹100';
            const qrCodeParagraph = document.querySelector('#bookingModal .qr-code p');
            if (qrCodeParagraph) {
                qrCodeParagraph.textContent = `Scan to pay ${totalAmountText} advance`;
            }
        });
    });
     // Trigger the change event initially to set the default advance amount text
    const initialDeliveryMethod = document.querySelector('#bookingModal input[name="deliveryMethod"]:checked');
    if(initialDeliveryMethod) {
        initialDeliveryMethod.dispatchEvent(new Event('change'));
    }
}

// Close Booking Modal
function closeBookingModal() {
    const bookingModal = document.getElementById('bookingModal');
    if (bookingModal) {
        bookingModal.style.display = 'none';
    }
    selectedVehicle = null;
}

// Get server URL
function getServerUrl() {
    // Always use port 3000 for the API server
    return 'http://localhost:3000';
}

// Registration form submission
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('name').value,
        mobile: document.getElementById('mobile').value,
        gender: document.getElementById('gender').value,
        aadhar: document.getElementById('aadhar').value,
        email: document.getElementById('email').value
    };

    try {
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess('Registration successful!');
            showBookingForm();
        } else {
            showError(data.error || 'Registration failed');
        }
    } catch (error) {
        showError('Error connecting to server');
    }
});

// Booking form submission
document.getElementById('bookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedVehicle) {
        showError('No vehicle selected');
        return;
    }

    // Validate captcha
    const captchaInput = document.getElementById('captcha').value;
    const captchaText = document.getElementById('captchaText').textContent;
    if (captchaInput !== captchaText) {
        showError('Invalid captcha code');
        generateCaptcha();
        return;
    }

    // Validate transaction ID
    const transactionId = document.getElementById('transactionId').value;
    if (!transactionId) {
        showError('Please enter the transaction ID');
        return;
    }

    // Get form data
    const formData = {
        vehicleId: selectedVehicle.id,
        userName: document.getElementById('userName').value,
        mobileNumber: document.getElementById('mobileNumber').value,
        aadharNumber: document.getElementById('aadharNumber').value,
        pickupTime: document.getElementById('pickupTime').value,
        deliveryMethod: document.querySelector('input[name="deliveryMethod"]:checked').value,
        transactionId: transactionId
    };

    try {
        const response = await fetch('http://localhost:3000/api/book', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            // Update vehicle availability
            const vehicle = allVehicles.find(v => v.id === selectedVehicle.id);
            if (vehicle) {
                vehicle.available = false;
                // Refresh the display
                displayVehicles();
            }

            // Show success message
            showSuccess(`Booking successful! Your booking ID is: ${data.bookingId}`);
            closeBookingModal();

            // Redirect to admin dashboard if user is admin
            if (localStorage.getItem('userType') === 'admin') {
                setTimeout(() => {
                    window.location.href = 'admin-dashboard.html';
                }, 2000);
            }
        } else {
            showError(data.error || 'Booking failed');
        }
    } catch (error) {
        showError('Error connecting to server');
    }
});

// Show success message
function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    if (successDiv && successText) {
        successText.textContent = message;
        successDiv.style.display = 'block';
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }
}

// Show booking form
function showBookingForm() {
    document.getElementById('registrationForm').style.display = 'none';
    document.getElementById('bookingForm').style.display = 'block';
    document.getElementById('successMessage').style.display = 'none';
    displayVehicles(searchQuery);
}

// Update vehicle list
function updateVehicleList() {
    displayVehicles(searchQuery);
}

// Handle search
function handleSearch(event) {
    searchQuery = event.target.value;
    displayVehicles(searchQuery);
}

// Load vehicles when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');
    // displayVehicles(); // Removed dynamic vehicle display
    updateNavigation();
    
    // Add search input handler
    const searchInput = document.getElementById('vehicleSearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // Display personalized welcome message
    const loggedInUser = localStorage.getItem('loggedInUser');
    const welcomeHeading = document.getElementById('welcomeHeading');
    const welcomeMessageIndex = document.getElementById('welcomeMessageIndex');

    if (loggedInUser) {
        const user = JSON.parse(loggedInUser);
        if (welcomeHeading) {
            welcomeHeading.textContent = `Welcome, ${user.name}!`;
        }
        if (welcomeMessageIndex) {
            welcomeMessageIndex.textContent = 'Find your perfect ride for any adventure.'; // Keep or customize this message
        }
    } else {
        // If no user is logged in, show the default message
        if (welcomeHeading) {
            welcomeHeading.textContent = 'Welcome to BikeRental';
        }
        if (welcomeMessageIndex) {
            welcomeMessageIndex.textContent = 'Find your perfect ride for any adventure';
        }
    }

    // Generate initial captcha for booking modal - ensure this is called if needed on modal open
    // generateCaptcha(); 

    // Add event listener for delivery method change - move this to openBookingModal or ensure elements exist
    // const deliveryOptions = document.querySelectorAll('input[name="deliveryMethod"]');
    // deliveryOptions.forEach(option => {
    //     option.addEventListener('change', (e) => {
    //         const totalAmount = e.target.value === 'home' ? '₹200' : '₹100';
    //         document.querySelector('.qr-code p').textContent = `Scan to pay ${totalAmount} advance`;
    //     });
    // });

});

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('bookingModal');
    if (event.target === modal) {
        closeBookingModal();
    }
}

// Function to handle booking page initialization
function initializeBookingPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const vehicleId = urlParams.get('id');
    
    if (!vehicleId) {
        window.location.href = 'index.html';
        return;
    }

    const vehicle = allVehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
        window.location.href = 'index.html';
        return;
    }

    // Display vehicle details
    const vehicleDetails = document.getElementById('selectedVehicleDetails');
    if (vehicleDetails) {
        vehicleDetails.innerHTML = `
            <div class="vehicle-card">
                <img src="${vehicle.image}" alt="${vehicle.name}">
                <h3>${vehicle.name}</h3>
                <p>Price: $${vehicle.price}/day</p>
                <p>Mileage: ${vehicle.mileage} km/l</p>
                <p>Seating: ${vehicle.seatingCapacity} persons</p>
            </div>
        `;
    }

    // Set up date and time inputs
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const pickupTimeInput = document.getElementById('pickupTime');
    const dropoffTimeInput = document.getElementById('dropoffTime');
    const totalPriceInput = document.getElementById('totalPrice');

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    startDateInput.min = today;
    endDateInput.min = today;

    // Calculate total price when dates change
    function calculateTotalPrice() {
        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);
        
        if (startDate && endDate && !isNaN(startDate) && !isNaN(endDate)) {
            const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            if (days > 0) {
                const total = days * vehicle.price;
                totalPriceInput.value = `$${total}`;
            } else {
                totalPriceInput.value = '';
            }
        }
    }

    startDateInput.addEventListener('change', calculateTotalPrice);
    endDateInput.addEventListener('change', calculateTotalPrice);

    // Handle form submission
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        bookingForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const booking = {
                vehicleId: vehicle.id,
                vehicleName: vehicle.name,
                startDate: startDateInput.value,
                endDate: endDateInput.value,
                pickupTime: pickupTimeInput.value,
                dropoffTime: dropoffTimeInput.value,
                totalPrice: totalPriceInput.value
            };

            // Store booking in localStorage
            const bookings = JSON.parse(localStorage.getItem('bookings') || '[]');
            bookings.push(booking);
            localStorage.setItem('bookings', JSON.stringify(bookings));

            alert('Booking confirmed! Thank you for choosing our service.');
            window.location.href = 'index.html';
        });
    }
}

// Check if we're on the booking page
if (window.location.pathname.includes('booking.html')) {
    initializeBookingPage();
} 