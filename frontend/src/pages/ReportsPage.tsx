import { useNavigate } from "react-router-dom";
import PlaceholderPage from "../components/PlaceholderPage";
import { ChartIcon } from "../components/icons";

export default function ReportsPage() {
  const navigate = useNavigate();
  return (
    <PlaceholderPage
      icon={<ChartIcon className="w-7 h-7" />}
      title="Reports"
      description="Forensic reports are generated for every completed verification, including the suspicion score, findings and region overlays."
      note="A sample report is available from the dashboard's 'View Sample Report' button."
      actionLabel="Verify a document"
      onAction={() => navigate("/verify")}
    />
  );
}