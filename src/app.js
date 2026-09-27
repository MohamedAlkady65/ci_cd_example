const express = require('express');
const sum = require('./sum');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the ci-cd-example API! this 999 release',
    dateTime: new Date().toISOString(),
  });
});

app.post('/sum', (req, res) => {
  const { a, b } = req.body ?? {};

  if (
    typeof a !== 'number' ||
    typeof b !== 'number' ||
    !Number.isFinite(a) ||
    !Number.isFinite(b)
  ) {
    return res.status(400).json({ error: 'Both "a" and "b" must be finite numbers' });
  }

  res.json({ result: sum(a, b) });
});

module.exports = app;
