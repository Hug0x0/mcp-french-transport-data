#!/usr/bin/env node

const sources = [
  [
    "transport.data.gouv.fr",
    "https://transport.data.gouv.fr/"
  ],
  [
    "transport.data.gouv.fr API docs",
    "https://doc.transport.data.gouv.fr/outils/outils-disponibles-sur-le-pan/api"
  ],
  [
    "transport API Swagger",
    "https://transport.data.gouv.fr/swaggerui"
  ],
  [
    "National stops dataset",
    "https://transport.data.gouv.fr/datasets/arrets-de-transport-en-france"
  ]
];
let failures = 0;

for (const [title, url] of sources) {
  try {
    const response = await fetch(url, { headers: { Accept: 'text/html,application/json,*/*', 'User-Agent': 'mcp-french-transport-data-smoke/0.1' } });
    const body = await response.text();
    const ok = response.ok && body.length > 50;
    console.log(`${ok ? 'OK' : 'FAIL'} ${response.status} ${title} ${url}`);
    if (!ok) failures += 1;
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${title} ${url} ${error.message}`);
  }
}

process.exitCode = failures === 0 ? 0 : 1;
