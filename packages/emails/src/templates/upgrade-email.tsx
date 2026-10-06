import { Heading, Link, Text } from "@react-email/components";

import { DefaultLayout } from "../components/default-layout";

export function UpgradeEmail({
  name = "John Doe",
  email = "john@doe.com",
  plan = {
    name: "Pro",
    features: [],
  },
  domain = "https://stg.rfeeq.ai",
}: {
  name: string | null;
  email: string;
  plan: {
    name: string;
    features?: {
      text: string;
      disabled?: boolean;
      tooltip?: { title: string; cta: string; href: string };
    }[];
  };
  domain?: string;
}) {
  const finalFeatures = plan.features
    ? plan.features.filter((feature) => !feature.disabled)
    : [];

  return (
    <DefaultLayout
      preview={`شكرًا لترقيتك إلى رفيق ${plan.name}`}
      footer={{ email, domain }}
    >
      <Heading className="mx-0 my-7 p-0 text-xl font-medium text-black">
        شكرًا لترقيتك إلى رفيق {plan.name}
      </Heading>

      <Text className="text-sm leading-6 text-black">
        مرحبًا{name && ` ${name}`}،
      </Text>
      {/* signed by the product, never by a named person — see welcome-email */}
      <Text className="text-sm leading-6 text-black">
        شكرًا لترقيتك إلى <strong>رفيق {plan.name}</strong>.
      </Text>
      {finalFeatures.length > 0 ? (
        <>
          <Text className="text-sm leading-6 text-black">
            في خطة {plan.name} صار متاحًا لك:
          </Text>
          {finalFeatures.map((feature) => (
            <Text className="ml-1 text-sm leading-4 text-black">
              ◆{" "}
              {feature.tooltip?.href ? (
                <Link href={feature.tooltip.href}>{feature.text}</Link>
              ) : (
                feature.text
              )}
            </Text>
          ))}
        </>
      ) : null}

      <Text className="text-sm leading-6 text-black">
        وإن كان لديك سؤال أو ملاحظة، فيسعدنا أن تصلنا بالردّ على هذه الرسالة.
      </Text>

      <Text className="text-sm leading-6 font-light text-neutral-400">
        فريق رفيق
      </Text>
    </DefaultLayout>
  );
}

export default UpgradeEmail;
