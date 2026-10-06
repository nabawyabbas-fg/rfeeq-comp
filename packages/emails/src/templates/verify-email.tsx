import { Section, Text } from "@react-email/components";

import { Button } from "../components/button";
import { DefaultLayout } from "../components/default-layout";

const VerifyEmail = ({
  verifyLink = "https://stg.rfeeq.ai/api/auth/verify-email",
  email = "john@doe.com",
  domain = "https://stg.rfeeq.ai",
}: {
  verifyLink: string;
  email: string;
  domain?: string;
}) => {
  return (
    <DefaultLayout
      preview="Confirm your email address"
      footer={{ email, domain }}
    >
      <Text className="text-sm leading-6 text-black">
        Confirm this address to finish setting up your account.
      </Text>

      <Section className="my-6">
        <Button href={verifyLink}>Confirm email address</Button>
      </Section>

      <Text className="text-sm leading-6 text-black">
        or copy and paste this URL into your browser:
      </Text>
      <Text className="max-w-sm flex-wrap font-medium break-words text-purple-600 no-underline">
        {verifyLink.replace(/^https?:\/\//, "")}
      </Text>

      <Text className="text-sm leading-6 text-black">
        If you did not create an account, you can ignore this email — no account
        is usable until this address is confirmed.
      </Text>
    </DefaultLayout>
  );
};

export default VerifyEmail;
