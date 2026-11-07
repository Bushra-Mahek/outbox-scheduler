
import {
  elasticClient,
  EMAIL_INDEX
} from "../config/elasticsearch.js";

export interface EmailSearchDocument {
  emailId: string;
  campaignId: string | null;
  campaignName: string | null;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
}

export const indexEmail = async (
  email: EmailSearchDocument
): Promise<void> => {
  await elasticClient.index({
    index: EMAIL_INDEX,
    id: email.emailId,
    document: email,
    refresh: "wait_for"
  });
};

export const updateIndexedEmailStatus = async (
  emailId: string,
  status: string,
  sentAt: string | null = null
): Promise<void> => {
  const exists = await elasticClient.exists({
    index: EMAIL_INDEX,
    id: emailId
  });

  if (!exists) return;

  await elasticClient.update({
    index: EMAIL_INDEX,
    id: emailId,
    doc: {
      status,
      ...(sentAt ? { sentAt } : {})
    },
    refresh: "wait_for"
  });
};

export const searchEmails = async (options: {
  query?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) => {
  const {
    query = "",
    status,
    from,
    to,
    page = 1,
    limit = 20
  } = options;

  const filters: object[] = [];

  if (status) {
    filters.push({
      term: { status }
    });
  }

  if (from || to) {
    filters.push({
      range: {
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {})
        }
      }
    });
  }

  const result = await elasticClient.search<EmailSearchDocument>({
    index: EMAIL_INDEX,
    from: (page - 1) * limit,
    size: limit,
    query: {
      bool: {
        must: query
          ? [{
              multi_match: {
                query,
                fields: [
                  "recipient",
                  "subject",
                  "body",
                  "campaignName"
                ],
                fuzziness: "AUTO"
              }
            }]
          : [{ match_all: {} }],
        filter: filters
      }
    },
    sort: [{ createdAt: "desc" }]
  });

  return {
    total: result.hits.total,
    emails: result.hits.hits.map((hit) => ({
      ...hit._source,
      score: hit._score
    }))
  };
};
