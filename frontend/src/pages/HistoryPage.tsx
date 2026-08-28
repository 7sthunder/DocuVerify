import { useNavigate } from "react-router-dom";
import PlaceholderPage from "../components/PlaceholderPage";
import { HistoryIcon } from "../components/icons";

export default function HistoryPage() {
  const navigate = useNavigate();
  return (
    <PlaceholderPage
      icon={<HistoryIcon className="w-7 h-7" />}
      title="Verification history"
      description="Every document you verify with DocuVerify will be recorded here with its score, risk level and findings."
      note="History storage is not enabled yet — run your first verification to see real results."
      actionLabel="Verify a document"
      onAction={() => navigate("/verify")}
    />
  );
}