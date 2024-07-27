import express from 'express';
import { ApolloServer, gql } from 'apollo-server-express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();

app.use(cors());

const { ApolloClient, InMemoryCache, HttpLink, ApolloLink } = await import('@apollo/client/core/index.js');
const { setContext } = await import('@apollo/client/link/context/index.js');

// Apollo Client setup
const httpLink = new HttpLink({
  uri: process.env.HASURA_GRAPHQL_ENDPOINT || 'http://localhost:8080/v1/graphql',
  fetch,
});

const authLink = setContext((_, { headers }) => {
  const token = process.env.HASURA_GRAPHQL_ADMIN_SECRET;
  return {
    headers: {
      ...headers,
      "x-hasura-admin-secret": token,
    }
  };
});

const client = new ApolloClient({
  link: ApolloLink.from([authLink, httpLink]),
  cache: new InMemoryCache()
});

const typeDefs = gql`
  type Account {
    id: Int!
    account_type: String!
    balance: Int!
  }

  type Query {
    hello: String!
    getUserAccounts: [Account!]!
  }

  type Mutation {
    register(username: String!, email: String!, password: String!): AuthPayload!
    login(username: String!, password: String!): AuthPayload!
    createAccount(accountType: String!): Account!
    performTransaction(accountId: Int!, amount: Int!, type: String!, description: String): Transaction!
  }

  type User {
    id: Int!
    username: String!
    email: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Transaction {
    id: Int!
    amount: Int!
    transaction_type: String!
    description: String
  }
`;

function getUserId(token) {
  if (token) {
    try {
      const { userId } = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
      return userId;
    } catch (error) {
      return null;
    }
  }
  return null;
}

const resolvers = {
  Query: {
    hello: () => 'Hello world!',
    getUserAccounts: async (_, __, { client, userId }) => {
      if (!userId) {
        console.log('User not authenticated'); // Debug log
        throw new Error('User not authenticated');
      }
      try {
        console.log('Fetching accounts for userId:', userId); // Debug log
        const result = await client.query({
          query: gql`
            query GetUserAccounts($userId: Int!) {
              accounts(where: { user_id: { _eq: $userId } }) {
                id
                account_type
                balance
              }
            }
          `,
          variables: { userId },
        });

        if (result.errors) {
          console.error('GraphQL errors:', result.errors); // Debug log
          throw new Error(result.errors[0].message);
        }

        console.log('Fetched accounts:', result.data.accounts); // Debug log
        return result.data.accounts;
      } catch (error) {
        console.error('GetUserAccounts error:', error);
        throw new Error('Failed to fetch user accounts: ' + error.message);
      }
    },
  },
  Mutation: {
    register: async (_, { username, email, password }, { client }) => {
      try {
        console.log('Attempting to register user:', { username, email });
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await client.mutate({
          mutation: gql`
            mutation RegisterUser($username: String!, $email: String!, $password: String!) {
              insert_users_one(object: {username: $username, email: $email, password: $password}) {
                id
                username
                email
              }
            }
          `,
          variables: { username, email, password: hashedPassword },
        });
    
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }
    
        const user = result.data.insert_users_one;
        if (!user) {
          throw new Error('User creation failed');
        }
    
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    
        return { token, user };
      } catch (error) {
        console.error('Registration error:', error);
        throw new Error('Registration failed: ' + error.message);
      }
    },
    login: async (_, { username, password }, { client }) => {
      try {
        const result = await client.query({
          query: gql`
            query GetUser($username: String!) {
              users(where: {username: {_eq: $username}}) {
                id
                username
                email
                password
              }
            }
          `,
          variables: { username },
        });

        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        const user = result.data.users[0];
        if (!user) {
          throw new Error('User not found');
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          throw new Error('Invalid password');
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);

        return { token, user: { id: user.id, username: user.username, email: user.email } };
      } catch (error) {
        console.error('Login error:', error);
        throw new Error('Login failed: ' + error.message);
      }
    },
    createAccount: async (_, { accountType }, { client, userId }) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      try {
        const result = await client.mutate({
          mutation: gql`
            mutation CreateAccount($user_id: Int!, $accountType: String!) {
              insert_accounts_one(object: { user_id: $user_id, account_type: $accountType, balance: 0 }) {
                id
                account_type
                balance
              }
            }
          `,
          variables: { user_id: userId, accountType },
        });
    
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }
    
        return result.data.insert_accounts_one;
      } catch (error) {
        console.error('CreateAccount error:', error);
        throw new Error('Failed to create account: ' + error.message);
      }
    },
    
    performTransaction: async (_, { accountId, amount, type, description }, { client, userId }) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      try {
        const result = await client.mutate({
          mutation: gql`
            mutation PerformTransaction($accountId: Int!, $amount: Int!, $type: String!, $description: String) {
              insert_transactions_one(object: { account_id: $accountId, amount: $amount, transaction_type: $type, description: $description }) {
                id
                amount
                transaction_type
                description
              }
              update_accounts(where: { id: { _eq: $accountId } }, _inc: { balance: $amount }) {
                affected_rows
              }
            }
          `,
          variables: { accountId, amount: type === 'deposit' ? amount : -amount, type, description },
        });

        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return result.data.insert_transactions_one;
      } catch (error) {
        console.error('PerformTransaction error:', error);
        throw new Error('Transaction failed: ' + error.message);
      }
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const token = req.headers.authorization || '';
    const userId = getUserId(token);
    console.log('Context created with userId:', userId); // Debug log
    return {
      client,
      userId,
    };
  },
});

async function startServer() {
  await server.start();
  server.applyMiddleware({ app });

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}${server.graphqlPath}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start the server:', error);
});

export default app;