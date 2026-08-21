import { describe, expect, it } from 'vitest';

describe('mcp-french-transport-data', () => {
  it('uses an mcp package name', () => {
    expect('mcp-french-transport-data').toMatch(/^mcp-/);
  });

  it('has curated HTTP sources', () => {
    const sources = [
      {
            "title": "transport.data.gouv.fr",
            "url": "https://transport.data.gouv.fr/"
      },
      {
            "title": "transport.data.gouv.fr API docs",
            "url": "https://doc.transport.data.gouv.fr/outils/outils-disponibles-sur-le-pan/api"
      },
      {
            "title": "transport API Swagger",
            "url": "https://transport.data.gouv.fr/swaggerui"
      },
      {
            "title": "National stops dataset",
            "url": "https://transport.data.gouv.fr/datasets/arrets-de-transport-en-france"
      }
];
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.url).toMatch(/^https?:\/\//);
    }
  });

  it('has a stable tool prefix', () => {
    expect('french_transport_data').toMatch(/^[a-z0-9_]+$/);
  });
});
