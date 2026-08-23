#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const CONFIG = {
  "name": "mcp-french-transport-data",
  "prefix": "french_transport_data",
  "description": "MCP server for transport.data.gouv.fr: datasets, GTFS resources, regions, networks, and data-quality discovery.",
  "sources": [
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
  ]
} as const;

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

function jsonResult(data: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function errorResult(message: string): ToolResult {
  const data = { error: message };
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    isError: true,
  };
}

function textFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json,*/*',
      'User-Agent': `${CONFIG.name}/0.1 (+https://github.com/Hug0x0/${CONFIG.name})`,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return response.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,text/plain,application/xml,*/*',
      'User-Agent': `${CONFIG.name}/0.1 (+https://github.com/Hug0x0/${CONFIG.name})`,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return response.text();
}

function dataGouvDatasetSummary(dataset: Record<string, unknown>) {
  return {
    id: dataset.id,
    slug: dataset.slug,
    title: dataset.title,
    page: dataset.page,
    organization: dataset.organization && typeof dataset.organization === 'object'
      ? (dataset.organization as Record<string, unknown>).name
      : undefined,
    resources_count: Array.isArray(dataset.resources) ? dataset.resources.length : undefined,
  };
}

async function searchDataGouv(query: string, pageSize: number) {
  const url = new URL('https://www.data.gouv.fr/api/1/datasets/');
  url.searchParams.set('q', query);
  url.searchParams.set('page_size', String(pageSize));
  const data = await fetchJson<{ data?: Array<Record<string, unknown>>; total?: number }>(url.toString());
  return {
    query,
    total: data.total,
    datasets: (data.data ?? []).map(dataGouvDatasetSummary),
  };
}

function normalizePortalUrl(portalUrl: string): string {
  return portalUrl.replace(/\/$/, '');
}

async function odsRecords(portalUrl: string, dataset: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${normalizePortalUrl(portalUrl)}/api/explore/v2.1/catalog/datasets/${encodeURIComponent(dataset)}/records`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return fetchJson<Record<string, unknown>>(url.toString());
}

function summarizeTransportResource(resource: Record<string, unknown>) {
  const metadata = resource.metadata && typeof resource.metadata === 'object'
    ? resource.metadata as Record<string, unknown>
    : {};
  const stats = metadata.stats && typeof metadata.stats === 'object'
    ? metadata.stats as Record<string, unknown>
    : {};
  return {
    id: resource.id,
    datagouv_id: resource.datagouv_id,
    title: resource.title,
    format: resource.format,
    type: resource.type,
    is_available: resource.is_available,
    updated: resource.updated,
    url: resource.url,
    original_url: resource.original_url,
    page_url: resource.page_url,
    modes: resource.modes,
    features: resource.features,
    coverage_dates: {
      start_date: metadata.start_date,
      end_date: metadata.end_date,
    },
    quality_hints: {
      validator_version: metadata.validator_version,
      issues_count: metadata.issues_count,
      routes_count: stats.routes_count,
      stops_count: stats.stops_count ?? metadata.stops_count,
      trips_count: stats.trips_count,
      wheelchair_info_trips: stats.trips_with_wheelchair_info_count,
      bike_info_trips: stats.trips_with_bike_info_count,
    },
  };
}

const server = new McpServer({ name: CONFIG.name, version: '0.1.0' });

server.tool(
  `${CONFIG.prefix}_get_sources`,
  'List curated sources used by this MCP.',
  {},
  async () => jsonResult({ server: CONFIG.name, description: CONFIG.description, sources: CONFIG.sources })
);

server.tool(
  `${CONFIG.prefix}_fetch_source_excerpt`,
  'Fetch a short text excerpt from a curated source by index or title keyword.',
  {
    source_key: z.string().describe('Source index, title keyword, or URL fragment.'),
    max_chars: z.number().int().min(200).max(4000).default(1200),
  },
  async ({ source_key, max_chars }) => {
    const normalized = source_key.toLowerCase();
    const source = CONFIG.sources.find((item, index) =>
      String(index + 1) === normalized ||
      item.title.toLowerCase().includes(normalized) ||
      item.url.toLowerCase().includes(normalized)
    );
    if (!source) return errorResult(`Unknown source: ${source_key}`);
    try {
      const text = await fetchText(source.url);
      return jsonResult({ source, excerpt: textFromHtml(text).slice(0, max_chars) });
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : 'Failed to fetch source excerpt');
    }
  }
);


server.tool('french_transport_data_search_datasets', 'Search transport.data.gouv.fr datasets by text using the public API.', {
  query: z.string().optional().describe('Text filter applied locally to dataset title/slug after fetching the API list.'),
  limit: z.number().int().min(1).max(100).default(20),
}, async ({ query, limit }) => {
  try {
    const data = await fetchJson<Array<Record<string, unknown>>>('https://transport.data.gouv.fr/api/datasets');
    const normalized = query?.toLowerCase();
    return jsonResult({ query: query ?? 'all', datasets: data.filter((dataset) => !normalized || JSON.stringify(dataset).toLowerCase().includes(normalized)).slice(0, limit) });
  } catch (error) { return errorResult(error instanceof Error ? error.message : 'Failed to search transport datasets'); }
});

server.tool('french_transport_data_get_dataset', 'Fetch one transport.data.gouv.fr dataset by id.', {
  id: z.string().describe('Dataset id from french_transport_data_search_datasets.'),
}, async ({ id }) => {
  try { return jsonResult({ id, dataset: await fetchJson<Record<string, unknown>>(`https://transport.data.gouv.fr/api/datasets/${encodeURIComponent(id)}`) }); }
  catch (error) { return errorResult(error instanceof Error ? error.message : 'Failed to fetch transport dataset'); }
});

server.tool('french_transport_data_list_dataset_resources', 'Extract GTFS, NeTEx, SIRI, and related resources from one transport.data.gouv.fr dataset with quality hints.', {
  id: z.string().describe('Dataset id from french_transport_data_search_datasets.'),
  format: z.string().optional().describe('Optional resource format filter, e.g. GTFS, NeTEx, SIRI.'),
}, async ({ id, format }) => {
  try {
    const dataset = await fetchJson<Record<string, unknown>>(`https://transport.data.gouv.fr/api/datasets/${encodeURIComponent(id)}`);
    const normalizedFormat = format?.toLowerCase();
    const resources = Array.isArray(dataset.resources)
      ? dataset.resources
          .filter((resource) => !normalizedFormat || String(resource.format ?? '').toLowerCase() === normalizedFormat)
          .map(summarizeTransportResource)
      : [];
    return jsonResult({
      id,
      title: dataset.title,
      page_url: dataset.page_url,
      publisher: dataset.publisher,
      resource_count: resources.length,
      resources,
    });
  } catch (error) { return errorResult(error instanceof Error ? error.message : 'Failed to list transport dataset resources'); }
});

server.tool('french_transport_data_search_data_gouv', 'Search data.gouv.fr for mobility datasets such as GTFS, NeTEx, SIRI, stops, and real-time feeds.', {
  query: z.string().default('GTFS transport'),
  page_size: z.number().int().min(1).max(50).default(10),
}, async ({ query, page_size }) => {
  try { return jsonResult(await searchDataGouv(query, page_size)); } catch (error) { return errorResult(error instanceof Error ? error.message : 'Failed to search mobility datasets'); }
});


async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error(`${CONFIG.name} running on stdio`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
