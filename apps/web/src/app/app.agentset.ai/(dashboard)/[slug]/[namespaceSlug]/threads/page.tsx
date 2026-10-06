import DashboardPageWrapper from "@/components/dashboard-page-wrapper";

import ThreadsPageClient from "./page.client";

export default function ThreadsPage() {
  return (
    <DashboardPageWrapper title="Conversations" requireNamespace>
      <ThreadsPageClient />
    </DashboardPageWrapper>
  );
}
