import { createDocument } from "zod-openapi";

import { webhookEventSchema } from "@agentset/webhooks";

import { v1Paths } from "./v1";

export const createOpenApiDocument = () => {
  return createDocument({
    openapi: "3.1.1",
    info: {
      title: "RfeeqAPI",
      description: "Rfeeq is retrieval over Islamic scholarship with citations",
      version: "0.0.1",
      contact: {
        name: "Rfeeq Support",
        email: "support@rfeeq.ai",
        url: "https://comp.rfeeq.ai/",
      },
      license: {
        name: "MIT License",
        url: "https://comp.rfeeq.ai/LICENSE.md",
      },
    },
    servers: [
      {
        url: "https://comp.rfeeq.ai",
        description: "Production API",
      },
    ],
    "x-speakeasy-globals": {
      parameters: [
        {
          $ref: "#/components/parameters/NamespaceIdRef",
        },
        {
          $ref: "#/components/parameters/TenantIdRef",
        },
      ],
    },
    paths: {
      ...v1Paths,
    },
    components: {
      schemas: {
        webhookEventSchema,
      },
      securitySchemes: {
        token: {
          type: "http",
          description: "Default authentication mechanism",
          scheme: "bearer",
          "x-speakeasy-example": "AGENTSET_API_KEY",
        },
      },
    },
  });
};
