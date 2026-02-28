// main.js - Frontend JavaScript with Firebase

class AzamPayPayment {
    constructor() {
        this.form = document.getElementById('paymentForm');
        this.mobileInput = document.getElementById('mobile');
        this.amountInput = document.getElementById('amount');
        this.providerSelect = document.getElementById('provider');
        this.customerNameInput = document.getElementById('customerName');
        this.emailInput = document.getElementById('email');
        this.payButton = document.getElementById('payButton');
        this.resultDiv = document.getElementById('result');
        
        // Initialize Firebase
        this.initFirebase();
        
        // Initialize payment handler
        this.init();
        
        // Check if browser supports notifications
        this.checkNotificationSupport();
    }
    
    initFirebase() {
        // Your Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyB2ZzKzKzKzKzKzKzKzKzKzKzKzKzKzKz",
            authDomain: "tanzania-mining-investment.firebaseapp.com",
            databaseURL: "https://tanzania-mining-investment-default-rtdb.firebaseio.com",
            projectId: "tanzania-mining-investment",
            storageBucket: "tanzania-mining-investment.appspot.com",
            messagingSenderId: "123456789012",
            appId: "1:123456789012:web:abcdef1234567890abcdef"
        };
        
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        this.database = firebase.database();
        
        // Load recent transactions
        this.loadRecentTransactions();
        
