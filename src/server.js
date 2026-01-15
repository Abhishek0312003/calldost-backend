import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import { app } from './app.js';

import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';

/* ============================================================
   MODEL IMPORTS (ORDERED SYNCHRONIZATION)
============================================================ */

import SuperAdmin from './models/superAdmin.model.js';
import Admin from './models/admin.model.js';
import EducationComplaint from './models/educationComplaint.model.js';
import HealthComplaint from './models/healthComplaint.model.js';
import ApiKey from './models/apiKey.model.js';
import BiharDistrict from './models/biharDistrict.model.js';
const PORT = process.env.PORT || 4000;

let httpServer;

/* ============================================================
   DATABASE SYNCHRONIZATION
============================================================ */

const synchronizeDatabase = async () => {
  console.log('Starting database synchronization sequence');

  await SuperAdmin.sync({ alter: true });
  console.log('Super Admin table synchronized (alter mode)');

  await Admin.sync({ alter: true });
  console.log('Admin table synchronized (alter mode)');

  await EducationComplaint.sync({ alter: true });
  console.log('Education Complaint table synchronized (alter mode)');

  await HealthComplaint.sync({ alter: true });
  console.log('Health Complaint table synchronized (alter mode)');

  await ApiKey.sync({ alter: true });
  console.log('API Key table synchronized (alter mode)');


  await BiharDistrict.sync({ alter: true });
  console.log('API Key table synchronized (alter mode)');

  console.log('All database tables synchronized successfully');
};

/* ============================================================
   SERVER STARTUP
============================================================ */

const startServer = async () => {
  try {
    console.log('Initializing Caldost Backend System');

    await connectDB();
    console.log('PostgreSQL connection established');

    await connectRedis();
    console.log('Redis connection established');

    await synchronizeDatabase();

    httpServer = createServer(app);

    httpServer.listen(PORT, () => {
      console.log(`Caldost Backend System is running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Server startup failed');
    console.error(error);
    process.exit(1);
  }
};

/* ============================================================
   GRACEFUL SHUTDOWN
============================================================ */

const shutdownServer = async (signal) => {
  console.log(`Shutdown signal received: ${signal}`);
  console.log('Initiating graceful shutdown');

  try {
    if (httpServer) {
      httpServer.close(() => {
        console.log('HTTP server closed');
      });
    }
  } catch (err) {
    console.error('Error during server shutdown');
    console.error(err);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', shutdownServer);
process.on('SIGTERM', shutdownServer);

/* ============================================================
   BOOTSTRAP
============================================================ */

startServer();
