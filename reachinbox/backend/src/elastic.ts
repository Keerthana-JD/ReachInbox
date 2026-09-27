import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";

dotenv.config();

export const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
});

export const EMAIL_INDEX = "emails";

// Creates the "emails" index if it doesn't exist yet.
// Call this once when the server (or worker) boots up.
export async function ensureEmailIndex() {
  const exists = await esClient.indices.exists({ index: EMAIL_INDEX });

  if (!exists) {
    await esClient.indices.create({
      index: EMAIL_INDEX,
      mappings: {
        properties: {
          id: { type: "keyword" },
          owner_email: { type: "keyword" },
          sender_id: { type: "keyword" },
          recipient_email: { type: "text" },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduled_time: { type: "date" },
          sent_time: { type: "date" },
        },
      },
    });

    console.log(`✅ Created Elasticsearch index "${EMAIL_INDEX}"`);
  }
}

// Adds or updates one email document in the search index.
// We call this every time an email is scheduled, and again every
// time its status changes (sent/failed) - so search always reflects
// the latest state, same as the Postgres row.
export async function indexEmail(email: {
  id: string;
  owner_email: string;
  sender_id: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: string;
  scheduled_time: Date | string;
  sent_time?: Date | string | null;
}) {
  try {
    await esClient.index({
      index: EMAIL_INDEX,
      id: email.id,
      document: email,
      refresh: "wait_for",
    });
  } catch (err: any) {
    // Never let a search-indexing hiccup break actual email scheduling/sending.
    console.error("⚠️ Elasticsearch indexing failed:", err.message);
  }
}

// Full-text search across subject/body/recipient, scoped to one user.
export async function searchEmails(ownerEmail: string, query: string) {
  const result = await esClient.search({
    index: EMAIL_INDEX,
    query: {
      bool: {
        filter: [{ term: { owner_email: ownerEmail } }],
        must: query
          ? [
              {
                multi_match: {
                  query,
                  fields: ["subject", "body", "recipient_email"],
                },
              },
            ]
          : [{ match_all: {} }],
      },
    },
    sort: [{ scheduled_time: { order: "desc" } }],
    size: 100,
  });

  return result.hits.hits.map((hit: any) => hit._source);
}