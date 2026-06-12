import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { QuestionnaireForm } from "@/components/questionnaire/questionnaire-form";

export const metadata: Metadata = {
  title: "Lifestyle Questionnaire — Skin Analysis",
  description:
    "Tell us about your sleep, diet, stress, and environment. Takes 4 minutes. Powers your personalised skin recommendations.",
};

export default function QuestionnairePage({
  searchParams,
}: {
  searchParams: { scan_id?: string };
}) {
  function handleComplete(questionnaireId: string) {
    "use server";
    redirect(`/results/${searchParams.scan_id ?? ""}?questionnaire_id=${questionnaireId}`);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <QuestionnaireForm />
    </main>
  );
}
