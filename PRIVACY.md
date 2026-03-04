# Privacy & Client Confidentiality

**IMPORTANT FOR LEGAL PROFESSIONALS**

---

## Executive Summary

| Deployment | Data Flow | Privacy Risk |
|------------|-----------|-------------|
| **Remote endpoint** (Vercel) | Query → Vercel → AI client → response | Queries transit cloud infrastructure |
| **Local npm** (`@ansvar/luxembourg-law-mcp`) | Query → local process → local DB → response | No external data transmission |

**Recommended for confidential matters:** Use the local npm package with a self-hosted LLM.

---

## Data Flows

### Remote Endpoint (Vercel + AI Client)

```
User Query → MCP Client (Claude/Cursor) → Anthropic Cloud → MCP Server (Vercel) → Database → Response
```

**What gets transmitted:**
- Query text and tool parameters
- Tool responses (statute text, search results)
- Request metadata (timestamps, IP via Vercel)

**What does NOT get transmitted:**
- Files on your computer
- Your full conversation history (unless using web interfaces)

### Local npm Package

```
User Query → Local MCP Client → Local LLM (optional) → MCP Server (local process) → Local Database → Response
```

**No data leaves your machine** when using `@ansvar/luxembourg-law-mcp` with a local LLM (e.g., Ollama).

---

## Professional Confidentiality

### Barreau de Luxembourg

Luxembourg lawyers are bound by **strict professional secrecy** (secret professionnel) under:
- Law of 10 August 1991 on the legal profession (Loi sur la profession d'avocat)
- Règlement intérieur du Barreau de Luxembourg

When using AI tools for client matters:
- **Do NOT** include client names, case numbers, or identifying facts in queries to cloud endpoints
- **DO** use the local npm package for privileged matters
- **DO** anonymize queries when using cloud-based MCP clients

### GDPR Considerations

Under **GDPR** (applicable in Luxembourg):
- You are the **Data Controller** for any client data in queries
- Cloud providers (Anthropic, Vercel) are **Data Processors**
- A **Data Processing Agreement (DPA)** may be required
- Consider whether client consent is needed for third-party processing

---

## Data Collection by This Tool

### What We Collect

**Nothing.** This MCP server:
- Does NOT log queries
- Does NOT collect user data
- Does NOT track usage
- Does NOT phone home

The database is read-only at runtime. No user data is ever written to the database.

### Third-Party Data Practices

- **Vercel**: See [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy) — request logs, IP addresses
- **Anthropic**: See [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy) — API query logging
- **npm**: Package download statistics only (no query data)

---

## Recommendations by Use Case

### General Legal Research (Low Risk)

Use remote endpoint or local npm with Claude API:
```
Example: "What does Luxembourg law say about data breach notification?"
```
No client-specific information, publicly available legal topics.

### Client-Specific Matters (High Risk)

Use local npm package with self-hosted LLM:
```bash
npm install @ansvar/luxembourg-law-mcp
# Configure with Ollama or LM Studio — no external API calls
```

### On-Premise Deployment

For law firms requiring full data sovereignty:
1. Install `@ansvar/luxembourg-law-mcp` locally
2. Use a self-hosted LLM (Ollama, vLLM)
3. No internet access required after installation
4. Full control over logging and data retention

---

## Security Best Practices

1. **API Key Protection**: Store API keys in secure vault, never in code
2. **Encrypted Storage**: Keep database on encrypted disk
3. **Access Control**: Limit database file permissions
4. **Network Security**: Use VPN or private network for remote endpoints
5. **Audit Trail**: Log Tool usage for client matters (internal records)

---

## Questions

- **Privacy questions**: hello@ansvar.ai
- **Tool-specific**: https://github.com/Ansvar-Systems/Luxembourg-law-mcp/issues

---

**Last Updated**: 2026-02-22
