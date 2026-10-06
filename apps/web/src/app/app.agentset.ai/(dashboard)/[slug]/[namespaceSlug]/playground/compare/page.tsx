"use client";

import DashboardPageWrapper from "@/components/dashboard-page-wrapper";

import ComparePageClient from "./page.client";

export default function ComparePage() {
  return (
    <DashboardPageWrapper
      title="Compare corpora"
      className="p-0 md:p-0"
      requireNamespace
    >
      <ComparePageClient />
    </DashboardPageWrapper>
  );
}
