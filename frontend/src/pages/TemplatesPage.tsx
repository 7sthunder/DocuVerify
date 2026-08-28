import { useNavigate } from "react-router-dom";
import PlaceholderPage from "../components/PlaceholderPage";
import { TemplateIcon } from "../components/icons";

export default function TemplatesPage() {
  const navigate = useNavigate();
  return (
    <PlaceholderPage
      icon={<TemplateIcon className="w-7 h-7" />}
      title="Official templates"
      description="Upload reference templates in the verification workspace to enable template-difference comparison against official documents."
      note="Template upload & comparison already works inside the document verification page."
      actionLabel="Verify a document"
      onAction={() => navigate("/verify")}
    />
  );
}