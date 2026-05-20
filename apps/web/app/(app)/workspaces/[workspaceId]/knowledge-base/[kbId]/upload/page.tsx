"use client";

export const dynamic = "force-dynamic";

import { UploadForm } from "@/components/kb/upload-form";
import type { KBUploadAcceptedOut } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

type Props = { params: Promise<{ workspaceId: string; kbId: string }> };

export default function KBUploadPage({ params }: Props) {
  const { workspaceId, kbId } = use(params);
  const t = useTranslations("knowledgeBase");
  const router = useRouter();
  const token = useToken();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleUploaded = (result: KBUploadAcceptedOut) => {
    const msg = result.duplicate ? t("upload.duplicateMessage") : t("upload.successTitle");
    setSuccessMessage(msg);
    setTimeout(() => {
      router.push(ROUTES.knowledgeBase(workspaceId));
    }, 2000);
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{t("upload.title")}</h1>

      {successMessage ? (
        <div className="rounded-lg bg-green-50 p-6 text-center">
          <p className="text-base font-semibold text-green-800">{successMessage}</p>
          <p className="mt-1 text-sm text-green-600">{t("upload.successMessage")}</p>
        </div>
      ) : (
        <UploadForm
          workspaceId={workspaceId}
          kbId={kbId}
          token={token}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
}
