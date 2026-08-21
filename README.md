# mcp-french-transport-data

MCP server for transport.data.gouv.fr: datasets, GTFS resources, regions, networks, and data-quality discovery.

## Tools

Run the MCP and call `french_transport_data_get_sources` first to inspect source coverage. This server also exposes domain-specific tools for the topic described above.

## Install

```bash
npm install
npm run build
npm test
npm run dev
```

## Claude Desktop

```json
{
  "mcpServers": {
    "french-transport-data": {
      "command": "npx",
      "args": ["mcp-french-transport-data"]
    }
  }
}
```

## Sources

- transport.data.gouv.fr: https://transport.data.gouv.fr/
- transport.data.gouv.fr API docs: https://doc.transport.data.gouv.fr/outils/outils-disponibles-sur-le-pan/api
- transport API Swagger: https://transport.data.gouv.fr/swaggerui
- National stops dataset: https://transport.data.gouv.fr/datasets/arrets-de-transport-en-france

## Publishing

See [docs/publishing.md](docs/publishing.md).

## Glama / Docker

The repo includes `Dockerfile` and `glama.json`.

Build steps:

```json
["npm install", "npm run build"]
```

CMD arguments:

```json
["node", "dist/index.js"]
```

## Safety

This MCP helps agents discover and summarize public sources. It is not an official authority. Verify decisions against the competent public service or original data producer.

## License

MIT
