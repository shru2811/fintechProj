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

// Apollo Client setup (unchanged)
// ...

const typeDefs = gql`
  type User {
    id: ID!
    username: String!
    email: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    hello: String
  }

  type Mutation {
    register(username: String!, email: String!, password: String!): AuthPayload
    login(username: String!, password: String!): AuthPayload
  }
`;

const resolvers = {
  Query: {
    hello: () => 'Hello world!',
  },
  Mutation: {
    register: async (_, { username, email, password }, { client }) => {
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

      const user = result.data.insert_users_one;
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);

      return { token, user };
    },
    login: async (_, { username, password }, { client }) => {
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
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    return {
      client,
    };
  },
});

// ... (rest of the file remains the same)