        // Listen for new transactions in real-time
        this.listenForNewTransactions();
    }
    
    // Check if browser supports notifications
    checkNotificationSupport() {
        // Check if the browser supports notifications
        if (!("Notification" in window)) {
            console.log("This browser does not support desktop notification");
            this.notificationsSupported = false;
        } else {
            this.notificationsSupported = true;
            // Request permission if not already granted
            this.requestNotificationPermission();
        }
    }
    
    // Request notification permission
    requestNotificationPermission() {
        if (this.notificationsSupported && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }
    
    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.setupInputValidation();
    }
    
    setupInputValidation() {
        // Auto-format mobile number
        this.mobileInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            
            // Limit to 12 digits (255 + 9 digits)
            if (value.length > 12) {
                value = value.slice(0, 12);
            }
            
            e.target.value = value;
        });
    }
    
    formatMobileNumber(mobile) {
        // Remove all non-digits
        let formatted = mobile.replace(/\D/g, '');
        
        // Convert local format to international
        if (formatted.startsWith('0')) {
            formatted = '255' + formatted.substring(1);
        } else if (formatted.startsWith('7')) {
            formatted = '255' + formatted;
        }
        
        // Ensure it starts with 255
        if (!formatted.startsWith('255')) {
            formatted = '255' + formatted;
        }
        
        return formatted;
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        // Validate inputs
        if (!this.validateForm()) {
            return;
        }
        
        // Format mobile number
        const mobile = this.formatMobileNumber(this.mobileInput.value);
        const amount = this.amountInput.value;
        const provider = this.providerSelect.value;
        const customerName = this.customerNameInput.value;
        const email = this.emailInput.value || null;
        const reference = 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Show loading state
        this.setLoading(true);
        this.showResult('Processing payment... Please wait.', 'info');
        
        try {
            const response = await fetch('azam.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    mobile: mobile,
                    amount: amount,
                    provider: provider,
                    reference: reference,
                    customerName: customerName,
                    email: email
                })
            });
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Save to Firebase
                await this.savePaymentToFirebase({
                    reference: reference,
                    mobile: mobile,
                    amount: amount,
                    provider: provider,
                    customerName: customerName,
                    email: email,
                    transactionId: data.transactionId,
                    status: 'pending',
                    message: data.message,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
                
                this.showResult(`
                    <strong>Payment initiated successfully!</strong><br>
                    <strong>Transaction ID:</strong> ${data.transactionId}<br>
                    <strong>Message:</strong> ${data.message}<br>
                    <strong>Please check your phone (${mobile}) to complete the payment.</strong>
                `, 'success');
                
                // Clear form
                this.form.reset();
            } else {
                this.showResult(`Payment failed: ${data.message}`, 'error');
            }
            
        } catch (error) {
            console.error('Payment error:', error);
            
            if (error.message === 'Server returned non-JSON response') {
                this.showResult('Server error. Please check if azam.php is configured correctly.', 'error');
            } else {
                this.showResult('Network error. Please check your connection and try again.', 'error');
            }
            
        } finally {
            this.setLoading(false);
        }
    }
    
    async savePaymentToFirebase(paymentData) {
        try {
            // Save to payments node
            const paymentRef = this.database.ref('payments/' + paymentData.reference);
            await paymentRef.set(paymentData);
            
            // Also save to user's payments if email exists
            if (paymentData.email) {
                // Replace dots with commas in email for Firebase key (dots not allowed)
                const userEmailKey = paymentData.email.replace(/\./g, ',');
                const userPaymentRef = this.database.ref(`users/${userEmailKey}/payments/${paymentData.reference}`);
                await userPaymentRef.set(paymentData);
            }
            
            console.log('Payment saved to Firebase');
        } catch (error) {
            console.error('Error saving to Firebase:', error);
        }
    }
    
    loadRecentTransactions() {
        const transactionsRef = this.database.ref('payments');
        
        transactionsRef.orderByChild('timestamp')
            .limitToLast(10)
            .on('value', (snapshot) => {
                const transactions = [];
                snapshot.forEach((childSnapshot) => {
                    transactions.unshift(childSnapshot.val());
                });
                
                this.displayTransactions(transactions);
            });
    }
    
    listenForNewTransactions() {
        const transactionsRef = this.database.ref('payments');
        
        transactionsRef.limitToLast(1).on('child_added', (snapshot) => {
            const newTransaction = snapshot.val();
            this.showTransactionNotification(newTransaction);
        });
    }
    
    displayTransactions(transactions) {
        const transactionsDiv = document.getElementById('recentTransactions');
        
        if (!transactionsDiv) return;
        
        if (transactions.length === 0) {
            transactionsDiv.innerHTML = '<p class="loading-transactions">No transactions yet</p>';
            return;
        }
        
        let html = '';
        transactions.forEach(tx => {
            const date = new Date(tx.timestamp);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            
            // Determine status class
            let statusClass = 'status-pending';
            if (tx.status === 'success') statusClass = 'status-success';
            if (tx.status === 'failed') statusClass = 'status-failed';
            
            html += `
                <div class="transaction-item">
                    <div class="transaction-header">
                        <span class="transaction-reference">${tx.reference ? tx.reference.substring(0, 15) + '...' : 'N/A'}</span>
                        <span class="transaction-amount">TZS ${parseInt(tx.amount).toLocaleString()}</span>
                    </div>
                    <div class="transaction-details">
                        <span>${tx.customerName || 'Anonymous'}</span>
                        <span>${tx.provider || 'N/A'}</span>
                    </div>
                    <div class="transaction-details">
                        <span class="transaction-status ${statusClass}">${tx.status || 'pending'}</span>
                        <span class="transaction-time">${formattedDate}</span>
                    </div>
                </div>
            `;
        });
        
        transactionsDiv.innerHTML = html;
    }
    
    // Fixed notification method - checks if supported first
    showTransactionNotification(transaction) {
        // Only try to show notification if supported and permission granted
        if (this.notificationsSupported && Notification.permission === 'granted') {
            try {
                new Notification('New Payment', {
                    body: `${transaction.customerName || 'Someone'} paid TZS ${parseInt(transaction.amount).toLocaleString()}`,
                    icon: '/favicon.ico', // Optional: add your icon
                    silent: false
                });
            } catch (error) {
                console.log('Notification error:', error);
                // Fail silently - notifications are optional
            }
        }
    }
    
    validateForm() {
        // Validate name
        if (!this.customerNameInput.value.trim()) {
            this.showResult('Please enter your full name', 'error');
            return false;
        }
        
        // Validate mobile
        const mobile = this.mobileInput.value.replace(/\D/g, '');
        if (mobile.length < 9) {
            this.showResult('Please enter a valid mobile number', 'error');
            return false;
        }
        
        // Validate amount
        const amount = parseFloat(this.amountInput.value);
        if (isNaN(amount) || amount < 100) {
            this.showResult('Amount must be at least 100 TZS', 'error');
            return false;
        }
        
        // Validate provider
        if (!this.providerSelect.value) {
            this.showResult('Please select a network provider', 'error');
            return false;
        }
        
        // Validate email if provided
        if (this.emailInput.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(this.emailInput.value)) {
                this.showResult('Please enter a valid email address', 'error');
                return false;
            }
        }
        
        return true;
    }
    
    setLoading(isLoading) {
        const buttonText = this.payButton.querySelector('.button-text');
        const spinner = this.payButton.querySelector('.loading-spinner');
        
        if (isLoading) {
            buttonText.style.display = 'none';
            spinner.style.display = 'inline-block';
            this.payButton.disabled = true;
        } else {
            buttonText.style.display = 'inline-block';
            spinner.style.display = 'none';
            this.payButton.disabled = false;
        }
    }
    
    showResult(message, type) {
        this.resultDiv.style.display = 'block';
        this.resultDiv.className = `result ${type}`;
        this.resultDiv.innerHTML = message;
        
        // Auto-hide success messages after 10 seconds
        if (type === 'success') {
            setTimeout(() => {
                this.resultDiv.style.display = 'none';
            }, 10000);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AzamPayPayment();
});