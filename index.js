const express = require('express');
const dotenv = require('dotenv');
const yieldRouter = require('./src/routes/yield');
const cors = require('cors');
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3333;

app.use(express.json());
app.use('/api/yield', yieldRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
