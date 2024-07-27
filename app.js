const API_URL = 'http://localhost:4000/graphql';

// Helper function to make GraphQL requests
async function graphqlRequest(query, variables = {}) {
    const response = await axios.post(API_URL, {
        query,
        variables
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });
    return response.data;
}

// Login function
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
    localStorage.setItem('token', result.data.login.token);
    localStorage.setItem('userId', result.data.login.user.id);
    return result.data.login.user;
}

// Register function
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
    localStorage.setItem('token', result.data.register.token);
    localStorage.setItem('userId', result.data.register.user.id);
    return result.data.register.user;
}

// Get user accounts
async function getUserAccounts() {
    const query = `
        query GetUserAccounts {
            accounts(where: {user_id: {_eq: "${localStorage.getItem('userId')}"}}) {
                id
                account_type
                balance
            }
        }
    `;
    const result = await graphqlRequest(query);
    return result.data.accounts;
}

// Create a new account
async function createAccount(accountType) {
    const query = `
        mutation CreateAccount($user_id: Int!, $account_type: String!) {
            insert_accounts_one(object: {user_id: $user_id, account_type: $account_type}) {
                id
                account_type
                balance
            }
        }
    `;
    const result = await graphqlRequest(query, {
        user_id: parseInt(localStorage.getItem('userId')),
        account_type: accountType
    });
    return result.data.insert_accounts_one;
}

// Perform a transaction
async function performTransaction(accountId, amount, type, description) {
    const query = `
        mutation PerformTransaction($account_id: Int!, $amount: numeric!, $transaction_type: String!, $description: String) {
            insert_transactions_one(object: {account_id: $account_id, amount: $amount, transaction_type: $transaction_type, description: $description}) {
                id
                amount
                transaction_type
                description
            }
            update_accounts(where: {id: {_eq: $account_id}}, _inc: {balance: $amount}) {
                affected_rows
            }
        }
    `;
    const result = await graphqlRequest(query, {
        account_id: accountId,
        amount: type === 'deposit' ? amount : -amount,
        transaction_type: type,
        description
    });
    return result.data;
}

// UI logic
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

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        dashboard.style.display = 'none';
        loginBtn.style.display = 'inline';
        registerBtn.style.display = 'inline';
        logoutBtn.style.display = 'none';
    });

    // document.getElementById('submitLogin').addEventListener('click', async () => {
    //     const username = document.getElementById('loginUsername').value;
    //     const password = document.getElementById('loginPassword').value;
    //     try {
    //         await login(username, password);
    //         showDashboard();
    //     } catch (error) {
    //         alert('Login failed. Please try again.');
    //     }
    // });

    // document.getElementById('submitRegister').addEventListener('click', async () => {
    //     const username = document.getElementById('registerUsername').value;
    //     const email = document.getElementById('registerEmail').value;
    //     const password = document.getElementById('registerPassword').value;
    //     try {
    //         await register(username, email, password);
    //         showDashboard();
    //     } catch (error) {
    //         alert('Registration failed. Please try again.');
    //     }
    // });

    document.getElementById('createAccountBtn').addEventListener('click', async () => {
        const accountType = prompt('Enter account type (e.g., savings, checking):');
        if (accountType) {
            try {
                await createAccount(accountType);
                showDashboard();
            } catch (error) {
                alert('Failed to create account. Please try again.');
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
                await performTransaction(parseInt(accountId), amount, type, description);
                showDashboard();
            } catch (error) {
                alert('Transaction failed. Please try again.');
            }
        } else {
            alert('Please fill in all transaction details.');
        }
    });

    async function showDashboard() {
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        dashboard.style.display = 'block';
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        logoutBtn.style.display = 'inline';

        const accounts = await getUserAccounts();
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
    }

    // Check if user is already logged in
    if (localStorage.getItem('token')) {
        showDashboard();
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
    console.log(username, email, password);
    try {
        const user = await register(username, email, password);
        showDashboard();
    } catch (error) {
        console.error('Registration error:', error);
        alert(`Registration failed: ${error.message}`);
    }
});

