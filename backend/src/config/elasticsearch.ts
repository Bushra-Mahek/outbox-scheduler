
import { Client } from "@elastic/elasticsearch";

const node = process.env.ELASTICSEARCH_URL;

if (!node) {
  throw new Error("ELASTICSEARCH_URL is missing from environment variables");
}

export const elasticClient = new Client({
  node,
  requestTimeout: 10000,
  maxRetries: 3
});

export const EMAIL_INDEX =
  process.env.ELASTICSEARCH_INDEX || "outbox-emails";

export const initializeElasticsearch = async (): Promise<void> => {
  const health = await elasticClient.cluster.health();

  console.log(
    `Elasticsearch connected successfully. Status: ${health.status}`
  );

  const exists = await elasticClient.indices.exists({
    index: EMAIL_INDEX
  });

  if (!exists) {
    await elasticClient.indices.create({
      index: EMAIL_INDEX,
      mappings: {
        properties: {
          emailId: { type: "keyword" },
          campaignId: { type: "keyword" },
          campaignName: {
            type: "text",
            fields: {
              keyword: { type: "keyword" }
            }
          },
          recipient: { type: "keyword" },
          subject: {
            type: "text",
            fields: {
              keyword: { type: "keyword" }
            }
          },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduledAt: { type: "date" },
          sentAt: { type: "date" },
          createdAt: { type: "date" }
        }
      }
    });

    console.log(`Elasticsearch index created: ${EMAIL_INDEX}`);
  }
};
