import { revalidateTag } from "next/cache";
import { log } from "@/lib/log";
import { waitUntil } from "@vercel/functions";

import type { Organization, Prisma } from "@agentset/db";
import type { Stripe } from "@agentset/stripe";
import { db } from "@agentset/db/client";
import { sendEmail } from "@agentset/emails";
import {
  parseEnterprisePlanMetadata,
  planToOrganizationFields,
} from "@agentset/stripe";
import { getPlanFromPriceId } from "@agentset/stripe/plans";
import { webhookCache } from "@agentset/webhooks/server";

const cancellationReasonMap = {
  customer_service: "you had a bad experience with our customer service",
  low_quality: "the product didn't meet your expectations",
  missing_features: "you were expecting more features",
  switched_service: "you switched to a different service",
  too_complex: "the product was too complex",
  too_expensive: "the product was too expensive",
  unused: "you didn't use the product",
} satisfies Partial<
  Record<Stripe.Subscription.CancellationDetails.Feedback, string>
>;

export async function sendCancellationFeedback({
  owners,
  reason,
}: {
  owners: {
    name: string | null;
    email: string;
  }[];
  reason?: Stripe.Subscription.CancellationDetails.Feedback | null;
}) {
  const reasonText = reason
    ? cancellationReasonMap[reason as keyof typeof cancellationReasonMap]
    : "";

  return await Promise.all(
    owners.map(
      (owner) =>
        owner.email &&
        sendEmail({
          email: owner.email,
          from: "Rfeeq <hello@rfeeq.ai>",
          replyTo: "hello@rfeeq.ai",
          subject: "ملاحظاتك على رفيق",
          /*
           * Signed by the product, not by a person. This carried the name and
           * title of a founder of the upstream project, who has nothing to do
           * with this instance; renaming the company and keeping the signature
           * would attribute the letter to someone who did not write it.
           */
          text: `مرحبًا${owner.name ? ` ${owner.name.split(" ")[0]}` : ""}،\n\nلاحظنا أنك ألغيت اشتراكك في رفيق${reasonText ? `، وذكرت أن ${reasonText}` : ""}. إن كان لديك ما تودّ إخبارنا به ممّا كان يمكن أن نصنعه على نحو أفضل، فيسعدنا أن يصلنا بالردّ على هذه الرسالة.\n\nشكرًا لوقتك.\n\nفريق رفيق`,
        }),
    ),
  );
}

export function revalidateOrganizationCache(organizationId: string) {
  waitUntil(
    (async () => {
      revalidateTag(`org:${organizationId}`, "max");

      const apiKeys = await db.organizationApiKey.findMany({
        where: {
          organizationId,
        },
        select: {
          key: true,
        },
      });

      for (const apiKey of apiKeys) {
        revalidateTag(`apiKey:${apiKey.key}`, "max");
      }
    })(),
  );
}

export async function updateOrganizationPlan({
  event,
  organization,
  items,
}: {
  event: string;
  organization: Pick<Organization, "id" | "plan" | "paymentFailedAt">;
  items: Stripe.SubscriptionItem[];
}) {
  // ignore metered plan
  const priceId = items.filter(
    (item) =>
      item.price.recurring?.usage_type !== "metered" &&
      !item.price.recurring?.meter,
  )[0]?.price.id;

  const newPlan = getPlanFromPriceId(priceId);
  const enterpriseFields = newPlan
    ? null
    : await parseEnterprisePlanMetadata(items);

  let newPlanName: string;
  let planData: Prisma.OrganizationUpdateInput;

  if (newPlan) {
    newPlanName = newPlan.name.toLowerCase();
    planData = planToOrganizationFields(newPlan);
  } else if (enterpriseFields) {
    newPlanName = enterpriseFields.plan.toLowerCase();
    planData = enterpriseFields;
  } else {
    await log({
      message: `Invalid price ID in ${event} event: ${priceId}`,
      type: "errors",
    });
    return;
  }

  const shouldDisableWebhooks = newPlanName === "free";

  if (organization.plan !== newPlanName) {
    await db.organization.update({
      where: {
        id: organization.id,
      },
      data: {
        paymentFailedAt: null,
        ...planData,
        ...(shouldDisableWebhooks && { webhookEnabled: false }),
      },
      select: {
        id: true,
      },
    });

    revalidateOrganizationCache(organization.id);

    // Disable the webhooks if the new plan does not support webhooks
    if (shouldDisableWebhooks) {
      await db.webhook.updateMany({
        where: {
          organizationId: organization.id,
        },
        data: {
          disabledAt: new Date(),
        },
      });

      await webhookCache.invalidateOrg(organization.id);
    }
  } else if (organization.paymentFailedAt) {
    await db.organization.update({
      where: {
        id: organization.id,
      },
      data: {
        paymentFailedAt: null,
      },
    });
  }
}
