const { readFile } = require('fs').promises;
const express = require('express');
const dotenv = require('dotenv');
const app = express();
const PORT = 8080;

dotenv.config();

// Serve the static files from the 'OnTime' directory
app.use(express.static(__dirname));

// Route for serving the 'index.html' file
app.get('/', async (req, res) => {
  res.send(await readFile('./src/index.html', 'utf8'));
});

app.get('/get-token', async (req, res) => {
  // const response = await fetch('/api/v2/token');
  // const token = await response.text();
  res.send(process.env.API_TOKEN);
  // res.send(token);
});

app.get('/api/v2/token', async (req, res) => {
  res.send(process.env.API_TOKEN);
});


// Start the server
app.listen(process.env.PORT || PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
