const express = require('express');
const path = require('path');
const catalog = require('./data/catalog.json');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/catalog', (req, res) => res.json(catalog));

// Rules engine: all rules live in data/catalog.json (edit there, no code changes)
app.post('/api/configure', (req, res) => {
  const { crop, rows, spacing, areaHa, daysWindow } = req.body;
  const r = catalog.rules;
  if (!catalog.crops[crop] || !(rows > 0) || !(spacing > 0) || !(areaHa > 0) || !(daysWindow > 0))
    return res.status(400).json({ error: 'Fill in crop, rows, spacing, area and planting window with positive values.' });
  const workWidth = rows * spacing / 100;                       // m
  const haPerDay = workWidth * r.speedKmh * r.hoursPerDay * r.efficiency / 10;
  const machines = Math.max(1, Math.ceil(areaHa / (haPerDay * daysWindow)));
  const ctx = { row: rows * machines, machine: machines, tractor: machines };
  const lines = [];
  for (const it of catalog.items) {
    if (it.crops && !it.crops.includes(crop)) continue;
    if (it.minSpacing && spacing < it.minSpacing) continue;
    const qty = Math.ceil((ctx[it.per] || 1) * it.n);
    lines.push({ code: it.code, name: it.name, qty, unit: it.price, total: qty * it.price, note: it.note || '' });
  }
  const total = lines.reduce((s, l) => s + l.total, 0);
  const warnings = [];
  if (machines > 1) warnings.push(`One machine covers ${haPerDay.toFixed(1)} ha/day; ${machines} are needed to finish ${areaHa} ha in ${daysWindow} days.`);
  if (spacing < r.minSpacingRecommended) warnings.push(`Spacing under ${r.minSpacingRecommended} cm: confirm tractor and wheel clearance.`);
  res.json({ input: req.body, haPerDay, machines, lines, total, warnings, currency: catalog.currency, date: new Date().toISOString() });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`AgriConfig running on http://localhost:${port}`));
