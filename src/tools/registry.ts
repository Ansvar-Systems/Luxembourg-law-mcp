/**
 * Tool registry for Luxembourg Law MCP Server.
 * Shared between stdio (index.ts) and HTTP (api/mcp.ts) entry points.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import Database from '@ansvar/mcp-sqlite';

import { searchLegislation, SearchLegislationInput } from './search-legislation.js';
import { getProvision, GetProvisionInput } from './get-provision.js';
import { validateCitationTool, ValidateCitationInput } from './validate-citation.js';
import { buildLegalStance, BuildLegalStanceInput } from './build-legal-stance.js';
import { formatCitationTool, FormatCitationInput } from './format-citation.js';
import { checkCurrency, CheckCurrencyInput } from './check-currency.js';
import { getEUBasis, GetEUBasisInput } from './get-eu-basis.js';
import { getLuxembourgImplementations, GetLuxembourgImplementationsInput } from './get-luxembourg-implementations.js';
import { searchEUImplementations, SearchEUImplementationsInput } from './search-eu-implementations.js';
import { getProvisionEUBasis, GetProvisionEUBasisInput } from './get-provision-eu-basis.js';
import { validateEUCompliance, ValidateEUComplianceInput } from './validate-eu-compliance.js';
import { getAbout, type AboutContext } from './about.js';
import { listSources } from './list-sources.js';
export type { AboutContext } from './about.js';

const LIST_SOURCES_TOOL: Tool = {
  name: 'list_sources',
  description:
    'List all data sources with provenance metadata. ' +
    'Returns the authoritative source (Legilux), retrieval method (SPARQL + Akoma Ntoso XML), ' +
    'coverage scope, update frequency, licensing terms, and last ingestion date. ' +
    'Call this first if you need to understand what data this server covers and how current it is. ' +
    'Takes no parameters.',
  inputSchema: { type: 'object', properties: {} },
};

const ABOUT_TOOL: Tool = {
  name: 'about',
  description:
    'Server metadata, dataset statistics, freshness, and provenance. ' +
    'Call this to verify data coverage, currency, and content basis before relying on results.',
  inputSchema: { type: 'object', properties: {} },
};

export const TOOLS: Tool[] = [
  {
    name: 'search_legislation',
    description:
      'Full-text search across Luxembourg statutes and regulations. Uses FTS5 with BM25 ranking. ' +
      'Returns matching provisions with law title, article number, snippet, and relevance score. ' +
      'Supports French legal terminology including accented characters (é, è, ç, etc.). ' +
      'Use this when you need to find provisions by topic or keyword. ' +
      'Do NOT use this if you already know the exact document_id and section — use get_provision instead. ' +
      'Returns at most `limit` results (default 10). Empty results means no match was found, not an error.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query in French. Plain words are auto-wrapped as prefix queries. ' +
            'FTS5 boolean syntax supported: "données AND personnelles", "NOT abrogé". ' +
            'Example: "protection des données" finds data-protection provisions.',
        },
        document_id: {
          type: 'string',
          description: 'Restrict search to a single statute. Use the slug identifier (e.g., "loi-2002-08-02-n2").',
        },
        status: {
          type: 'string',
          enum: ['in_force', 'amended', 'repealed'],
          description: 'Filter by legislative status. Omit to search all statuses.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return. Default: 10, maximum: 50.',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_provision',
    description:
      'Retrieve the full text of a specific provision (article/section) from a Luxembourg statute. ' +
      'Returns the provision content, its position within the statute, and metadata. ' +
      'Use this when you know which statute and section you need. ' +
      'If you only have a topic and need to discover relevant provisions, use search_legislation first. ' +
      'If you omit section/provision_ref, returns all provisions for the statute (can be large).',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description:
            'Statute slug identifier (e.g., "loi-2002-08-02-n2") or partial title for fuzzy matching. ' +
            'Use list_sources or search_legislation to discover valid identifiers.',
        },
        section: {
          type: 'string',
          description: 'Section/article number as a string (e.g., "3", "1er", "I"). Omit to retrieve all sections.',
        },
        provision_ref: {
          type: 'string',
          description: 'Direct provision reference (e.g., "art3"). Alternative to section for exact lookup.',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'validate_citation',
    description:
      'Validate a Luxembourg legal citation against the database. Zero-hallucination check: ' +
      'confirms whether a cited statute and provision actually exist. Returns validation status, ' +
      'the matched document (if any), and confidence level. ' +
      'Use this AFTER generating a citation to verify it is not hallucinated. ' +
      'Do NOT use this for searching — use search_legislation for discovery.',
    inputSchema: {
      type: 'object',
      properties: {
        citation: {
          type: 'string',
          description:
            'Citation string in any format (e.g., "Article 3 de la loi du 2 août 2002", ' +
            '"Section 3, Data Protection Act 2018", "loi-2002-08-02-n2 art3"). ' +
            'French and English citation formats are both supported.',
        },
      },
      required: ['citation'],
    },
  },
  {
    name: 'build_legal_stance',
    description:
      'Build a comprehensive, multi-provision legal analysis for a question across Luxembourg statutes. ' +
      'Searches broadly and returns categorized provisions with full text, organized by relevance. ' +
      'Use this for complex legal research requiring multiple statutory sources. ' +
      'Results are limited to the indexed corpus — not all Luxembourg legislation is covered. ' +
      'Do NOT use this for single-provision lookups — use get_provision instead.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Legal question or topic in French (e.g., "obligations des établissements hospitaliers").',
        },
        document_id: {
          type: 'string',
          description: 'Restrict analysis to a single statute. Omit to search across all legislation.',
        },
        limit: {
          type: 'number',
          description: 'Maximum results per category. Default: 5, maximum: 20.',
          default: 5,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'format_citation',
    description:
      'Format a Luxembourg legal citation per standard conventions. ' +
      'Outputs in full (complete reference), short (abbreviated), or pinpoint (specific provision) format. ' +
      'Use this to standardize citation formatting for legal documents. ' +
      'This is a formatting-only tool — it does NOT validate that the citation exists. ' +
      'Use validate_citation first if you need to verify the citation is real.',
    inputSchema: {
      type: 'object',
      properties: {
        citation: {
          type: 'string',
          description: 'Citation string to format (e.g., "loi-2002-08-02-n2 art3").',
        },
        format: {
          type: 'string',
          enum: ['full', 'short', 'pinpoint'],
          description:
            'Output format. "full": complete formal citation with date and Memorial reference. ' +
            '"short": abbreviated form. "pinpoint": specific article/section reference. Default: "full".',
          default: 'full',
        },
      },
      required: ['citation'],
    },
  },
  {
    name: 'check_currency',
    description:
      'Check whether a Luxembourg statute or provision is currently in force, amended, or repealed. ' +
      'Returns the current status and any known amendment history. ' +
      'IMPORTANT LIMITATION: In-force status is not yet extracted from upstream Legilux metadata — ' +
      'most documents are marked in_force regardless of actual status. Always verify against ' +
      'the official Legilux portal (legilux.public.lu) for authoritative in-force status. ' +
      'Do NOT confuse with validate_citation — this checks legislative status, not citation accuracy.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Statute slug identifier (e.g., "loi-2002-08-02-n2") or partial title.',
        },
        provision_ref: {
          type: 'string',
          description: 'Optional provision reference (e.g., "art3") to check status at provision level.',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_eu_basis',
    description:
      'Get EU legal basis (directives and regulations) that a Luxembourg statute implements or references. ' +
      'Returns CELEX numbers, directive/regulation identifiers, and reference types. ' +
      'Use this to trace Luxembourg law back to its EU origins. ' +
      'For provision-level EU basis, use get_provision_eu_basis instead. ' +
      'Only returns EU references that are indexed in the database — absence does not mean no EU basis exists.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Luxembourg statute slug (e.g., "loi-2018-08-01-n2").',
        },
        include_articles: {
          type: 'boolean',
          description: 'Include specific EU article-level references. Default: false.',
          default: false,
        },
        reference_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by reference type (e.g., ["implements", "amends"]). Omit for all types.',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_luxembourg_implementations',
    description:
      'Find Luxembourg statutes that implement a specific EU directive or regulation. ' +
      'The reverse of get_eu_basis: given an EU instrument, find the national transposition. ' +
      'Use this when an agent needs to know how Luxembourg implemented a specific EU directive. ' +
      'EU document IDs use the format "directive:YYYY/NNN" or "regulation:YYYY/NNN".',
    inputSchema: {
      type: 'object',
      properties: {
        eu_document_id: {
          type: 'string',
          description: 'EU document identifier (e.g., "directive:2016/1148" for NIS Directive, "regulation:2016/679" for GDPR).',
        },
        primary_only: {
          type: 'boolean',
          description: 'Return only primary implementing statutes (not secondary/related). Default: false.',
          default: false,
        },
        in_force_only: {
          type: 'boolean',
          description: 'Exclude repealed or superseded implementations. Default: false.',
          default: false,
        },
      },
      required: ['eu_document_id'],
    },
  },
  {
    name: 'search_eu_implementations',
    description:
      'Search the EU cross-reference index for directives/regulations with Luxembourg implementation data. ' +
      'Use this to discover which EU instruments have been transposed into Luxembourg law. ' +
      'Unlike get_luxembourg_implementations (which requires an exact EU document ID), this supports ' +
      'keyword search across titles and descriptions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keyword search across EU instrument titles (e.g., "data protection", "marchés financiers").',
        },
        type: {
          type: 'string',
          enum: ['directive', 'regulation'],
          description: 'Filter by EU instrument type. Omit to search both.',
        },
        year_from: {
          type: 'number',
          description: 'Filter by publication year (from). Example: 2016.',
        },
        year_to: {
          type: 'number',
          description: 'Filter by publication year (to). Example: 2024.',
        },
        has_luxembourg_implementation: {
          type: 'boolean',
          description: 'If true, only return instruments with at least one Luxembourg implementing statute.',
        },
        limit: {
          type: 'number',
          description: 'Maximum results. Default: 20, maximum: 100.',
          default: 20,
        },
      },
    },
  },
  {
    name: 'get_provision_eu_basis',
    description:
      'Get EU legal basis at the provision level — which EU articles a specific Luxembourg provision implements. ' +
      'More granular than get_eu_basis (which works at statute level). ' +
      'Use this when you need to trace a single article back to its EU source.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Luxembourg statute slug (e.g., "loi-2016-03-15-n3").',
        },
        provision_ref: {
          type: 'string',
          description: 'Provision reference within the statute (e.g., "art1", "3").',
        },
      },
      required: ['document_id', 'provision_ref'],
    },
  },
  {
    name: 'validate_eu_compliance',
    description:
      'Validate whether a Luxembourg statute has complete EU compliance — checks that all referenced EU ' +
      'directives/regulations are properly implemented. Returns compliance status and any gaps. ' +
      'Use this for compliance auditing. Do NOT use this for simple EU cross-reference lookups — ' +
      'use get_eu_basis or get_luxembourg_implementations instead.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Luxembourg statute slug (e.g., "loi-2018-08-01-n2").',
        },
        provision_ref: {
          type: 'string',
          description: 'Check compliance for a specific provision. Omit for statute-level check.',
        },
        eu_document_id: {
          type: 'string',
          description: 'Check compliance specifically against this EU instrument (e.g., "regulation:2016/679").',
        },
      },
      required: ['document_id'],
    },
  },
];

export function buildTools(context?: AboutContext): Tool[] {
  return context ? [...TOOLS, LIST_SOURCES_TOOL, ABOUT_TOOL] : [...TOOLS, LIST_SOURCES_TOOL];
}

export function registerTools(
  server: Server,
  db: InstanceType<typeof Database>,
  context?: AboutContext,
): void {
  const allTools = buildTools(context);

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: allTools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case 'search_legislation':
          result = await searchLegislation(db, args as unknown as SearchLegislationInput);
          break;
        case 'get_provision':
          result = await getProvision(db, args as unknown as GetProvisionInput);
          break;
        case 'validate_citation':
          result = await validateCitationTool(db, args as unknown as ValidateCitationInput);
          break;
        case 'build_legal_stance':
          result = await buildLegalStance(db, args as unknown as BuildLegalStanceInput);
          break;
        case 'format_citation':
          result = await formatCitationTool(args as unknown as FormatCitationInput);
          break;
        case 'check_currency':
          result = await checkCurrency(db, args as unknown as CheckCurrencyInput);
          break;
        case 'get_eu_basis':
          result = await getEUBasis(db, args as unknown as GetEUBasisInput);
          break;
        case 'get_luxembourg_implementations':
          result = await getLuxembourgImplementations(db, args as unknown as GetLuxembourgImplementationsInput);
          break;
        case 'search_eu_implementations':
          result = await searchEUImplementations(db, args as unknown as SearchEUImplementationsInput);
          break;
        case 'get_provision_eu_basis':
          result = await getProvisionEUBasis(db, args as unknown as GetProvisionEUBasisInput);
          break;
        case 'validate_eu_compliance':
          result = await validateEUCompliance(db, args as unknown as ValidateEUComplianceInput);
          break;
        case 'list_sources':
          result = listSources(db);
          break;
        case 'about':
          if (context) {
            result = getAbout(db, context);
          } else {
            return {
              content: [{ type: 'text', text: 'About tool not configured.' }],
              isError: true,
            };
          }
          break;
        default:
          return {
            content: [{ type: 'text', text: `Error: Unknown tool "${name}".` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });
}
