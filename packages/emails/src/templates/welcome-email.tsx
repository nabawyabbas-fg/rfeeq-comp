import { Heading, Text } from "@react-email/components";

import { DefaultLayout } from "../components/default-layout";

export function WelcomeEmail({
  name = "John Doe",
  email = "john@doe.com",
  domain = "https://stg.rfeeq.ai",
}: {
  name: string | null;
  email: string;
  domain: string;
}) {
  return (
    <DefaultLayout preview="أهلًا بك في رفيق" footer={{ email, domain }}>
      <Heading className="mx-0 my-7 p-0 text-xl font-medium text-black">
        أهلًا بك في رفيق
      </Heading>

      <Text className="text-sm leading-6 text-black">
        شكرًا لتسجيلك{name && `، ${name}`}.
      </Text>

      {/*
        * No personal byline.
        *
        * This letter used to be signed by name — a founder of the upstream
        * project, who has nothing to do with this instance. Swapping the company
        * name and keeping the signature would have put words in a named
        * individual's mouth, which is worse than the branding leak it was meant
        * to fix. It is signed by the product instead, and the name is not ours
        * to carry around in a comment either.
        */}
      <Text className="text-sm leading-6 text-black">
        رفيق أداةٌ للبحث في المحتوى الإسلامي من مصادره المعتمدة: نصُّ القرآن
        وتفاسيره، وموسوعات الحديث بأحكام المحدّثين، والموسوعات الفقهية — بكل
        جوابٍ منسوبًا إلى مصدره.
      </Text>

      <Text className="text-sm leading-6 text-black">
        ممّا يمكنك البدء به:
      </Text>

      <Text className="ml-1 text-sm leading-4 text-black">
        ◆ اسأل عن تفسير آية
      </Text>

      <Text className="ml-1 text-sm leading-4 text-black">
        ◆ تحقّق من درجة حديث
      </Text>

      <Text className="ml-1 text-sm leading-4 text-black">
        ◆ اسأل عن مسألة فقهية عامة
      </Text>

      <Text className="text-sm leading-6 text-black">
        وإن كان لديك سؤال أو ملاحظة، فيسعدنا أن تصلنا بالردّ على هذه الرسالة.
      </Text>

      <Text className="text-sm leading-6 font-light text-neutral-400">
        فريق رفيق
      </Text>
    </DefaultLayout>
  );
}

export default WelcomeEmail;
