import serverless from 'serverless-http';
import app from '../server/server.js';

export default serverless(app);
