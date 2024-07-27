const API_URL = 'http://localhost:4000/graphql';

// Helper function to make GraphQL requests
async function graphqlRequest(query, variables = {}) {
    const token = localStorage.getItem('token');
    const response = await axios.post(API_URL, {
        query,
        variables
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        }
    });
    if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
    }
    return response.data;
}

// Helper function to decode JWT token
function decodeToken(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

async function showDashboard() {
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
    dashboard.style.display = 'block';
    loginBtn.style.display = 'none';
    registerBtn.style.display = 'none';
    logoutBtn.style.display = 'inline';

    try {
        const accounts = await getUserAccounts();
        console.log(accounts);
        const accountsList = document.getElementById('accountsList');
        const accountSelect = document.getElementById('accountSelect');
        
        accountsList.innerHTML = '';
        accountSelect.innerHTML = '';
        
        accounts.forEach(account => {
            accountsList.innerHTML += `
                <div>
                    <h3>${account.account_type}</h3>
                    <p>Balance: $${account.balance.toFixed(2)}</p>
                </div>
            `;
            accountSelect.innerHTML += `
                <option value="${account.id}">${account.account_type}</option>
            `;
        });

        document.getElementById('transactionForm').style.display = 'block';
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        alert('Failed to load dashboard. Please try logging in again.');
        logout();
    }
}

async function getUserAccounts() {
    const query = `
        query GetUserAccounts {
            getUserAccounts {
                id
                account_type
                balance
            }
        }
    `;
    try {
        const result = await graphqlRequest(query);
        console.log('GetUserAccounts result:', result); // Debug log
        if (result.data && result.data.getUserAccounts) {
            return result.data.getUserAccounts;
        } else {
            console.error('Unexpected response structure:', result);
            return [];
        }
    } catch (error) {
        console.error('Error in getUserAccounts:', error);
        throw error;
    }
}

async function login(username, password) {
    const query = `
        mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
                token
                user {
                    id
                    username
                }
            }
        }
    `;
    const result = await graphqlRequest(query, { username, password });
    const { token, user } = result.data.login;
    localStorage.setItem('token', token);
    const decodedToken = decodeToken(token);
    if (decodedToken && decodedToken.userId) {
        localStorage.setItem('userId', decodedToken.userId);
    }
    return user;
}

async function register(username, email, password) {
    const query = `
        mutation Register($username: String!, $email: String!, $password: String!) {
            register(username: $username, email: $email, password: $password) {
                token
                user {
                    id
                    username
                }
            }
        }
    `;
    const result = await graphqlRequest(query, { username, email, password });
    const { token, user } = result.data.register;
    localStorage.setItem('token', token);
    const decodedToken = decodeToken(token);
    if (decodedToken && decodedToken.userId) {
        localStorage.setItem('userId', decodedToken.userId);
    }
    return user;
}

async function createAccount(accountType) {
    const query = `
        mutation CreateAccount($accountType: String!) {
            createAccount(accountType: $accountType) {
                id
                account_type
                balance
            }
        }
    `;
    const result = await graphqlRequest(query, { accountType });
    return result.data.createAccount;
}

async function performTransaction(accountId, amount, type, description) {
    const query = `
        mutation PerformTransaction($accountId: Int!, $amount: Int!, $type: String!, $description: String) {
            performTransaction(accountId: $accountId, amount: $amount, type: $type, description: $description) {
                id
                amount
                transaction_type
                description
            }
        }
    `;
    const result = await graphqlRequest(query, { accountId: parseInt(accountId), amount: parseInt(amount), type, description });
    return result.data.performTransaction;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
    dashboard.style.display = 'none';
    loginBtn.style.display = 'inline';
    registerBtn.style.display = 'inline';
    logoutBtn.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const dashboard = document.getElementById('dashboard');

    loginBtn.addEventListener('click', () => {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        dashboard.style.display = 'none';
    });

    registerBtn.addEventListener('click', () => {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        dashboard.style.display = 'none';
    });

    logoutBtn.addEventListener('click', logout);

    document.getElementById('createAccountBtn').addEventListener('click', async () => {
        const accountType = prompt('Enter account type (e.g., savings, checking):');
        if (accountType) {
            try {
                const newAccount = await createAccount(accountType);
                console.log('New account created:', newAccount);
                showDashboard();
            } catch (error) {
                console.error('Failed to create account:', error);
                alert(`Failed to create account: ${error.message}`);
            }
        }
    });

    document.getElementById('submitTransaction').addEventListener('click', async () => {
        const accountId = document.getElementById('accountSelect').value;
        const amount = parseFloat(document.getElementById('transactionAmount').value);
        const type = document.getElementById('transactionType').value;
        const description = document.getElementById('transactionDescription').value;
        
        if (accountId && amount && type) {
            try {
                await performTransaction(accountId, amount, type, description);
                alert('Transaction successful');
                showDashboard();
            } catch (error) {
                console.error('Transaction failed:', error);
                alert(`Transaction failed: ${error.message}`);
            }
        } else {
            alert('Please fill in all transaction details.');
        }
    });

    document.getElementById('submitLogin').addEventListener('click', async () => {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        try {
            const user = await login(username, password);
            showDashboard();
        } catch (error) {
            console.error('Login error:', error);
            alert(`Login failed: ${error.message}`);
        }
    });

    document.getElementById('submitRegister').addEventListener('click', async () => {
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        try {
            const user = await register(username, email, password);
            showDashboard();
        } catch (error) {
            console.error('Registration error:', error);
            alert(`Registration failed: ${error.message}`);
        }
    });

    // Check if user is already logged in
    if (localStorage.getItem('token')) {
        showDashboard();
    }
});